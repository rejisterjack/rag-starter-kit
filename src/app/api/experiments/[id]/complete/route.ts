import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { canManageWorkspace } from '@/lib/workspace/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/experiments/[id]/complete
 * Complete an experiment (transition to COMPLETED)
 */
export async function POST(req: Request, { params }: RouteParams) {
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

    // Only allow completing from RUNNING or PAUSED status
    if (experiment.status !== 'RUNNING' && experiment.status !== 'PAUSED') {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot complete experiment from ${experiment.status} status`,
          },
        },
        { status: 409 }
      );
    }

    // Parse optional winner variant from body
    let winnerVariantId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body === 'object' && 'winnerVariantId' in body) {
        winnerVariantId = body.winnerVariantId;
      }
    } catch (error: unknown) {
      logger.debug('No body or invalid JSON in complete experiment request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Validate winner variant if provided
    if (winnerVariantId) {
      const variants = experiment.variants as Array<{ id: string; name: string }>;
      const validVariant = variants.find((v) => v.id === winnerVariantId);
      if (!validVariant) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid winnerVariantId: not a valid variant for this experiment',
            },
          },
          { status: 400 }
        );
      }
    }

    // Update experiment to COMPLETED
    const updatedExperiment = await prisma.experiment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
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
          ...(winnerVariantId && { winnerVariantId }),
          updatedAt: updatedExperiment.updatedAt.toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to complete experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to complete experiment' } },
      { status: 500 }
    );
  }
}
