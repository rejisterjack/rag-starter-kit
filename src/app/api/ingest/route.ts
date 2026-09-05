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

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { fromJson } from '@/lib/db/json';
import { logger } from '@/lib/logger';
import { processDocumentInline } from '@/lib/rag/ingestion/inline-processor';
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
import { uploadFile } from '@/lib/storage/cloudinary-storage';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import {
  checkDocumentLimit,
  checkStorageLimit,
  checkUserStorageLimit,
} from '@/lib/workspace/resource-limits';

// Vercel maxDuration: upload + fire-and-forget processing
export const maxDuration = 60;

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
      const response = apiError(
        'SERVICE_DEGRADED',
        'File uploads are temporarily unavailable. Please try again later.',
        503
      );
      response.headers.set('X-Degraded-Features', 'file_upload');
      return response;
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
      const response = apiError('RATE_LIMIT', 'Rate limit exceeded. Please try again later.', 429, {
        resetAt: new Date(rateLimitResult.reset).toISOString(),
      });
      response.headers.set(
        'Retry-After',
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
      );
      return response;
    }

    // Step 3: Parse multipart form data (support both FormData and JSON body)
    let formData: FormData;
    const contentTypeHeader = req.headers.get('content-type') || '';

    if (contentTypeHeader.includes('application/json')) {
      // JSON body support for URL-based ingestion: { "url": "..." }
      // Check content-length header before parsing to prevent oversized payloads
      const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_FILE_SIZE) {
        return apiError('PAYLOAD_TOO_LARGE', 'Request body exceeds 50MB limit', 413);
      }

      let jsonBody: Record<string, unknown>;
      try {
        jsonBody = (await req.json()) as Record<string, unknown>;
      } catch (error: unknown) {
        logger.debug('Failed to parse JSON body', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return apiError('INVALID_BODY', 'Invalid JSON body', 400);
      }

      const jsonUrl = jsonBody.url as string | undefined;
      const jsonContent = jsonBody.content as string | undefined;
      const jsonTitle = jsonBody.title as string | undefined;
      const jsonWorkspaceId = (jsonBody.workspaceId as string) || session.user.workspaceId;

      if (jsonWorkspaceId && !isValidCUID(jsonWorkspaceId)) {
        return apiError('INVALID_WORKSPACE_ID', 'Invalid workspace ID format', 400);
      }

      if (jsonUrl) {
        // Validate workspace access
        if (jsonWorkspaceId) {
          const hasAccess = await checkPermission(
            userId,
            jsonWorkspaceId,
            Permission.WRITE_DOCUMENTS
          );
          if (!hasAccess) {
            return apiError('FORBIDDEN', 'Access denied to workspace', 403);
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
            return apiError('FORBIDDEN', 'Access denied to workspace', 403);
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

      return apiError('NO_CONTENT', 'JSON body must contain "url" or "content" field', 400);
    }

    try {
      formData = await req.formData();
    } catch (error: unknown) {
      logger.debug('Failed to parse form data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_FORM', 'Invalid form data', 400);
    }

    // Step 4: Get file or URL
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    let workspaceId = (formData.get('workspaceId') as string) || session.user.workspaceId;

    if (workspaceId && !isValidCUID(workspaceId)) {
      return apiError('INVALID_WORKSPACE_ID', 'Invalid workspace ID format', 400);
    }

    // Step 5: Validate workspace access and permissions
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.WRITE_DOCUMENTS);
      if (!hasAccess) {
        // Stale session workspace — auto-create a personal workspace
        logger.info('Auto-creating personal workspace for user', { userId });
        try {
          const personalWorkspace = await prisma.workspace.create({
            data: {
              name: 'My Workspace',
              slug: `ws-${userId.slice(0, 8)}-${Date.now().toString(36)}`,
              ownerId: userId,
              members: {
                create: {
                  userId,
                  role: 'OWNER',
                  status: 'ACTIVE',
                },
              },
            },
          });
          workspaceId = personalWorkspace.id;
        } catch (createError) {
          // Handle unique constraint violation — workspace may already exist from a concurrent request
          if (
            createError instanceof Error &&
            (createError.message.includes('Unique constraint') ||
              createError.message.includes('unique'))
          ) {
            const existing = await prisma.workspace.findFirst({
              where: { ownerId: userId },
              orderBy: { createdAt: 'asc' },
            });
            if (existing) {
              workspaceId = existing.id;
            } else {
              return apiError('FORBIDDEN', 'Access denied to workspace', 403);
            }
          } else {
            return apiError('FORBIDDEN', 'Access denied to workspace', 403);
          }
        }
      }

      // Step 5b: Check workspace resource limits
      const docLimit = await checkDocumentLimit(workspaceId);
      if (!docLimit.allowed) {
        return apiError('LIMIT_EXCEEDED', docLimit.reason ?? 'Resource limit exceeded', 403);
      }
    }

    // Step 6: Handle URL ingestion
    if (url) {
      return handleURLIngestion(url, userId, workspaceId, startTime, rateLimitResult);
    }

    // Step 7: Handle file ingestion
    if (!file) {
      return apiError('NO_CONTENT', 'No file or URL provided', 400);
    }

    return handleFileIngestion(file, userId, workspaceId, startTime, rateLimitResult);
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Failed to process document',
      500
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
    return apiError(
      'FILE_TOO_LARGE',
      `File size (${formatBytes(file.size)}) exceeds 50MB limit`,
      413
    );
  }

  // Step 1b: Check workspace storage limit
  if (workspaceId) {
    const storageLimit = await checkStorageLimit(workspaceId, file.size);
    if (!storageLimit.allowed) {
      return apiError('LIMIT_EXCEEDED', storageLimit.reason ?? 'Storage limit exceeded', 403);
    }
  }

  // Check per-user storage limit for non-workspace uploads
  if (!workspaceId) {
    const userStorageLimit = await checkUserStorageLimit(userId, file.size);
    if (!userStorageLimit.allowed) {
      return apiError('LIMIT_EXCEEDED', userStorageLimit.reason ?? 'Storage limit exceeded', 403);
    }
  }

  // Step 2: Validate file type
  const fileValidation = validateFile(file, { maxSize: MAX_FILE_SIZE });
  if (!fileValidation.valid) {
    return apiError('INVALID_FILE_TYPE', fileValidation.error ?? 'Invalid file type', 400);
  }

  // Step 3: Read file into buffer once (used for virus scan, magic bytes, and parsing)
  const bytes = await file.arrayBuffer();

  // Validate file bytes using magic byte detection
  const magicBytesValidation = validateFileBytes(bytes, file.type);
  if (!magicBytesValidation.valid) {
    return apiError(
      'INVALID_FILE_CONTENT',
      magicBytesValidation.error ?? 'File content does not match expected type',
      400
    );
  }

  const buffer = Buffer.from(bytes);

  // Step 4: Virus scan (ClamAV integration) — uses the same buffer, no double read
  if (ENABLE_VIRUS_SCAN) {
    const scanResult = await scanFileForVirusesBuffer(buffer, file.name);
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

      return apiError('VIRUS_DETECTED', 'File contains malicious content and was rejected', 400);
    }
  }

  // Step 5: Parse text files inline (fast), upload binary files to Cloudinary
  const TEXT_TYPES = ['TXT', 'MD', 'HTML'];
  const isTextFile = TEXT_TYPES.includes(fileValidation.type ?? '');
  let storageUrl: string | null = null;
  let storageKey: string | null = null;
  let content: string | null = null;

  if (isTextFile) {
    // Parse text files directly — no Cloudinary round-trip
    content = buffer.toString('utf-8');
  } else {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      storageKey = `documents/${crypto.randomUUID()}.${fileExt}`;
      const uploadResult = await uploadFile(storageKey, buffer, {
        contentType: file.type || 'application/octet-stream',
      });
      storageUrl = uploadResult.url;
    } catch (error) {
      const isDev = process.env.NODE_ENV === 'development';
      return apiError(
        'UPLOAD_FAILED',
        isDev
          ? error instanceof Error
            ? error.message
            : 'Failed to upload file to storage'
          : 'Failed to upload file',
        500
      );
    }
  }

  // Step 6: Create document record
  const document = await prisma.document.create({
    data: {
      name: file.name,
      contentType: fileValidation.type ?? 'UNKNOWN',
      size: file.size,
      status: 'PENDING',
      userId,
      workspaceId: workspaceId || null,
      ...(storageUrl && { storageUrl }),
      ...(storageKey && { storageKey }),
      ...(content && { content }),
      metadata: {
        originalName: file.name,
        mimeType: file.type,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        scanned: ENABLE_VIRUS_SCAN,
      },
    },
  });

  // Step 7: Dispatch Inngest event (falls back to direct processing if Inngest is down)
  dispatchOrProcessDirect(document.id, userId);

  // Step 8: Log document upload
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

  // Step 9: Return response with rate limit headers
  const response = apiSuccess(
    {
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
    201
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
    return apiError(
      'RATE_LIMIT',
      'URL ingestion rate limit exceeded. Please try again later.',
      429
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
      return apiError('URL_BLOCKED', ssrfCheck.reason || 'URL is not allowed', 403);
    }

    // Check against allowed domains if configured
    const allowedDomains = process.env.ALLOWED_URL_DOMAINS?.split(',');
    if (allowedDomains?.length) {
      const isAllowed = allowedDomains.some(
        (domain) => validatedUrl.hostname === domain || validatedUrl.hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return apiError('DOMAIN_NOT_ALLOWED', 'This domain is not allowed for URL ingestion', 403);
      }
    }
  } catch (error: unknown) {
    logger.debug('Invalid URL provided for ingestion', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INVALID_URL', 'Invalid or unsupported URL provided', 400);
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

  // Dispatch Inngest event (falls back to direct processing if Inngest is down)
  dispatchOrProcessDirect(document.id, userId);

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

  const response = apiSuccess(
    {
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
    201
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
      return apiError('MISSING_ID', 'Document ID is required', 400);
    }

    // Fetch document
    const document = await prismaRead.document.findUnique({
      where: { id: documentId },
      include: {
        ingestionJob: true,
      },
    });

    if (!document) {
      return apiError('NOT_FOUND', 'Document not found', 404);
    }

    // Check access - user can only see their own documents or workspace documents
    const hasAccess =
      document.userId === userId || document.workspaceId === session.user.workspaceId;

    if (!hasAccess) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Get job details
    const job = document.ingestionJob;
    const metadata = fromJson<Record<string, unknown>>(document.metadata, {});

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
          error = String(metadata.error ?? 'Processing failed');
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
      chunkCount: 0,
      error,
      errorCategory: job?.errorCategory ?? undefined,
      metadata: {
        size: document.size,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        processedAt: metadata.processedAt,
        processingTimeMs: metadata.processingTimeMs,
      },
    };

    return apiSuccess(status);
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Failed to retrieve document status',
      500
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
      return apiError('MISSING_ID', 'Document ID is required', 400);
    }

    // Fetch document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return apiError('NOT_FOUND', 'Document not found', 404);
    }

    // Check access
    const hasDirectAccess = document.userId === userId;
    const hasWorkspaceAccess =
      document.workspaceId &&
      (await checkPermission(userId, document.workspaceId, Permission.DELETE_DOCUMENTS));

    if (!hasDirectAccess && !hasWorkspaceAccess) {
      return apiError('FORBIDDEN', 'Access denied', 403);
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
      // Delete chunks from pgvector
      const { deleteByDocumentId } = await import('@/lib/vector');
      const chunksRemoved = await deleteByDocumentId(documentId);

      // Delete the document record
      await prisma.document.delete({
        where: { id: documentId },
      });

      return apiSuccess({
        documentId,
        status: 'deleted',
        chunksRemoved,
        message: 'Document and associated data deleted successfully',
      });
    }

    // Cancel processing
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        metadata: {
          ...fromJson<Record<string, unknown>>(document.metadata, {}),
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

    return apiSuccess({
      documentId,
      status: 'cancelled',
      message: 'Processing cancelled successfully',
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Failed to cancel document processing',
      500
    );
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function isValidCUID(id: string): boolean {
  // CUID: starts with 'c', 25 chars, lowercase + digits
  // CUID2: starts with a letter, 24+ chars, lowercase + digits
  // Also accept Prisma default CUIDs
  return /^[a-z][a-z0-9]{19,31}$/i.test(id);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

async function hashContent(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // For very large documents (>20MB), sample head + tail + length to avoid
    // encoding the entire content into a single buffer
    const MAX_HASH_INPUT = 20 * 1024 * 1024; // 20MB
    const SAMPLE = 5 * 1024 * 1024; // 5MB from each end
    const input =
      content.length > MAX_HASH_INPUT
        ? content.slice(0, SAMPLE) +
          content.slice(content.length - SAMPLE) +
          content.length.toString()
        : content;

    const encoder = new TextEncoder();
    const data = encoder.encode(input);
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
 * Scan file buffer for viruses using ClamAV or similar service
 */
async function scanFileForVirusesBuffer(
  buffer: Buffer,
  filename: string
): Promise<VirusScanResult> {
  // Check file extension as first line of defense
  const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.php', '.jsp'];
  const hasDangerousExt = dangerousExtensions.some((ext) => filename.toLowerCase().endsWith(ext));

  if (hasDangerousExt) {
    return { clean: false, threat: 'Executable file detected' };
  }

  const scanResult = await virusScanner.scanFile(buffer, filename);

  if (!scanResult.clean) {
    return {
      clean: false,
      threat: scanResult.threatName || 'Virus detected',
    };
  }

  return { clean: true };
}

/**
 * Process document — always runs inline, also notifies Inngest if available.
 */
function dispatchOrProcessDirect(documentId: string, userId: string) {
  logger.info('dispatchOrProcessDirect called', { documentId });
  // Fire-and-forget inline processing
  void processDocumentInline(documentId, userId).catch(async (err) => {
    const errMsg = err instanceof Error ? err.message : 'Unknown';
    logger.error('Direct processing failed', { documentId, error: errMsg });
    await prisma.document
      .update({
        where: { id: documentId },
        data: { status: 'FAILED', metadata: { error: errMsg, failedAt: new Date().toISOString() } },
      })
      .catch((error) => {
        logger.error('Failed to mark document as FAILED', { documentId, error });
      });
    await prisma.ingestionJob
      .updateMany({
        where: { documentId },
        data: { status: 'FAILED', error: errMsg, completedAt: new Date() },
      })
      .catch((error) => {
        logger.error('Failed to mark ingestion jobs as FAILED', { documentId, error });
      });
  });
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
    return apiError(
      'CONTENT_TOO_LARGE',
      `Content size (${formatBytes(docSize)}) exceeds 50MB limit`,
      413
    );
  }

  // Check workspace storage limit
  if (workspaceId) {
    const storageLimit = await checkStorageLimit(workspaceId, docSize);
    if (!storageLimit.allowed) {
      return apiError('LIMIT_EXCEEDED', storageLimit.reason ?? 'Storage limit exceeded', 403);
    }
  }

  // Check per-user storage limit for non-workspace uploads
  if (!workspaceId) {
    const userStorageLimit = await checkUserStorageLimit(userId, docSize);
    if (!userStorageLimit.allowed) {
      return apiError('LIMIT_EXCEEDED', userStorageLimit.reason ?? 'Storage limit exceeded', 403);
    }
  }

  // Check for duplicate content
  const contentHash = await hashContent(content);
  const duplicateWhere = workspaceId ? { workspaceId } : { userId, workspaceId: null };
  const existingDoc = await prisma.document.findFirst({
    where: {
      ...duplicateWhere,
      contentHash,
    },
  });

  if (existingDoc) {
    return apiError('DUPLICATE_CONTENT', 'A document with similar content already exists', 409, {
      existingDocumentId: existingDoc.id,
    });
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
      contentHash,
      metadata: {
        source: 'raw_content',
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  // Dispatch Inngest event for background processing
  // Dispatch Inngest event (falls back to direct processing if Inngest is down)
  dispatchOrProcessDirect(document.id, userId);

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

  const response = apiSuccess(
    {
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
    201
  );

  addRateLimitHeaders(response.headers, rateLimitResult);
  return response;
}
