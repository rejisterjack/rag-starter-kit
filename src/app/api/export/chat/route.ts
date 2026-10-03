import { apiError, apiSuccess } from '@/lib/api-response';
/**
 * Export Chat API Route
 * POST: Export a single chat to the specified format
 */

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
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    // Validate request
    const validationResult = exportRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validationResult.error.format()
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

        return apiError('FORBIDDEN', 'Access denied', 403);
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
      return apiError('EXPORT_FAILED', 'Export failed', 500);
    }

    return apiSuccess({
      jobId: result.jobId,
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt?.toISOString(),
    });
  } catch (error) {
    if (error instanceof ExportServiceError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        RATE_LIMIT: 429,
        VALIDATION_ERROR: 400,
      };

      return apiError(error.code, error.message, statusMap[error.code] ?? 500);
    }

    return apiError(
      'INTERNAL_ERROR',
      'Internal server error',
      500,
      error instanceof Error ? error.message : 'Unknown error'
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
      return apiError('MISSING_JOB_ID', 'Job ID is required', 400);
    }

    // Get job status
    const exportService = getExportService();
    const job = exportService.getJobStatus(jobId);

    if (!job) {
      return apiError('NOT_FOUND', 'Job not found', 404);
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    return apiSuccess({
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
    });
  } catch (error: unknown) {
    logger.error('Failed to get export job status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
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
      return apiError('MISSING_JOB_ID', 'Job ID is required', 400);
    }

    // Get job
    const exportService = getExportService();
    const job = exportService.getJobStatus(jobId);

    if (!job) {
      return apiError('NOT_FOUND', 'Job not found', 404);
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Cancel job
    const cancelled = await exportService.cancelJob(jobId);

    if (!cancelled) {
      return apiError('INVALID_STATE', 'Cannot cancel completed or failed job', 400);
    }

    return apiSuccess({ message: 'Export cancelled' });
  } catch (error: unknown) {
    logger.error('Failed to cancel export job', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
  }
});
