import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { canManageWorkspace } from '@/lib/workspace/permissions';

interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
}

interface TrafficAllocation {
  [variantId: string]: number;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/experiments/[id]
 * Get a specific experiment
 */
export async function GET(_req: Request, { params }: RouteParams) {
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

    // Check if user has access to workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: experiment.workspaceId,
        userId: session.user.id,
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get event count
    const eventCount = await prisma.experimentEvent.count({
      where: { experimentId: id },
    });

    return NextResponse.json({
      success: true,
      data: {
        experiment: {
          id: experiment.id,
          name: experiment.name,
          description: experiment.description,
          type: experiment.type,
          status: experiment.status,
          variants: experiment.variants as unknown as ExperimentVariant[],
          trafficAllocation: experiment.trafficAllocation as unknown as TrafficAllocation,
          workspaceId: experiment.workspaceId,
          createdById: experiment.createdById,
          startDate: experiment.startDate?.toISOString() ?? null,
          endDate: experiment.endDate?.toISOString() ?? null,
          eventCount,
          createdAt: experiment.createdAt.toISOString(),
          updatedAt: experiment.updatedAt.toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to get experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get experiment' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/experiments/[id]
 * Update an experiment (only allowed when in DRAFT status)
 */
export async function PATCH(req: Request, { params }: RouteParams) {
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

    // Only allow updates when in DRAFT status
    if (experiment.status !== 'DRAFT') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Can only update experiments in DRAFT status' } },
        { status: 409 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in update experiment request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput: ReturnType<typeof validateUpdateExperimentInput>;
    try {
      validatedInput = validateUpdateExperimentInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      variants?: object[];
      trafficAllocation?: object;
    } = {};

    if (validatedInput.name !== undefined) {
      updateData.name = validatedInput.name;
    }
    if (validatedInput.description !== undefined) {
      updateData.description = validatedInput.description ?? null;
    }
    if (validatedInput.variants !== undefined) {
      updateData.variants = validatedInput.variants as unknown as object[];
    }
    if (validatedInput.trafficAllocation !== undefined) {
      updateData.trafficAllocation = validatedInput.trafficAllocation as unknown as object;
    }

    // Update experiment
    const updatedExperiment = await prisma.experiment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        experiment: {
          id: updatedExperiment.id,
          name: updatedExperiment.name,
          description: updatedExperiment.description,
          type: updatedExperiment.type,
          status: updatedExperiment.status,
          variants: updatedExperiment.variants as unknown as ExperimentVariant[],
          trafficAllocation: updatedExperiment.trafficAllocation as unknown as TrafficAllocation,
          workspaceId: updatedExperiment.workspaceId,
          createdById: updatedExperiment.createdById,
          startDate: updatedExperiment.startDate?.toISOString() ?? null,
          endDate: updatedExperiment.endDate?.toISOString() ?? null,
          createdAt: updatedExperiment.createdAt.toISOString(),
          updatedAt: updatedExperiment.updatedAt.toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to update experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update experiment' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/experiments/[id]
 * Delete an experiment
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
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

    // Delete experiment (cascade will delete events)
    await prisma.experiment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Experiment deleted successfully' },
    });
  } catch (error: unknown) {
    logger.error('Failed to delete experiment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete experiment' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// Validation
// =============================================================================

interface UpdateExperimentInput {
  name?: string;
  description?: string | null;
  variants?: ExperimentVariant[];
  trafficAllocation?: TrafficAllocation;
}

/**
 * Validate update experiment input
 */
function validateUpdateExperimentInput(body: unknown): UpdateExperimentInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;
  const result: UpdateExperimentInput = {};

  // Validate name
  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 200) {
      throw new Error('Invalid name: must be a string between 1 and 200 characters');
    }
    result.name = input.name;
  }

  // Validate description
  if ('description' in input) {
    if (
      input.description !== null &&
      (typeof input.description !== 'string' || input.description.length > 1000)
    ) {
      throw new Error('Invalid description: must be a string with max 1000 characters or null');
    }
    result.description = input.description ?? undefined;
  }

  // Validate variants
  if ('variants' in input) {
    if (!Array.isArray(input.variants) || input.variants.length < 2) {
      throw new Error('Invalid variants: must be an array with at least 2 variants');
    }

    for (const variant of input.variants) {
      if (!variant || typeof variant !== 'object') {
        throw new Error('Invalid variant: each variant must be an object');
      }
      const v = variant as Record<string, unknown>;
      if (typeof v.id !== 'string' || v.id.length < 1) {
        throw new Error('Invalid variant: id is required and must be a non-empty string');
      }
      if (typeof v.name !== 'string' || v.name.length < 1) {
        throw new Error('Invalid variant: name is required and must be a non-empty string');
      }
    }
    result.variants = input.variants as ExperimentVariant[];
  }

  // Validate trafficAllocation
  if ('trafficAllocation' in input) {
    if (!input.trafficAllocation || typeof input.trafficAllocation !== 'object') {
      throw new Error('Invalid trafficAllocation: must be an object');
    }

    const trafficAllocation = input.trafficAllocation as Record<string, unknown>;

    // If variants are also being updated, validate against new variants
    const variantIds = result.variants
      ? result.variants.map((v) => v.id)
      : Object.keys(trafficAllocation);

    let totalAllocation = 0;

    for (const variantId of variantIds) {
      if (!(variantId in trafficAllocation)) {
        throw new Error(`Invalid trafficAllocation: missing allocation for variant ${variantId}`);
      }
      const allocation = trafficAllocation[variantId];
      if (typeof allocation !== 'number' || allocation < 0 || allocation > 100) {
        throw new Error(
          `Invalid trafficAllocation: ${variantId} must be a number between 0 and 100`
        );
      }
      totalAllocation += allocation;
    }

    // Allow small floating point errors
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error('Invalid trafficAllocation: allocations must sum to 100');
    }

    result.trafficAllocation = input.trafficAllocation as TrafficAllocation;
  }

  return result;
}
