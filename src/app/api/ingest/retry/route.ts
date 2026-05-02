/**
 * Document Ingestion Retry API
 *
 * POST /api/ingest/retry - Retry a failed document ingestion
 *
 * Security Features:
 * - Authentication check
 * - Workspace access validation
 * - Rate limiting
 * - Audit logging
 */

import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/logger';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

export const POST = withApiAuth(async (req, session) => {
  try {
    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'ingest', {
      userId,
      workspaceId,
      endpoint: '/api/ingest/retry',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded. Please try again later.',
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

    // Step 3: Parse request body
    let body: { documentId?: string };
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body in retry endpoint', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_DOCUMENT_ID', message: 'Document ID is required' },
        },
        { status: 400 }
      );
    }

    // Step 4: Get document and verify access
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId: workspaceId ?? '',
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    // Step 5: Check permission
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.WRITE_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'retry_ingestion',
            documentId,
            requiredPermission: Permission.WRITE_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }
    }

    // Step 6: Check if document can be retried
    if (document.status === 'PROCESSING') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_PROCESSING',
            message: 'Document is already being processed',
          },
        },
        { status: 409 }
      );
    }

    // Step 7: Reset document status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PENDING',
        metadata: {
          ...((document.metadata as Record<string, unknown>) ?? {}),
          retriedAt: new Date().toISOString(),
          previousStatus: document.status,
        },
      },
    });

    // Step 8: Delete existing ingestion job if any
    await prisma.ingestionJob.deleteMany({
      where: { documentId },
    });

    // Step 9: Trigger new ingestion via Inngest
    await inngest.send({
      name: 'document/ingest',
      data: { documentId, userId },
    });

    // Step 10: Log audit event
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_UPLOADED,
      userId,
      workspaceId: workspaceId ?? undefined,
      metadata: {
        documentId,
        action: 'retry',
        previousStatus: document.status,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        documentId,
        status: 'PENDING',
        message: 'Document ingestion retry queued successfully',
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error: unknown) {
    logger.error('Failed to retry document ingestion', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retry document ingestion',
        },
      },
      { status: 500 }
    );
  }
});
