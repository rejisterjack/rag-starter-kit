import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { canManageWorkspace } from '@/lib/workspace/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/experiments/[id]/pause
 * Pause a running experiment
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const experiment = await prisma.experiment.findUnique({
      where: { id },
    });

    if (!experiment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Experiment not found' } },
        { status: 404 }
      );
    }

    // Check if user can manage workspace
    const canManage = await canManageWorkspace(session.user.id, experiment.workspaceId);
    if (!canManage) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Only allow pausing from RUNNING status
    if (experiment.status !== 'RUNNING') {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot pause experiment from ${experiment.status} status`,
          },
        },
        { status: 409 }
      );
    }

    // Update experiment to PAUSED
    const updatedExperiment = await prisma.experiment.update({
      where: { id },
      data: {
        status: 'PAUSED',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        experiment: {
          id: updatedExperiment.id,
          name: updatedExperiment.name,
          status: updatedExperiment.status,
          updatedAt: updatedExperiment.updatedAt.toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to pause experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to pause experiment' } },
      { status: 500 }
    );
  }
}
