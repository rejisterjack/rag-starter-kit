/**
 * Documents API Routes
 *
 * GET /api/documents - List all documents for the current user/workspace
 * DELETE /api/documents?id=:id - Delete a document
 *
 * Security Features:
 * - Authentication check
 * - Workspace access validation
 * - Rate limiting
 * - Audit logging
 */

import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { parsePaginationParams, validatePaginationParams } from '@/lib/db/cursor-pagination';
import { fromJson } from '@/lib/db/json';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// Document status mapping from DB to UI
const STATUS_MAP: Record<string, 'pending' | 'processing' | 'completed' | 'error'> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'error',
};

// =============================================================================
// GET /api/documents - List Documents
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'documents', {
      userId,
      workspaceId,
      endpoint: '/api/documents',
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

    // Step 3: Parse query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const workspaceIdFilter = searchParams.get('workspaceId') || workspaceId;

    // Support both cursor and legacy offset pagination
    const paginationParams = parsePaginationParams(searchParams, { limit: 100 });
    const validation = validatePaginationParams(paginationParams);
    if (!validation.valid) {
      return apiError('VALIDATION_ERROR', validation.error ?? 'Invalid pagination', 400);
    }

    // Step 4: Validate workspace access if filtering by workspace
    if (workspaceIdFilter) {
      const hasAccess = await checkPermission(userId, workspaceIdFilter, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId: workspaceIdFilter,
          metadata: {
            action: 'list_documents',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return apiError('FORBIDDEN', 'Access denied to workspace', 403);
      }
    }

    // Step 5: Build query filters
    const where: Record<string, unknown> = {};

    // Filter by workspace or user
    if (workspaceIdFilter) {
      where.workspaceId = workspaceIdFilter;
    } else {
      // User has no workspace — show only their personal documents
      where.userId = userId;
      where.workspaceId = null;
    }

    // Filter by status if provided
    if (status) {
      where.status = status.toUpperCase();
    }

    // Step 6: Fetch documents with cursor-based pagination
    const { limit: pageSize, cursor, sortOrder } = paginationParams;
    const take = pageSize + 1; // +1 to detect next page

    const documents = await prismaRead.document.findMany({
      where,
      select: {
        id: true,
        name: true,
        contentType: true,
        size: true,
        status: true,
        metadata: true,
        chunkCount: true,
        storageUrl: true,
        createdAt: true,
        ingestionJob: { select: { progress: true, error: true, errorCategory: true } },
      },
      orderBy: { createdAt: sortOrder },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const formattedDocuments = documents.map((doc) => {
      const metadata = fromJson<Record<string, unknown>>(doc.metadata, {});
      return {
        id: doc.id,
        name: doc.name,
        type:
          doc.contentType === 'URL' ? 'text/html' : `application/${doc.contentType.toLowerCase()}`,
        size: doc.size,
        status: STATUS_MAP[doc.status] || 'pending',
        progress: doc.ingestionJob?.progress,
        chunkCount: doc.chunkCount,
        storageUrl: doc.storageUrl,
        createdAt: doc.createdAt.toISOString(),
        errorMessage:
          doc.ingestionJob?.error ||
          (typeof metadata.error === 'string' ? metadata.error : undefined),
        errorCategory: doc.ingestionJob?.errorCategory ?? undefined,
      };
    });

    // Step 8: Build pagination result
    const hasNextPage = documents.length > pageSize;
    const resultDocs = hasNextPage ? documents.slice(0, pageSize) : documents;
    const lastDoc = resultDocs[resultDocs.length - 1];

    const pagedFormatted = formattedDocuments.slice(0, resultDocs.length);

    const response = apiSuccess({
      documents: pagedFormatted,
      pagination: {
        hasNextPage,
        nextCursor: hasNextPage && lastDoc ? lastDoc.id : null,
        limit: pageSize,
      },
    });

    addRateLimitHeaders(response.headers, rateLimitResult);
    response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=30');
    return response;
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Failed to retrieve documents',
      500
    );
  }
}

// =============================================================================
// DELETE /api/documents - Delete Document
// =============================================================================

export async function DELETE(req: NextRequest) {
  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userId = session.user.id;

    // Step 2: Parse query parameters
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return apiError('MISSING_ID', 'Document ID is required', 400);
    }

    // Step 3: Fetch document
    const document = await prismaRead.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return apiError('NOT_FOUND', 'Document not found', 404);
    }

    // Step 4: Check access permissions
    const hasDirectAccess = document.userId === userId;
    const hasWorkspaceAccess =
      document.workspaceId &&
      (await checkPermission(userId, document.workspaceId, Permission.DELETE_DOCUMENTS));

    if (!hasDirectAccess && !hasWorkspaceAccess) {
      logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        userId,
        workspaceId: document.workspaceId ?? undefined,
        metadata: {
          action: 'delete_document',
          documentId,
        },
        severity: 'WARNING',
      });

      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Step 5: Delete document (cascade will handle chunks)
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Invalidate document caches
    if (document.workspaceId) {
      revalidateTag(`workspace-docs-${document.workspaceId}`, 'default');
    }
    revalidateTag(`user-docs-${userId}`, 'default');

    // Step 6: Log deletion
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_DELETED,
      userId,
      workspaceId: document.workspaceId ?? undefined,
      metadata: {
        documentId: document.id,
        name: document.name,
        type: document.contentType,
      },
    });

    return apiSuccess({
      documentId,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Failed to delete document',
      500
    );
  }
}
