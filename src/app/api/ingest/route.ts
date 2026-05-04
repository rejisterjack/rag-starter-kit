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
 * - File validation (type, size, virus scan with ClamAV)
 * - Input sanitization
 * - Audit logging
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/logger';
import {
  parseAudio,
  parseDOCX,
  parseHTML,
  parsePDF,
  parsePPTXBuffer,
  parseText,
  parseVideo,
  parseXLSXBuffer,
} from '@/lib/rag/ingestion';
import { isYouTubeUrl } from '@/lib/rag/ingestion/parsers/youtube';
import { isFeatureDegraded } from '@/lib/resilience/degradation';
import { validateFile, validateFileBytes } from '@/lib/security/input-validator';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { validateUrlSafety } from '@/lib/security/ssrf-protection';
import { virusScanner } from '@/lib/security/virus-scanner';
import { withSpan } from '@/lib/tracing';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { checkDocumentLimit, checkStorageLimit } from '@/lib/workspace/resource-limits';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Virus scan configuration - requires ClamAV when enabled
const ENABLE_VIRUS_SCAN = process.env.ENABLE_VIRUS_SCAN === 'true';

// =============================================================================
// POST /api/ingest - Upload Document
// =============================================================================

export const POST = withApiAuth(async (req: NextRequest, session) => {
  const startTime = Date.now();

  try {
    const userId = session.user.id;

    // Step 1b: Check if file upload is degraded
    if (await isFeatureDegraded('file_upload')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_DEGRADED',
            message: 'File uploads are temporarily unavailable. Please try again later.',
          },
        },
        { status: 503, headers: { 'X-Degraded-Features': 'file_upload' } }
      );
    }

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, {
      userId,
      workspaceId: session.user.workspaceId,
    });
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

    // Step 3: Parse multipart form data (support both FormData and JSON body)
    let formData: FormData;
    const contentTypeHeader = req.headers.get('content-type') || '';

    if (contentTypeHeader.includes('application/json')) {
      // JSON body support for URL-based ingestion: { "url": "..." }
      let jsonBody: Record<string, unknown>;
      try {
        jsonBody = (await req.json()) as Record<string, unknown>;
      } catch (error: unknown) {
        logger.debug('Failed to parse JSON body', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
          { status: 400 }
        );
      }

      const jsonUrl = jsonBody.url as string | undefined;
      const jsonContent = jsonBody.content as string | undefined;
      const jsonTitle = jsonBody.title as string | undefined;
      const jsonWorkspaceId = (jsonBody.workspaceId as string) || session.user.workspaceId;

      if (jsonUrl) {
        // Validate workspace access
        if (jsonWorkspaceId) {
          const hasAccess = await checkPermission(
            userId,
            jsonWorkspaceId,
            Permission.WRITE_DOCUMENTS
          );
          if (!hasAccess) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied to workspace' },
              },
              { status: 403 }
            );
          }
        }
        return handleURLIngestion(jsonUrl, userId, jsonWorkspaceId, startTime, rateLimitResult);
      }

      if (jsonContent) {
        // Ingest raw text content via JSON
        if (jsonWorkspaceId) {
          const hasAccess = await checkPermission(
            userId,
            jsonWorkspaceId,
            Permission.WRITE_DOCUMENTS
          );
          if (!hasAccess) {
            return NextResponse.json(
              {
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied to workspace' },
              },
              { status: 403 }
            );
          }
        }
        return handleRawContentIngestion(
          jsonContent,
          jsonTitle || 'Uploaded Document',
          userId,
          jsonWorkspaceId,
          startTime,
          rateLimitResult
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: 'NO_CONTENT', message: 'JSON body must contain "url" or "content" field' },
        },
        { status: 400 }
      );
    }

    try {
      formData = await req.formData();
    } catch (error: unknown) {
      logger.debug('Failed to parse form data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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

      // Step 5b: Check workspace resource limits
      const docLimit = await checkDocumentLimit(workspaceId);
      if (!docLimit.allowed) {
        return NextResponse.json(
          { success: false, error: { code: 'LIMIT_EXCEEDED', message: docLimit.reason } },
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
});

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

  // Step 1b: Check workspace storage limit
  if (workspaceId) {
    const storageLimit = await checkStorageLimit(workspaceId, file.size);
    if (!storageLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'LIMIT_EXCEEDED', message: storageLimit.reason } },
        { status: 403 }
      );
    }
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

  // Step 3: Virus scan (ClamAV integration)
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

  // Step 5: Convert to buffer and validate magic bytes
  const bytes = await file.arrayBuffer();

  // Validate file bytes using magic byte detection (Fix #8)
  const magicBytesValidation = validateFileBytes(bytes, file.type);
  if (!magicBytesValidation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_FILE_CONTENT',
          message: magicBytesValidation.error ?? 'File content does not match expected type',
        },
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(bytes);

  let content: string;
  let metadata: Record<string, unknown> = {};

  try {
    content = await withSpan('ingest.parse_document', async (span) => {
      span.setAttribute('ingest.file_type', fileValidation.type ?? 'unknown');
      span.setAttribute('ingest.file_size', file.size);
      let parsed: string;
      switch (fileValidation.type) {
        case 'PDF': {
          parsed = await parsePDF(buffer);
          metadata = { source: 'pdf' };
          break;
        }

        case 'DOCX': {
          parsed = await parseDOCX(buffer);
          metadata = { source: 'docx' };
          break;
        }

        case 'XLSX': {
          parsed = await parseXLSXBuffer(buffer);
          metadata = { source: 'xlsx' };
          break;
        }

        case 'PPTX': {
          parsed = await parsePPTXBuffer(buffer);
          metadata = { source: 'pptx' };
          break;
        }

        case 'TXT':
        case 'MD': {
          parsed = parseText(buffer);
          metadata = { source: 'text' };
          break;
        }

        case 'HTML': {
          parsed = await parseHTML(buffer);
          metadata = { source: 'html' };
          break;
        }

        case 'AUDIO': {
          parsed = await parseAudio(buffer, file.type, file.name);
          metadata = { source: 'audio', mimeType: file.type };
          break;
        }

        case 'VIDEO': {
          parsed = await parseVideo(buffer, file.type, file.name);
          metadata = { source: 'video', mimeType: file.type };
          break;
        }

        default:
          throw new Error(`Document type '${fileValidation.type}' is not supported`);
      }
      span.setAttribute('ingest.content_length', parsed.length);
      return parsed;
    });
  } catch (error) {
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
      OR: [{ userId: targetId }, { workspaceId: targetId }],
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
  // FIXED: userId should always be the actual user who uploaded the document
  // workspaceId is the optional workspace context for the document
  const document = await prisma.document.create({
    data: {
      name: file.name,
      contentType: fileValidation.type ?? 'UNKNOWN',
      size: file.size,
      status: 'PENDING',
      userId: userId, // Always use the actual user's ID
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
      type: fileValidation.type,
    },
  });

  // Step 10: Return response with rate limit headers
  const response = NextResponse.json(
    {
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
    },
    { status: 201 }
  );

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

    // SSRF Protection: Block internal/private IPs and hostnames
    const ssrfCheck = await validateUrlSafety(url);
    if (!ssrfCheck.safe) {
      logger.warn('SSRF attempt blocked', { url, reason: ssrfCheck.reason, userId });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'URL_BLOCKED',
            message: ssrfCheck.reason || 'URL is not allowed',
          },
        },
        { status: 403 }
      );
    }

    // Check against allowed domains if configured
    const allowedDomains = process.env.ALLOWED_URL_DOMAINS?.split(',');
    if (allowedDomains?.length) {
      const isAllowed = allowedDomains.some(
        (domain) => validatedUrl.hostname === domain || validatedUrl.hostname.endsWith(`.${domain}`)
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
  } catch (error: unknown) {
    logger.debug('Invalid URL provided for ingestion', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
  // FIXED: userId should always be the actual user who uploaded the document

  // Check if this is a YouTube URL for special handling
  const isYT = isYouTubeUrl(url);
  const docContentType = isYT ? 'VIDEO' : 'HTML';
  const docName = isYT ? `YouTube: ${url}` : validatedUrl.hostname + validatedUrl.pathname;

  const document = await prisma.document.create({
    data: {
      name: docName,
      contentType: docContentType,
      size: 0,
      status: 'PENDING',
      userId: userId, // Always use the actual user's ID
      workspaceId: workspaceId || null,
      metadata: {
        sourceUrl: url,
        domain: validatedUrl.hostname,
        isYouTube: isYT,
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
      userId,
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
      type: isYT ? 'YOUTUBE' : 'URL',
    },
  });

  const response = NextResponse.json(
    {
      success: true,
      data: {
        document: {
          id: document.id,
          name: document.name,
          type: docContentType,
          url: url,
          status: 'pending',
          createdAt: document.createdAt.toISOString(),
        },
        message: isYT
          ? 'YouTube video queued for transcript extraction'
          : 'URL queued for scraping and processing',
        processingTimeMs: Date.now() - startTime,
      },
    },
    { status: 201 }
  );

  addRateLimitHeaders(response.headers, rateLimitResult);
  return response;
}

// =============================================================================
// GET /api/ingest?id=:id - Check Processing Status
// =============================================================================

export const GET = withApiAuth(async (req: NextRequest, session) => {
  try {
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
    const document = await prismaRead.document.findUnique({
      where: { id: documentId },
      include: {
        ingestionJob: true,
        chunks: { select: { id: true } },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    // Check access - user can only see their own documents or workspace documents
    const hasAccess =
      document.userId === userId || document.workspaceId === session.user.workspaceId;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get job details
    const job = document.ingestionJob;
    const metadata = (document.metadata as Record<string, unknown>) || {};

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
      chunkCount: document.chunks.length,
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
});

// =============================================================================
// DELETE /api/ingest?id=:id - Cancel Processing / Delete Document
// =============================================================================

export const DELETE = withApiAuth(async (req: NextRequest, session) => {
  try {
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
    const hasWorkspaceAccess =
      document.workspaceId &&
      (await checkPermission(userId, document.workspaceId, Permission.DELETE_DOCUMENTS));

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
          ...((document.metadata as Record<string, unknown>) || {}),
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
});

// =============================================================================
// Helper Functions
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
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
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

interface VirusScanResult {
  clean: boolean;
  threat?: string;
}

/**
 * Scan file for viruses using ClamAV or similar service
 */
async function scanFileForViruses(file: File): Promise<VirusScanResult> {
  // Check file extension as first line of defense
  const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.php', '.jsp'];
  const hasDangerousExt = dangerousExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

  if (hasDangerousExt) {
    return { clean: false, threat: 'Executable file detected' };
  }

  // Scan with ClamAV if enabled
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const scanResult = await virusScanner.scanFile(buffer, file.name);

  if (!scanResult.clean) {
    return {
      clean: false,
      threat: scanResult.threatName || 'Virus detected',
    };
  }

  return { clean: true };
}

/**
 * Handle raw text content ingestion (via JSON body)
 */
async function handleRawContentIngestion(
  content: string,
  title: string,
  userId: string,
  workspaceId: string | undefined,
  startTime: number,
  rateLimitResult: { success: boolean; limit: number; remaining: number; reset: number }
) {
  const docSize = Buffer.byteLength(content, 'utf-8');

  if (docSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONTENT_TOO_LARGE',
          message: `Content size (${formatBytes(docSize)}) exceeds 50MB limit`,
        },
      },
      { status: 413 }
    );
  }

  // Check workspace storage limit
  if (workspaceId) {
    const storageLimit = await checkStorageLimit(workspaceId, docSize);
    if (!storageLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'LIMIT_EXCEEDED', message: storageLimit.reason } },
        { status: 403 }
      );
    }
  }

  // Check for duplicate content
  const contentHash = await hashContent(content.slice(0, 1000));
  const existingDoc = await prisma.document.findFirst({
    where: {
      userId,
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

  // Create document record
  const document = await prisma.document.create({
    data: {
      name: title,
      contentType: 'TXT',
      size: docSize,
      status: 'PENDING',
      userId,
      workspaceId: workspaceId || null,
      content,
      metadata: {
        source: 'raw_content',
        contentHash,
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
      userId,
    },
  });

  // Audit log
  await logAuditEvent({
    event: AuditEvent.DOCUMENT_UPLOADED,
    userId,
    workspaceId,
    metadata: {
      documentId: document.id,
      type: 'RAW_CONTENT',
      size: docSize,
    },
  });

  const response = NextResponse.json(
    {
      success: true,
      data: {
        document: {
          id: document.id,
          name: document.name,
          type: 'TXT',
          size: docSize,
          status: 'pending',
          createdAt: document.createdAt.toISOString(),
        },
        message: 'Document queued for processing',
        processingTimeMs: Date.now() - startTime,
      },
    },
    { status: 201 }
  );

  addRateLimitHeaders(response.headers, rateLimitResult);
  return response;
}
