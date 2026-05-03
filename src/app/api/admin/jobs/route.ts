/**
 * Admin Jobs API
 *
 * GET /api/admin/jobs — List ingestion jobs for the admin dashboard
 */

import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth';
import { prismaRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({ jobs: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
});
