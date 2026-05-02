/**
 * Export Chat API Route
 * POST: Export a single chat to the specified format
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
// ExportFormat type used via zod schema validation
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { ExportServiceError, getExportService } from '@/lib/export';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// Validation Schema
// =============================================================================

const exportRequestSchema = z.object({
  chatId: z.string().min(1),
  format: z.enum(['pdf', 'word', 'markdown']).default('pdf'),
  includeCitations: z.boolean().default(true),
  citationStyle: z.enum(['inline-numbered', 'footnotes', 'harvard', 'apa', 'endnotes']).optional(),
  includeMetadata: z.boolean().default(true),
  includeSources: z.boolean().default(true),
  watermark: z.boolean().default(false),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  includeTableOfContents: z.boolean().default(false),
  pageSize: z.enum(['A4', 'Letter', 'Legal']).optional(),
  language: z.string().optional(),
});

// =============================================================================
// POST Handler
// =============================================================================

export const POST = withApiAuth(async (req, session) => {
  try {
    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in export chat request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Validate request
    const validationResult = exportRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check workspace permission
    if (workspaceId) {
      const hasPermission = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);

      if (!hasPermission) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'export_chat',
            chatId: data.chatId,
            format: data.format,
          },
          severity: 'WARNING',
        });

        return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
      }
    }

    // Start export
    const exportService = getExportService();
    const result = await exportService.exportChat(
      data.chatId,
      {
        format: data.format,
        includeCitations: data.includeCitations,
        citationStyle: data.citationStyle,
        includeMetadata: data.includeMetadata,
        includeSources: data.includeSources,
        watermark: data.watermark,
        headerText: data.headerText,
        footerText: data.footerText,
        includeTableOfContents: data.includeTableOfContents,
        pageSize: data.pageSize,
        language: data.language,
      },
      userId,
      workspaceId ?? undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: 'Export failed', code: 'EXPORT_FAILED' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: result.jobId,
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt?.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ExportServiceError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        RATE_LIMIT: 429,
        VALIDATION_ERROR: 400,
      };

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// GET Handler - Get export job status
// =============================================================================

export const GET = withApiAuth(async (req, session) => {
  try {
    const userId = session.user.id;

    // Get job ID from query params
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required', code: 'MISSING_JOB_ID' },
        { status: 400 }
      );
    }

    // Get job status
    const exportService = getExportService();
    const job = exportService.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        totalItems: job.totalItems,
        processedItems: job.processedItems,
        downloadUrl: job.downloadUrl,
        fileSize: job.fileSize,
        expiresAt: job.expiresAt.toISOString(),
        error: job.error,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to get export job status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE Handler - Cancel export job
// =============================================================================

export const DELETE = withApiAuth(async (req, session) => {
  try {
    const userId = session.user.id;

    // Get job ID from query params
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required', code: 'MISSING_JOB_ID' },
        { status: 400 }
      );
    }

    // Get job
    const exportService = getExportService();
    const job = exportService.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Cancel job
    const cancelled = await exportService.cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Cannot cancel completed or failed job', code: 'INVALID_STATE' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Export cancelled' },
    });
  } catch (error: unknown) {
    logger.error('Failed to cancel export job', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
});
