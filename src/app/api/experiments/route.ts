import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageWorkspace } from '@/lib/workspace/permissions';

// Valid experiment types and statuses
const VALID_EXPERIMENT_TYPES = ['prompt', 'model', 'retrieval', 'ui'] as const;
const VALID_EXPERIMENT_STATUSES = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'] as const;

type ExperimentType = (typeof VALID_EXPERIMENT_TYPES)[number];
type ExperimentStatus = (typeof VALID_EXPERIMENT_STATUSES)[number];

interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
}

interface TrafficAllocation {
  [variantId: string]: number;
}

/**
 * GET /api/experiments
 * Get all experiments for the current user's workspace with pagination
 * Query params: workspaceId (required), page (default: 1), limit (default: 20, max: 100), status (optional)
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status') as ExperimentStatus | null;

    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'workspaceId is required' } },
        { status: 400 }
      );
    }

    // Check if user has access to workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
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

    // Build where clause
    const where: {
      workspaceId: string;
      status?: ExperimentStatus;
    } = { workspaceId };

    if (status && VALID_EXPERIMENT_STATUSES.includes(status)) {
      where.status = status;
    }

    // Get total count for pagination
    const total = await prisma.experiment.count({ where });

    // Get experiments with event count
    const experiments = await prisma.experiment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get event counts for each experiment
    const experimentIds = experiments.map((e) => e.id);
    const eventCounts = await prisma.experimentEvent.groupBy({
      by: ['experimentId'],
      where: { experimentId: { in: experimentIds } },
      _count: { id: true },
    });

    const eventCountMap = new Map(eventCounts.map((ec) => [ec.experimentId, ec._count.id]));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        experiments: experiments.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          status: e.status,
          variants: e.variants as unknown as ExperimentVariant[],
          trafficAllocation: e.trafficAllocation as unknown as TrafficAllocation,
          workspaceId: e.workspaceId,
          createdById: e.createdById,
          startDate: e.startDate?.toISOString() ?? null,
          endDate: e.endDate?.toISOString() ?? null,
          eventCount: eventCountMap.get(e.id) ?? 0,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get experiments' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/experiments
 * Create a new experiment
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput: ReturnType<typeof validateCreateExperimentInput>;
    try {
      validatedInput = validateCreateExperimentInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check if user can manage workspace
    const canManage = await canManageWorkspace(session.user.id, validatedInput.workspaceId);
    if (!canManage) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Create experiment
    const experiment = await prisma.experiment.create({
      data: {
        name: validatedInput.name,
        description: validatedInput.description,
        type: validatedInput.type,
        status: 'DRAFT',
        variants: validatedInput.variants as unknown as object[],
        trafficAllocation: validatedInput.trafficAllocation as unknown as object,
        workspaceId: validatedInput.workspaceId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(
      {
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
            startDate: null,
            endDate: null,
            createdAt: experiment.createdAt.toISOString(),
            updatedAt: experiment.updatedAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Workspace not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create experiment' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// Validation
// =============================================================================

interface CreateExperimentInput {
  name: string;
  description?: string;
  type: ExperimentType;
  workspaceId: string;
  variants: ExperimentVariant[];
  trafficAllocation: TrafficAllocation;
}

/**
 * Validate create experiment input
 */
function validateCreateExperimentInput(body: unknown): CreateExperimentInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;

  // Validate name
  if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 200) {
    throw new Error('Invalid name: must be a string between 1 and 200 characters');
  }

  // Validate description (optional)
  if ('description' in input && input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string' || input.description.length > 1000) {
      throw new Error('Invalid description: must be a string with max 1000 characters');
    }
  }

  // Validate type
  if (!VALID_EXPERIMENT_TYPES.includes(input.type as ExperimentType)) {
    throw new Error(`Invalid type: must be one of ${VALID_EXPERIMENT_TYPES.join(', ')}`);
  }

  // Validate workspaceId
  if (typeof input.workspaceId !== 'string' || input.workspaceId.length < 1) {
    throw new Error('Invalid workspaceId: must be a non-empty string');
  }

  // Validate variants
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

  // Validate trafficAllocation
  if (!input.trafficAllocation || typeof input.trafficAllocation !== 'object') {
    throw new Error('Invalid trafficAllocation: must be an object');
  }

  const trafficAllocation = input.trafficAllocation as Record<string, unknown>;
  const variantIds = input.variants.map((v: Record<string, unknown>) => v.id as string);
  let totalAllocation = 0;

  for (const variantId of variantIds) {
    if (!(variantId in trafficAllocation)) {
      throw new Error(`Invalid trafficAllocation: missing allocation for variant ${variantId}`);
    }
    const allocation = trafficAllocation[variantId];
    if (typeof allocation !== 'number' || allocation < 0 || allocation > 100) {
      throw new Error(`Invalid trafficAllocation: ${variantId} must be a number between 0 and 100`);
    }
    totalAllocation += allocation;
  }

  // Allow small floating point errors
  if (Math.abs(totalAllocation - 100) > 0.01) {
    throw new Error('Invalid trafficAllocation: allocations must sum to 100');
  }

  return {
    name: input.name,
    description: (input.description as string) ?? undefined,
    type: input.type as ExperimentType,
    workspaceId: input.workspaceId,
    variants: input.variants as ExperimentVariant[],
    trafficAllocation: input.trafficAllocation as TrafficAllocation,
  };
}
