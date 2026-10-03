import { apiError, apiSuccess } from '@/lib/api-response';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
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
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;

    const experiment = await prisma.experiment.findUnique({
      where: { id },
    });

    if (!experiment) {
      return apiError('NOT_FOUND', 'Experiment not found', 404);
    }

    // Check if user can manage workspace
    const canManage = await canManageWorkspace(session.user.id, experiment.workspaceId);
    if (!canManage) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Only allow starting from DRAFT or PAUSED status
    if (experiment.status !== 'DRAFT' && experiment.status !== 'PAUSED') {
      return apiError('CONFLICT', `Cannot start experiment from ${experiment.status} status`, 409);
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

    return apiSuccess({
      experiment: {
        id: updatedExperiment.id,
        name: updatedExperiment.name,
        status: updatedExperiment.status,
        startDate: updatedExperiment.startDate?.toISOString() ?? null,
        endDate: updatedExperiment.endDate?.toISOString() ?? null,
        updatedAt: updatedExperiment.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to start experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to start experiment', 500);
  }
}
