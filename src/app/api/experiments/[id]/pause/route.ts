import { apiError, apiSuccess } from '@/lib/api-response';

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

    // Only allow pausing from RUNNING status
    if (experiment.status !== 'RUNNING') {
      return apiError('CONFLICT', `Cannot pause experiment from ${experiment.status} status`, 409);
    }

    // Update experiment to PAUSED
    const updatedExperiment = await prisma.experiment.update({
      where: { id },
      data: {
        status: 'PAUSED',
      },
    });

    return apiSuccess({
      experiment: {
        id: updatedExperiment.id,
        name: updatedExperiment.name,
        status: updatedExperiment.status,
        updatedAt: updatedExperiment.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to pause experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to pause experiment', 500);
  }
}
