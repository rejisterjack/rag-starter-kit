import { apiError, apiSuccess } from '@/lib/api-response';

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

    // Only allow completing from RUNNING or PAUSED status
    if (experiment.status !== 'RUNNING' && experiment.status !== 'PAUSED') {
      return apiError(
        'CONFLICT',
        `Cannot complete experiment from ${experiment.status} status`,
        409
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
        return apiError(
          'VALIDATION_ERROR',
          'Invalid winnerVariantId: not a valid variant for this experiment',
          400
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

    return apiSuccess({
      experiment: {
        id: updatedExperiment.id,
        name: updatedExperiment.name,
        status: updatedExperiment.status,
        startDate: updatedExperiment.startDate?.toISOString() ?? null,
        endDate: updatedExperiment.endDate?.toISOString() ?? null,
        ...(winnerVariantId && { winnerVariantId }),
        updatedAt: updatedExperiment.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to complete experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to complete experiment', 500);
  }
}
