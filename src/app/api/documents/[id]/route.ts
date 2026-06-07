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
import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { fromJson } from '@/lib/db/json';
import {
  ConcurrentModificationError,
  extractVersion,
  updateWithVersion,
} from '@/lib/db/optimistic-locking';
import { logger } from '@/lib/logger';
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

export const GET = withApiAuth(
  async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const userId = session.user.id;
      const { id: documentId } = await params;

      // Step 2: Fetch document with ingestion job
      const document = await prismaRead.document.findUnique({
        where: { id: documentId },
        include: {
          ingestionJob: {
            select: {
              status: true,
              progress: true,
              error: true,
              errorCategory: true,
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

      // B2: Cache response for completed documents (reduce polling DB hits)
      const cacheControl =
        document.status === 'COMPLETED'
          ? 'private, max-age=30, stale-while-revalidate=60'
          : 'no-cache';

      // Step 4: Fetch chunk stats from Qdrant and format response
      const metadata = fromJson<Record<string, unknown>>(document.metadata, {});
      const chunkCount = document.chunkCount;

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
        chunkCount,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        content: document.content,
        errorMessage:
          document.ingestionJob?.error ||
          (typeof metadata.error === 'string' ? metadata.error : undefined),
        errorCategory: document.ingestionJob?.errorCategory ?? undefined,
        metadata: {
          ...metadata,
          sourceUrl: document.sourceUrl,
          ocrProcessed: document.ocrProcessed,
          ocrConfidence: document.ocrConfidence,
          ocrLanguage: document.ocrLanguage,
        },
        chunks: [],
        jobStatus: document.ingestionJob
          ? {
              status: document.ingestionJob.status,
              progress: document.ingestionJob.progress,
              startedAt: document.ingestionJob.startedAt?.toISOString(),
              completedAt: document.ingestionJob.completedAt?.toISOString(),
            }
          : null,
      };

      return NextResponse.json(
        {
          success: true,
          data: formattedDocument,
        },
        {
          headers: { 'Cache-Control': cacheControl },
        }
      );
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
);

// =============================================================================
// PATCH /api/documents/[id] - Update Document Metadata
// =============================================================================

export const PATCH = withApiAuth(
  async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const userId = session.user.id;
      const { id: documentId } = await params;

      // Step 2: Parse request body
      let body: { name?: string; metadata?: Record<string, unknown> };
      try {
        body = await req.json();
      } catch (error: unknown) {
        logger.debug('Failed to parse request body for document update', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
        const currentMetadata = fromJson<Record<string, unknown>>(document.metadata, {});
        updateData.metadata = { ...currentMetadata, ...body.metadata };
      }

      // Step 6: Update document (with optimistic locking if If-Match provided)
      let updatedDocument: Record<string, unknown>;
      const expectedVersion = extractVersion(req.headers);
      try {
        if (expectedVersion !== null) {
          updatedDocument = await updateWithVersion(
            'document',
            documentId,
            updateData,
            expectedVersion
          );
        } else {
          updatedDocument = await prisma.document.update({
            where: { id: documentId },
            data: updateData,
          });
        }
      } catch (e) {
        if (e instanceof ConcurrentModificationError) {
          return NextResponse.json(
            { success: false, error: { code: 'CONFLICT', message: e.message } },
            { status: 409 }
          );
        }
        throw e;
      }

      const result = updatedDocument;
      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          name: result.name,
          version: result.version,
          updatedAt: (result.updatedAt as Date).toISOString(),
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
);
