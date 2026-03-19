/**
 * Bulk Export Conversations API Route
 * POST: Export multiple conversations to a ZIP file
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getExportService, ExportServiceError } from '@/lib/export';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { z } from 'zod';

// =============================================================================
// Validation Schema
// =============================================================================

const bulkExportRequestSchema = z.object({
  // Filters
  chatIds: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  searchQuery: z.string().optional(),

  // Export options
  format: z.enum(['pdf', 'word', 'markdown']).default('pdf'),
  includeCitations: z.boolean().default(true),
  citationStyle: z.enum(['inline-numbered', 'footnotes', 'harvard', 'apa', 'endnotes']).optional(),
  includeMetadata: z.boolean().default(true),
  includeSources: z.boolean().default(true),
  watermark: z.boolean().default(false),
  includeTableOfContents: z.boolean().default(false),
  pageSize: z.enum(['A4', 'Letter', 'Legal']).optional(),
  language: z.string().optional(),
});

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Validate request
    const validationResult = bulkExportRequestSchema.safeParse(body);
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

    // Check workspace permission if exporting workspace data
    if (data.workspaceId || workspaceId) {
      const targetWorkspaceId = data.workspaceId ?? workspaceId;

      if (targetWorkspaceId) {
        const hasPermission = await checkPermission(
          userId,
          targetWorkspaceId,
          Permission.READ_DOCUMENTS
        );

        if (!hasPermission) {
          await logAuditEvent({
            event: AuditEvent.PERMISSION_DENIED,
            userId,
            workspaceId: targetWorkspaceId,
            metadata: {
              action: 'bulk_export',
              format: data.format,
            },
            severity: 'WARNING',
          });

          return NextResponse.json(
            { error: 'Access denied to workspace', code: 'FORBIDDEN' },
            { status: 403 }
          );
        }
      }
    }

    // Start bulk export
    const exportService = getExportService();
    const result = await exportService.exportConversations(
      {
        format: data.format,
        chatIds: data.chatIds,
        workspaceId: data.workspaceId,
        dateRange: data.dateRange
          ? {
              start: new Date(data.dateRange.start),
              end: new Date(data.dateRange.end),
            }
          : undefined,
        searchQuery: data.searchQuery,
        includeCitations: data.includeCitations,
        citationStyle: data.citationStyle,
        includeMetadata: data.includeMetadata,
        includeSources: data.includeSources,
        watermark: data.watermark,
        includeTableOfContents: data.includeTableOfContents,
        pageSize: data.pageSize,
        language: data.language,
      },
      userId,
      workspaceId ?? undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Export failed', code: 'EXPORT_FAILED' },
        { status: 500 }
      );
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
    console.error('Bulk export error:', error);

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
}

// =============================================================================
// GET Handler - Get bulk export job status
// =============================================================================

export async function GET(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get job ID from query params
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      // List user's export jobs
      const exportService = getExportService();
      const jobs = exportService.getUserJobs(userId);

      return NextResponse.json({
        success: true,
        data: {
          jobs: jobs.map((job) => ({
            jobId: job.id,
            status: job.status,
            format: job.format,
            progress: job.progress,
            currentStep: job.currentStep,
            totalItems: job.totalItems,
            processedItems: job.processedItems,
            downloadUrl: job.downloadUrl,
            fileSize: job.fileSize,
            expiresAt: job.expiresAt.toISOString(),
            createdAt: job.createdAt.toISOString(),
          })),
        },
      });
    }

    // Get specific job status
    const exportService = getExportService();
    const job = exportService.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        format: job.format,
        progress: job.progress,
        currentStep: job.currentStep,
        totalItems: job.totalItems,
        processedItems: job.processedItems,
        downloadUrl: job.downloadUrl,
        fileSize: job.fileSize,
        expiresAt: job.expiresAt.toISOString(),
        createdAt: job.createdAt.toISOString(),
        error: job.error,
      },
    });
  } catch (error) {
    console.error('Get bulk export status error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE Handler - Cancel bulk export
// =============================================================================

export async function DELETE(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

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
      return NextResponse.json(
        { error: 'Job not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 }
      );
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
  } catch (error) {
    console.error('Cancel bulk export error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
