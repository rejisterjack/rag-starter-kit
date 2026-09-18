/**
 * Admin Jobs API
 *
 * GET /api/admin/jobs — List ingestion jobs for the admin dashboard
 */

import { apiError, apiSuccess } from '@/lib/api-response';
import { withApiAuth } from '@/lib/auth';
import { prismaRead } from '@/lib/db';
export const GET = withApiAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where =
      status && status !== 'all'
        ? { status: status as 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' }
        : {};

    const jobs = await prismaRead.ingestionJob.findMany({
      where,
      include: {
        document: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const result = jobs.map((job) => ({
      id: job.id,
      documentId: job.documentId,
      documentName: job.document.name,
      status: job.status,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      durationMs:
        job.startedAt && job.completedAt
          ? job.completedAt.getTime() - job.startedAt.getTime()
          : null,
    }));

    return apiSuccess({ jobs: result });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Internal server error',
      500
    );
  }
});
