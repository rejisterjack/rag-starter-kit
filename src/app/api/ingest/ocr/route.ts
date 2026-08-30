/**
 * OCR API Route
 *
 * POST /api/ingest/ocr - Process images with OCR
 * - Supports file upload and URL
 * - Returns extracted text and confidence scores
 * - Supports multiple languages
 * - Provides bounding box information
 *
 * Query Parameters:
 * - language: OCR language code (default: 'eng')
 * - confidence: Minimum confidence threshold (default: 60)
 * - preprocessing: Enable preprocessing (default: true)
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { assertSafeUrl } from '@/lib/security/ssrf-protection';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// Lazy-loaded — tesseract.js and sharp are heavy (only needed when actually running OCR)
async function ocr() {
  return await import('@/lib/rag/ingestion/parsers/ocr');
}

// Maximum file size: 20MB for images
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Supported image MIME types
const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/tif',
  'image/bmp',
  'image/webp',
  'image/gif',
];

// =============================================================================
// POST /api/ingest/ocr - OCR Processing
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userId = session.user.id;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, {
      userId,
      workspaceId: session.user.workspaceId,
    });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'ocr', {
      userId,
      endpoint: '/api/ingest/ocr',
    });

    if (!rateLimitResult.success) {
      const response = apiError(
        'RATE_LIMIT',
        'OCR rate limit exceeded. Please try again later.',
        429,
        {
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        }
      );
      response.headers.set(
        'Retry-After',
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
      );
      return response;
    }

    // Step 3: Parse request
    const contentType = req.headers.get('content-type') || '';
    let file: File | null = null;
    let imageUrl: string | null = null;
    let workspaceId: string | null = session.user.workspaceId || null;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const language = searchParams.get('language') || 'eng';
    const confidenceThreshold = Number.parseFloat(searchParams.get('confidence') || '60');
    const enablePreprocessing = searchParams.get('preprocessing') !== 'false';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await req.formData();
      file = formData.get('file') as File | null;
      imageUrl = formData.get('url') as string | null;
      workspaceId = (formData.get('workspaceId') as string) || workspaceId;
    } else if (contentType.includes('application/json')) {
      // Handle JSON with URL
      const body = await req.json();
      imageUrl = body.url || null;
      workspaceId = body.workspaceId || workspaceId;
    } else {
      return apiError(
        'INVALID_CONTENT_TYPE',
        'Content-Type must be multipart/form-data or application/json',
        400
      );
    }

    // Step 4: Validate workspace access
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.WRITE_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'ocr_processing',
            requiredPermission: Permission.WRITE_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return apiError('FORBIDDEN', 'Access denied to workspace', 403);
      }
    }

    // Step 5: Get image buffer
    let buffer: Buffer;
    let filename: string;
    let mimeType: string;

    if (file) {
      // Validate file type
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return apiError(
          'INVALID_IMAGE_TYPE',
          `Unsupported image type: ${file.type}. Supported: ${SUPPORTED_IMAGE_TYPES.join(', ')}`,
          400
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return apiError(
          'FILE_TOO_LARGE',
          `File size (${formatBytes(file.size)}) exceeds 20MB limit`,
          413
        );
      }

      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      filename = file.name;
      mimeType = file.type;
    } else if (imageUrl) {
      // Fetch image from URL
      try {
        const fetchResult = await fetchImageFromURL(imageUrl);
        buffer = fetchResult.buffer;
        filename = fetchResult.filename;
        mimeType = fetchResult.mimeType;
      } catch (error) {
        const isDev = process.env.NODE_ENV === 'development';
        return apiError(
          'FETCH_ERROR',
          isDev
            ? error instanceof Error
              ? error.message
              : 'Failed to fetch image from URL'
            : 'Failed to fetch image from URL',
          400
        );
      }
    } else {
      return apiError('NO_CONTENT', 'No image file or URL provided', 400);
    }

    // Step 6: Validate image
    const { isValidImage } = await ocr();
    if (!(await isValidImage(buffer))) {
      return apiError('INVALID_IMAGE', 'File is not a valid image', 400);
    }

    // Step 7: Configure OCR
    const { OCRConfigBuilder, parseImageWithOCR } = await ocr();
    const ocrConfig = new OCRConfigBuilder()
      .withLanguage(language)
      .withConfidenceThreshold(confidenceThreshold)
      .withPreprocessing({
        enabled: enablePreprocessing,
        deskew: true,
        denoise: true,
        contrastEnhancement: true,
        binarizeThreshold: null,
        maxDimension: 3000,
        minDpi: 150,
      })
      .withLogger((_message) => {})
      .build();

    // Step 8: Perform OCR
    const ocrStartTime = Date.now();
    const progressUpdates: Array<{ stage: string; progress: number; message: string }> = [];

    const result = await parseImageWithOCR(buffer, ocrConfig, (progress) => {
      progressUpdates.push({
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
      });
    });

    const ocrProcessingTime = Date.now() - ocrStartTime;

    // Step 9: Log OCR event
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_PROCESSED,
      userId,
      workspaceId: workspaceId || undefined,
      metadata: {
        type: 'OCR',
        filename,
        mimeType,
        language,
        confidence: result.metadata.confidence,
        characterCount: result.metadata.characterCount,
        processingTimeMs: ocrProcessingTime,
      },
    });

    // Step 10: Build response
    const response = apiSuccess({
      text: result.content,
      confidence: result.metadata.confidence,
      language: result.metadata.language,
      characterCount: result.metadata.characterCount,
      wordCount: result.metadata.wordCount,
      processingTimeMs: ocrProcessingTime,
      preprocessingApplied: result.metadata.preprocessingApplied,
      filename,
      mimeType,
      blocks: result.metadata.blocks || [],
      progress: progressUpdates,
    });

    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } catch (error) {
    // Handle specific OCR errors
    const { OCRParserError } = await ocr();
    const isDev = process.env.NODE_ENV === 'development';
    if (error instanceof OCRParserError) {
      return apiError(error.code, isDev ? error.message : 'OCR processing failed', 422);
    }

    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Internal server error',
      500
    );
  }
}

// =============================================================================
// GET /api/ingest/ocr - Get OCR Info
// =============================================================================

export async function GET(_req: NextRequest) {
  try {
    // Authenticate user (optional for info endpoint)
    const session = await auth();

    // Return OCR capabilities and supported languages
    const { getLanguageOptions, isOCRAvailable, getOCRVersion } = await import(
      '@/lib/rag/ingestion/parsers/ocr'
    );

    const languages = getLanguageOptions();
    const available = isOCRAvailable();

    let version = null;
    if (available) {
      try {
        version = await getOCRVersion();
      } catch (error: unknown) {
        logger.debug('Failed to get OCR version', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Version info not critical
      }
    }

    return apiSuccess({
      available,
      version,
      supportedLanguages: languages,
      supportedFormats: ['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp', 'gif'],
      maxFileSize: MAX_FILE_SIZE,
      defaultLanguage: 'eng',
      defaultConfidenceThreshold: 60,
      authenticated: !!session?.user,
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Internal server error',
      500
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

interface FetchedImage {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

async function fetchImageFromURL(url: string): Promise<FetchedImage> {
  // Validate URL with SSRF protection
  await assertSafeUrl(url);

  // Parse URL for further processing
  let validatedUrl: URL;
  try {
    validatedUrl = new URL(url);
  } catch (error: unknown) {
    logger.debug('Invalid URL provided for OCR image fetch', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Invalid URL provided');
  }

  // Fetch image with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: SUPPORTED_IMAGE_TYPES.join(','),
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (contentType && !SUPPORTED_IMAGE_TYPES.some((type) => contentType.includes(type))) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      throw new Error('Image exceeds maximum size of 20MB');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image
    const { isValidImage: validateImg } = await ocr();
    if (!(await validateImg(buffer))) {
      throw new Error('Downloaded file is not a valid image');
    }

    // Extract filename from URL
    const urlPath = validatedUrl.pathname;
    const filename = urlPath.split('/').pop() || 'downloaded-image';

    return {
      buffer,
      filename,
      mimeType: contentType || 'image/unknown',
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Image download timed out');
    }
    throw error;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
