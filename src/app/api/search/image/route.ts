/**
 * Image Search API
 *
 * Supports:
 * - POST /api/search/image - Search by uploaded image
 * - GET /api/search/image?text=query - Search images by text
 * - POST /api/search/image/multimodal - Search with both text and image
 *
 * Features:
 * - Image-based similarity search using CLIP embeddings
 * - Text-to-image semantic search
 * - Multi-modal queries combining text and image
 * - Returns similar images and optionally related document chunks
 */

import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { searchByImage, searchImagesByText, searchMultiModal } from '@/lib/rag/retrieval';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// Max image size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/search/image
 * Search for similar images by uploading an image file
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'search', {
      userId,
      workspaceId,
      endpoint: '/api/search/image',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          resetAt: new Date(rateLimitResult.reset).toISOString(),
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
    } catch (_error) {
      return NextResponse.json(
        { error: 'Invalid form data', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Get search parameters
    const imageFile = formData.get('image') as File | null;
    const textQuery = formData.get('text') as string | null;
    const imageUrl = formData.get('imageUrl') as string | null;
    const topK = parseInt(formData.get('topK') as string, 10) || 5;
    const includeChunks = formData.get('includeChunks') === 'true';
    const imageWeight = parseFloat(formData.get('imageWeight') as string) || 0.5;

    // Validate workspace access
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'image_search',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { error: 'Access denied to workspace', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Step 4: Handle different search modes
    let results;

    // Multi-modal search (text + image)
    if ((imageFile || imageUrl) && textQuery) {
      let imageBuffer: Buffer | string;

      if (imageFile) {
        // Validate file size
        if (imageFile.size > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { error: 'Image too large. Max size: 10MB', code: 'FILE_TOO_LARGE' },
            { status: 413 }
          );
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else if (imageUrl) {
        // Validate URL
        try {
          new URL(imageUrl);
        } catch {
          return NextResponse.json(
            { error: 'Invalid image URL', code: 'INVALID_URL' },
            { status: 400 }
          );
        }
        imageBuffer = imageUrl;
      } else {
        return NextResponse.json(
          { error: 'No image provided', code: 'MISSING_IMAGE' },
          { status: 400 }
        );
      }

      results = await searchMultiModal(textQuery, imageBuffer, workspaceId || userId, {
        topK,
        includeChunks,
        imageWeight,
      });

      // Log search event
      await logAuditEvent({
        event: AuditEvent.READ_API_USAGE,
        userId,
        workspaceId,
        metadata: {
          action: 'multimodal_search',
          query: textQuery,
          resultCount: results.totalResults,
          processingTimeMs: results.processingTimeMs,
        },
      });
    }
    // Image-only search
    else if (imageFile || imageUrl) {
      let imageBuffer: Buffer | string;

      if (imageFile) {
        // Validate file size
        if (imageFile.size > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { error: 'Image too large. Max size: 10MB', code: 'FILE_TOO_LARGE' },
            { status: 413 }
          );
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else {
        imageBuffer = imageUrl as string;
      }

      results = await searchByImage(imageBuffer, workspaceId || userId, {
        topK,
        includeChunks,
      });

      // Log search event
      await logAuditEvent({
        event: AuditEvent.READ_API_USAGE,
        userId,
        workspaceId,
        metadata: {
          action: 'image_search',
          resultCount: results.totalResults,
          processingTimeMs: results.processingTimeMs,
        },
      });
    }
    // Text-only image search
    else if (textQuery) {
      results = await searchImagesByText(textQuery, workspaceId || userId, {
        topK,
        includeChunks,
      });

      // Log search event
      await logAuditEvent({
        event: AuditEvent.READ_API_USAGE,
        userId,
        workspaceId,
        metadata: {
          action: 'text_to_image_search',
          query: textQuery,
          resultCount: results.totalResults,
          processingTimeMs: results.processingTimeMs,
        },
      });
    } else {
      return NextResponse.json(
        {
          error: 'No search query provided. Provide either image or text query.',
          code: 'MISSING_QUERY',
        },
        { status: 400 }
      );
    }

    // Format response
    const response = NextResponse.json({
      success: true,
      data: {
        images: results.images.map((img) => ({
          id: img.id,
          documentId: img.documentId,
          documentName: img.documentName,
          storageUrl: img.storageUrl,
          caption: img.caption,
          ocrText: img.ocrText,
          pageNumber: img.pageNumber,
          similarity: img.similarity,
          metadata: img.metadata,
        })),
        chunks: results.chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          score: chunk.score,
          metadata: chunk.metadata,
        })),
        totalResults: results.totalResults,
        queryType: results.queryType,
        processingTimeMs: results.processingTimeMs,
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Search failed',
        code: 'SEARCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/image?text=query&topK=5
 * Search images by text query
 */
export async function GET(req: Request) {
  try {
    // Step 1: Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'search', {
      userId,
      workspaceId,
      endpoint: '/api/search/image',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Step 3: Parse query parameters
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('text');
    const topK = parseInt(searchParams.get('topK') || '5', 10);
    const includeChunks = searchParams.get('includeChunks') === 'true';

    if (!query) {
      return NextResponse.json(
        { error: 'Text query is required', code: 'MISSING_QUERY' },
        { status: 400 }
      );
    }

    // Validate workspace access
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'image_search',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { error: 'Access denied to workspace', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Step 4: Search
    const results = await searchImagesByText(query, workspaceId || userId, {
      topK,
      includeChunks,
    });

    // Log search event
    await logAuditEvent({
      event: AuditEvent.READ_API_USAGE,
      userId,
      workspaceId,
      metadata: {
        action: 'text_to_image_search',
        query,
        resultCount: results.totalResults,
        processingTimeMs: results.processingTimeMs,
      },
    });

    // Format response
    const response = NextResponse.json({
      success: true,
      data: {
        images: results.images.map((img) => ({
          id: img.id,
          documentId: img.documentId,
          documentName: img.documentName,
          storageUrl: img.storageUrl,
          caption: img.caption,
          ocrText: img.ocrText,
          pageNumber: img.pageNumber,
          similarity: img.similarity,
          metadata: img.metadata,
        })),
        chunks: results.chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          score: chunk.score,
          metadata: chunk.metadata,
        })),
        totalResults: results.totalResults,
        queryType: results.queryType,
        processingTimeMs: results.processingTimeMs,
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Search failed',
        code: 'SEARCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
