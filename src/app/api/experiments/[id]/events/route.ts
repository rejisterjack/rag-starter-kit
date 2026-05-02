import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const VALID_EVENT_TYPES = ['impression', 'conversion', 'custom'] as const;
type EventType = (typeof VALID_EVENT_TYPES)[number];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/experiments/[id]/events
 * Track an event for an experiment
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    // Note: We allow unauthenticated requests for public experiments
    // but we'll track the userId if available
    const userId = session?.user?.id ?? null;

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

    // Only allow events for RUNNING experiments
    if (experiment.status !== 'RUNNING') {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot track events for experiment in ${experiment.status} status`,
          },
        },
        { status: 409 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in track event request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput: ReturnType<typeof validateTrackEventInput>;
    try {
      validatedInput = validateTrackEventInput(
        body,
        experiment.variants as unknown as Array<{ id: string }>
      );
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Create event
    const event = await prisma.experimentEvent.create({
      data: {
        experimentId: id,
        variantId: validatedInput.variantId,
        eventType: validatedInput.eventType,
        userId: validatedInput.userId ?? userId,
        sessionId: validatedInput.sessionId,
        metadata: (validatedInput.metadata as object) ?? {},
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          event: {
            id: event.id,
            experimentId: event.experimentId,
            variantId: event.variantId,
            eventType: event.eventType,
            userId: event.userId,
            sessionId: event.sessionId,
            metadata: event.metadata,
            createdAt: event.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('Failed to track experiment event', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to track event' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// Validation
// =============================================================================

interface TrackEventInput {
  variantId: string;
  eventType: EventType;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Validate track event input
 */
function validateTrackEventInput(body: unknown, variants: Array<{ id: string }>): TrackEventInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;

  // Validate variantId
  if (typeof input.variantId !== 'string' || input.variantId.length < 1) {
    throw new Error('Invalid variantId: must be a non-empty string');
  }

  // Check if variantId is valid for this experiment
  const validVariant = variants.find((v) => v.id === input.variantId);
  if (!validVariant) {
    throw new Error('Invalid variantId: not a valid variant for this experiment');
  }

  // Validate eventType
  if (!VALID_EVENT_TYPES.includes(input.eventType as EventType)) {
    throw new Error(`Invalid eventType: must be one of ${VALID_EVENT_TYPES.join(', ')}`);
  }

  // Validate sessionId (required for tracking unique sessions)
  if (typeof input.sessionId !== 'string' || input.sessionId.length < 1) {
    throw new Error('Invalid sessionId: must be a non-empty string');
  }

  // Validate userId (optional)
  if ('userId' in input && input.userId !== undefined && input.userId !== null) {
    if (typeof input.userId !== 'string' || input.userId.length < 1) {
      throw new Error('Invalid userId: must be a non-empty string');
    }
  }

  // Validate metadata (optional)
  if ('metadata' in input && input.metadata !== undefined && input.metadata !== null) {
    if (typeof input.metadata !== 'object') {
      throw new Error('Invalid metadata: must be an object');
    }
  }

  const result: TrackEventInput = {
    variantId: input.variantId,
    eventType: input.eventType as EventType,
    sessionId: input.sessionId,
  };

  if (input.userId) {
    result.userId = input.userId as string;
  }

  if (input.metadata) {
    result.metadata = input.metadata as Record<string, unknown>;
  }

  return result;
}
