/**
 * Document Ingestion API Routes
 * 
 * POST /api/ingest - Upload and queue documents for processing
 * GET /api/ingest?id=:id - Check processing status
 * DELETE /api/ingest?id=:id - Cancel processing
 * 
 * Security Features:
 * - Authentication check
 * - Workspace access validation with permission check (WRITE_DOCUMENTS)
 * - Rate limiting per user/workspace
 * - File validation (type, size, virus scan placeholder)
 * - Input sanitization
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import {
  detectDocumentType,
  validateDocument,
  parsePDF,
  parseDOCX,
  parseText,
  parseHTML,
} from '@/lib/rag/ingestion';
import { Permission, checkPermission } from '@/lib/workspace/permissions';
import {
  checkApiRateLimit,
  getRateLimitIdentifier,
  addRateLimitHeaders,
} from '@/lib/security/rate-limiter';
import { validateIngestInput, validateFile } from '@/lib/security/input-validator';
import { logAuditEvent, AuditEvent, AuditSeverity } from '@/lib/audit/audit-logger';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Virus scan placeholder - implement with ClamAV or similar in production
const ENABLE_VIRUS_SCAN = process.env.ENABLE_VIRUS_SCAN === 'true';

// =============================================================================
// POST /api/ingest - Upload Document
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId: session.user.workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'ingest', {
      userId,
      endpoint: '/api/ingest',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded. Please try again later.',
            resetAt: new Date(rateLimitResult.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Step 3: Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FORM', message: 'Invalid form data' } },
        { status: 400 }
      );
    }

    // Step 4: Get file or URL
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const workspaceId = (formData.get('workspaceId') as string) || session.user.workspaceId;

    // Step 5: Validate workspace access and permissions
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.WRITE_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'document_upload',
            requiredPermission: Permission.WRITE_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } },
          { status: 403 }
        );
      }
    }

    // Step 6: Handle URL ingestion
    if (url) {
      return handleURLIngestion(url, userId, workspaceId, startTime, rateLimitResult);
    }

    // Step 7: Handle file ingestion
    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: 'No file or URL provided' } },
        { status: 400 }
      );
    }

    return handleFileIngestion(file, userId, workspaceId, startTime, rateLimitResult);
  } catch (error) {
    console.error('Ingest API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Handle file upload ingestion
 */
async function handleFileIngestion(
  file: File,
  userId: string,
  workspaceId: string | undefined,
  startTime: number,
  rateLimitResult: { success: boolean; limit: number; remaining: number; reset: number }
) {
  // Step 1: Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size (${formatBytes(file.size)}) exceeds 50MB limit`,
        },
      },
      { status: 413 }
    );
  }

  // Step 2: Validate file type
  const fileValidation = validateFile(file, { maxSize: MAX_FILE_SIZE });
  if (!fileValidation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: fileValidation.error,
        },
      },
      { status: 400 }
    );
  }

  // Step 3: Virus scan (placeholder)
  if (ENABLE_VIRUS_SCAN) {
    const scanResult = await scanFileForViruses(file);
    if (!scanResult.clean) {
      await logAuditEvent({
        event: AuditEvent.SUSPICIOUS_ACTIVITY,
        userId,
        workspaceId,
        metadata: {
          activity: 'virus_detected',
          filename: file.name,
          threat: scanResult.threat,
        },
        severity: 'CRITICAL',
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VIRUS_DETECTED',
            message: 'File contains malicious content and was rejected',
          },
        },
        { status: 400 }
      );
    }
  }

  // Step 4: Validate document
  const validation = await validateDocument(file, {
    maxSize: MAX_FILE_SIZE,
  });

  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validation.error!,
        },
      },
      { status: 400 }
    );
  }

  // Step 5: Convert to buffer and parse content
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let content: string;
  let metadata: Record<string, unknown> = {};

  try {
    switch (validation.type) {
      case 'PDF': {
        const parsed = await parsePDF(buffer);
        content = parsed.text;
        metadata = {
          ...parsed.metadata,
          totalCharacters: parsed.totalCharacters,
          pageCount: parsed.metadata.pageCount,
        };
        break;
      }

      case 'DOCX': {
        const parsed = await parseDOCX(buffer);
        content = parsed.text;
        metadata = {
          ...parsed.metadata,
          wordCount: parsed.wordCount,
          characterCount: parsed.characterCount,
        };
        break;
      }

      case 'TXT':
      case 'MD': {
        const parsed = parseText(buffer, { detectEncoding: true });
        content = parsed.text;
        metadata = {
          encoding: parsed.encoding,
          lineCount: parsed.lineCount,
          wordCount: parsed.wordCount,
          characterCount: parsed.characterCount,
        };
        break;
      }

      case 'HTML': {
        const parsed = parseHTML(buffer);
        content = parsed.text;
        metadata = {
          ...parsed.metadata,
          wordCount: parsed.wordCount,
          characterCount: parsed.characterCount,
        };
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNSUPPORTED_TYPE',
              message: `Document type '${validation.type}' is not supported`,
            },
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Document parsing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to parse document',
        },
      },
      { status: 422 }
    );
  }

  // Step 6: Check for duplicate content (simple hash check)
  const contentHash = await hashContent(content.slice(0, 1000));
  const targetId = workspaceId || userId;
  const existingDoc = await prisma.document.findFirst({
    where: {
      OR: [
        { userId: targetId },
        { workspaceId: targetId },
      ],
      metadata: {
        path: ['contentHash'],
        equals: contentHash,
      },
    },
  });

  if (existingDoc) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_CONTENT',
          message: 'A document with similar content already exists',
          details: { existingDocumentId: existingDoc.id },
        },
      },
      { status: 409 }
    );
  }

  // Step 7: Create document record
  const document = await prisma.document.create({
    data: {
      name: file.name,
      contentType: validation.type!,
      size: file.size,
      status: 'PENDING',
      userId: targetId,
      workspaceId: workspaceId || null,
      content,
      metadata: {
        ...metadata,
        originalName: file.name,
        mimeType: file.type,
        contentHash,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        scanned: ENABLE_VIRUS_SCAN,
      },
    },
  });

  // Step 8: Queue for background processing
  await inngest.send({
    name: 'document/ingest',
    data: {
      documentId: document.id,
      userId: targetId,
    },
  });

  // Step 9: Log document upload
  await logAuditEvent({
    event: AuditEvent.DOCUMENT_UPLOADED,
    userId,
    workspaceId,
    metadata: {
      documentId: document.id,
      filename: file.name,
      size: file.size,
      type: validation.type,
    },
  });

  // Step 10: Return response with rate limit headers
  const response = NextResponse.json({
    success: true,
    data: {
      document: {
        id: document.id,
        name: document.name,
        type: document.contentType,
        size: document.size,
        status: 'pending',
        createdAt: document.createdAt.toISOString(),
      },
      message: 'Document uploaded and queued for processing',
      processingTimeMs: Date.now() - startTime,
    },
  }, { status: 201 });

  addRateLimitHeaders(response.headers, rateLimitResult);
  return response;
}

/**
 * Handle URL ingestion
 */
async function handleURLIngestion(
  url: string,
  userId: string,
  workspaceId: string | undefined,
  startTime: number,
  rateLimitResult: { success: boolean; limit: number; remaining: number; reset: number }
) {
  // Check URL rate limit (separate from file upload)
  const urlRateLimitIdentifier = `url:${userId}`;
  const urlRateLimitResult = await checkApiRateLimit(urlRateLimitIdentifier, 'ingestUrl', {
    userId,
    endpoint: '/api/ingest/url',
  });

  if (!urlRateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'URL ingestion rate limit exceeded. Please try again later.',
        },
      },
      { status: 429 }
    );
  }

  // Validate URL
  let validatedUrl: URL;
  try {
    validatedUrl = new URL(url);

    // Only allow http and https
    if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }

    // Check against allowed domains if configured
    const allowedDomains = process.env.ALLOWED_URL_DOMAINS?.split(',');
    if (allowedDomains?.length) {
      const isAllowed = allowedDomains.some((domain) =>
        validatedUrl.hostname === domain || validatedUrl.hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DOMAIN_NOT_ALLOWED',
              message: 'This domain is not allowed for URL ingestion',
            },
          },
          { status: 403 }
        );
      }
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Invalid or unsupported URL provided',
        },
      },
      { status: 400 }
    );
  }

  // Create document record (content will be fetched in background)
  const targetId = workspaceId || userId;
  const document = await prisma.document.create({
    data: {
      name: validatedUrl.hostname + validatedUrl.pathname,
      contentType: 'HTML',
      size: 0,
      status: 'PENDING',
      userId: targetId,
      workspaceId: workspaceId || null,
      metadata: {
        sourceUrl: url,
        domain: validatedUrl.hostname,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  // Queue for background processing
  await inngest.send({
    name: 'document/ingest',
    data: {
      documentId: document.id,
      userId: targetId,
      url,
    },
  });

  // Log document upload
  await logAuditEvent({
    event: AuditEvent.DOCUMENT_UPLOADED,
    userId,
    workspaceId,
    metadata: {
      documentId: document.id,
      sourceUrl: url,
      type: 'URL',
    },
  });

  const response = NextResponse.json({
    success: true,
    data: {
      document: {
        id: document.id,
        name: document.name,
        type: 'HTML',
        url: url,
        status: 'pending',
        createdAt: document.createdAt.toISOString(),
      },
      message: 'URL queued for scraping and processing',
      processingTimeMs: Date.now() - startTime,
    },
  }, { status: 201 });

  addRateLimitHeaders(response.headers, rateLimitResult);
  return response;
}

// =============================================================================
// GET /api/ingest?id=:id - Check Processing Status
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Document ID is required' } },
        { status: 400 }
      );
    }

    // Fetch document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        ingestionJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    // Check access - user can only see their own documents or workspace documents
    const hasAccess = document.userId === userId || 
      document.workspaceId === session.user.workspaceId;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get job details
    const job = document.ingestionJobs[0];
    const metadata = document.metadata as Record<string, unknown> || {};

    // Calculate progress
    let progress = 0;
    let stage: string = 'pending';
    let error: string | undefined;

    if (job) {
      progress = job.progress;
      stage = job.status.toLowerCase();
      error = job.error || undefined;
    } else {
      // Fallback to document status
      switch (document.status) {
        case 'PENDING':
          progress = 0;
          stage = 'pending';
          break;
        case 'PROCESSING':
          progress = 50;
          stage = 'processing';
          break;
        case 'COMPLETED':
          progress = 100;
          stage = 'completed';
          break;
        case 'FAILED':
          progress = 0;
          stage = 'failed';
          error = (metadata.error as string) || 'Processing failed';
          break;
      }
    }

    // Build response
    const status = {
      documentId: document.id,
      name: document.name,
      type: document.contentType,
      status: stage,
      progress,
      chunkCount: document._count.chunks,
      error,
      metadata: {
        size: document.size,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        processedAt: metadata.processedAt,
        processingTimeMs: metadata.processingTimeMs,
      },
    };

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Status API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/ingest?id=:id - Cancel Processing / Delete Document
// =============================================================================

export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Document ID is required' } },
        { status: 400 }
      );
    }

    // Fetch document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    // Check access
    const hasDirectAccess = document.userId === userId;
    const hasWorkspaceAccess = document.workspaceId && 
      await checkPermission(userId, document.workspaceId, Permission.DELETE_DOCUMENTS);

    if (!hasDirectAccess && !hasWorkspaceAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Log document deletion
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_DELETED,
      userId,
      workspaceId: document.workspaceId ?? undefined,
      metadata: {
        documentId: document.id,
        name: document.name,
        status: document.status,
      },
    });

    // Can only cancel pending or processing documents
    if (document.status !== 'PENDING' && document.status !== 'PROCESSING') {
      // Delete the document record
      await prisma.document.delete({
        where: { id: documentId },
      });

      return NextResponse.json({
        success: true,
        data: {
          documentId,
          status: 'deleted',
          message: 'Document deleted successfully',
        },
      });
    }

    // Cancel processing
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        metadata: {
          ...(document.metadata as Record<string, unknown> || {}),
          cancelledAt: new Date().toISOString(),
          error: 'Processing cancelled by user',
        },
      },
    });

    // Update job if exists
    await prisma.ingestionJob.updateMany({
      where: { documentId },
      data: {
        status: 'FAILED',
        error: 'Processing cancelled by user',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        status: 'cancelled',
        message: 'Processing cancelled successfully',
      },
    });
  } catch (error) {
    console.error('Cancel API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function hashContent(content: string): Promise<string> {
  // Use SubtleCrypto for hashing if available, otherwise use simple hash
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple hash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

interface VirusScanResult {
  clean: boolean;
  threat?: string;
}

/**
 * Virus scan placeholder
 * In production, integrate with ClamAV, VirusTotal, or similar service
 */
async function scanFileForViruses(file: File): Promise<VirusScanResult> {
  // Placeholder implementation
  // In production:
  // 1. Upload file to virus scanning service
  // 2. Wait for scan result
  // 3. Return clean status and any threats found

  const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.php', '.jsp'];
  const hasDangerousExt = dangerousExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (hasDangerousExt) {
    return { clean: false, threat: 'Executable file detected' };
  }

  return { clean: true };
}
