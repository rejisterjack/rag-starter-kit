/**
 * Document Detail API Route
 *
 * GET /api/documents/[id] - Get document details with chunks
 * PATCH /api/documents/[id] - Update document metadata
 *
 * Security Features:
 * - Authentication check
 * - Workspace access validation
 * - Rate limiting
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// Document status mapping from DB to UI
const STATUS_MAP: Record<string, 'pending' | 'processing' | 'completed' | 'error'> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'error',
};

// =============================================================================
// GET /api/documents/[id] - Get Document Details with Chunks
// =============================================================================

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id: documentId } = await params;

    // Step 2: Fetch document with chunks
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {
          orderBy: { index: 'asc' },
          select: {
            id: true,
            content: true,
            index: true,
            start: true,
            end: true,
            page: true,
            section: true,
          },
        },
        ingestionJob: {
          select: {
            status: true,
            progress: true,
            error: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    // Step 3: Check access permissions
    const hasDirectAccess = document.userId === userId;
    const hasWorkspaceAccess =
      document.workspaceId &&
      (await checkPermission(userId, document.workspaceId, Permission.READ_DOCUMENTS));

    if (!hasDirectAccess && !hasWorkspaceAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Step 4: Format response
    const metadata = (document.metadata as Record<string, unknown>) || {};
    const formattedDocument = {
      id: document.id,
      name: document.name,
      type:
        document.contentType === 'URL'
          ? 'text/html'
          : `application/${document.contentType.toLowerCase()}`,
      size: document.size,
      status: STATUS_MAP[document.status] || 'pending',
      progress: document.ingestionJob?.progress,
      chunkCount: document.chunks.length,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      content: document.content,
      errorMessage: document.ingestionJob?.error || (metadata.error as string) || undefined,
      metadata: {
        ...metadata,
        sourceUrl: document.sourceUrl,
        ocrProcessed: document.ocrProcessed,
        ocrConfidence: document.ocrConfidence,
        ocrLanguage: document.ocrLanguage,
      },
      chunks: document.chunks.map((chunk) => ({
        id: chunk.id,
        index: chunk.index,
        text: chunk.content,
        start: chunk.start,
        end: chunk.end,
        page: chunk.page,
        section: chunk.section,
      })),
      jobStatus: document.ingestionJob
        ? {
            status: document.ingestionJob.status,
            progress: document.ingestionJob.progress,
            startedAt: document.ingestionJob.startedAt?.toISOString(),
            completedAt: document.ingestionJob.completedAt?.toISOString(),
          }
        : null,
    };

    return NextResponse.json({
      success: true,
      data: formattedDocument,
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
// PATCH /api/documents/[id] - Update Document Metadata
// =============================================================================

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id: documentId } = await params;

    // Step 2: Parse request body
    let body: { name?: string; metadata?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
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
      (await checkPermission(userId, document.workspaceId, Permission.WRITE_DOCUMENTS));

    if (!hasDirectAccess && !hasWorkspaceAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Step 5: Build update data
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.metadata !== undefined) {
      const currentMetadata = (document.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...currentMetadata, ...body.metadata };
    }

    // Step 6: Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        updatedAt: updatedDocument.updatedAt.toISOString(),
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
