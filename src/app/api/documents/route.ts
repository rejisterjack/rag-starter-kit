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

import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
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
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
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

    // Step 3: Parse query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const workspaceIdFilter = searchParams.get('workspaceId') || workspaceId;
    const limit = parseInt(searchParams.get('limit') ?? '100', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    // Step 4: Validate workspace access if filtering by workspace
    if (workspaceIdFilter) {
      const hasAccess = await checkPermission(userId, workspaceIdFilter, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId: workspaceIdFilter,
          metadata: {
            action: 'list_documents',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } },
          { status: 403 }
        );
      }
    }

    // Step 5: Build query filters
    const where: Record<string, unknown> = {};

    // Filter by workspace or user
    if (workspaceIdFilter) {
      where.workspaceId = workspaceIdFilter;
    } else {
      // Get user's personal documents and workspace documents
      where.OR = [{ userId }, { workspaceId: workspaceId ?? null }];
    }

    // Filter by status if provided
    if (status) {
      where.status = status.toUpperCase();
    }

    // Step 6: Fetch documents
    const documents = await prisma.document.findMany({
      where,
      include: {
        chunks: { select: { id: true } },
        ingestionJob: { select: { progress: true, error: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Step 7: Format response
    const formattedDocuments = documents.map((doc) => {
      const metadata = (doc.metadata as Record<string, unknown>) || {};
      return {
        id: doc.id,
        name: doc.name,
        type:
          doc.contentType === 'URL' ? 'text/html' : `application/${doc.contentType.toLowerCase()}`,
        size: doc.size,
        status: STATUS_MAP[doc.status] || 'pending',
        progress: doc.ingestionJob?.progress,
        chunkCount: doc.chunks.length,
        createdAt: doc.createdAt.toISOString(),
        errorMessage: doc.ingestionJob?.error || (metadata.error as string) || undefined,
      };
    });

    // Step 8: Get total count for pagination
    const totalCount = await prisma.document.count({ where });

    // Step 9: Return response
    const response = NextResponse.json({
      success: true,
      data: {
        documents: formattedDocuments,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + documents.length < totalCount,
        },
      },
    });

    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
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
// DELETE /api/documents - Delete Document
// =============================================================================

export async function DELETE(req: NextRequest) {
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

    // Step 2: Parse query parameters
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Document ID is required' } },
        { status: 400 }
      );
    }

    // Step 3: Fetch document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    // Step 4: Check access permissions
    const hasDirectAccess = document.userId === userId;
    const hasWorkspaceAccess =
      document.workspaceId &&
      (await checkPermission(userId, document.workspaceId, Permission.DELETE_DOCUMENTS));

    if (!hasDirectAccess && !hasWorkspaceAccess) {
      await logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        userId,
        workspaceId: document.workspaceId ?? undefined,
        metadata: {
          action: 'delete_document',
          documentId,
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Step 5: Delete document (cascade will handle chunks)
    await prisma.document.delete({
      where: { id: documentId },
    });

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

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        message: 'Document deleted successfully',
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
