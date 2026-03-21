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

import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import {
  parseImageWithOCR,
  OCRParserError,
  OCRConfigBuilder,
  isValidImage,
  type OCRConfiguration,
} from '@/lib/rag/ingestion/parsers/ocr';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

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
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'OCR rate limit exceeded. Please try again later.',
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
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Type must be multipart/form-data or application/json',
          },
        },
        { status: 400 }
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

        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } },
          { status: 403 }
        );
      }
    }

    // Step 5: Get image buffer
    let buffer: Buffer;
    let filename: string;
    let mimeType: string;

    if (file) {
      // Validate file type
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_IMAGE_TYPE',
              message: `Unsupported image type: ${file.type}. Supported: ${SUPPORTED_IMAGE_TYPES.join(', ')}`,
            },
          },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size (${formatBytes(file.size)}) exceeds 20MB limit`,
            },
          },
          { status: 413 }
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
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FETCH_ERROR',
              message: error instanceof Error ? error.message : 'Failed to fetch image from URL',
            },
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_CONTENT',
            message: 'No image file or URL provided',
          },
        },
        { status: 400 }
      );
    }

    // Step 6: Validate image
    if (!(await isValidImage(buffer))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_IMAGE',
            message: 'File is not a valid image',
          },
        },
        { status: 400 }
      );
    }

    // Step 7: Configure OCR
    const ocrConfig: OCRConfiguration = new OCRConfigBuilder()
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
      .withLogger((message) => {
        console.log(`OCR Progress: ${message.status} - ${Math.round(message.progress * 100)}%`);
      })
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
    const response = NextResponse.json(
      {
        success: true,
        data: {
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
        },
      },
      { status: 200 }
    );

    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } catch (error) {
    console.error('OCR API error:', error);

    // Handle specific OCR errors
    if (error instanceof OCRParserError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 422 }
      );
    }

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
      } catch {
        // Version info not critical
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        available,
        version,
        supportedLanguages: languages,
        supportedFormats: ['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp', 'gif'],
        maxFileSize: MAX_FILE_SIZE,
        defaultLanguage: 'eng',
        defaultConfidenceThreshold: 60,
        authenticated: !!session?.user,
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
  // Validate URL
  let validatedUrl: URL;
  try {
    validatedUrl = new URL(url);
    if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }
  } catch {
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
    if (!(await isValidImage(buffer))) {
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
