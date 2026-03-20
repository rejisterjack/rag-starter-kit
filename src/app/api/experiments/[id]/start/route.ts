import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageWorkspace } from '@/lib/workspace/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/experiments/[id]/start
 * Start an experiment (transition from DRAFT to RUNNING)
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

    // Only allow starting from DRAFT or PAUSED status
    if (experiment.status !== 'DRAFT' && experiment.status !== 'PAUSED') {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot start experiment from ${experiment.status} status`,
          },
        },
        { status: 409 }
      );
    }

    // Update experiment to RUNNING
    const updatedExperiment = await prisma.experiment.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startDate: experiment.startDate ?? new Date(),
        endDate: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        experiment: {
          id: updatedExperiment.id,
          name: updatedExperiment.name,
          status: updatedExperiment.status,
          startDate: updatedExperiment.startDate?.toISOString() ?? null,
          endDate: updatedExperiment.endDate?.toISOString() ?? null,
          updatedAt: updatedExperiment.updatedAt.toISOString(),
        },
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to start experiment' } },
      { status: 500 }
    );
  }
}
