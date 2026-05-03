import { NextResponse } from 'next/server';

import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { logger } from '@/lib/logger';
import { generateWebhookSecret } from '@/lib/webhooks/delivery';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// ============================================================================
// Validation
// ============================================================================

interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  workspaceId: string;
}

function validateCreateWebhookInput(body: unknown): CreateWebhookInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;

  // Validate name
  if (
    !input.name ||
    typeof input.name !== 'string' ||
    input.name.length < 1 ||
    input.name.length > 100
  ) {
    throw new Error('Invalid name: must be a string between 1 and 100 characters');
  }

  // Validate URL
  if (!input.url || typeof input.url !== 'string') {
    throw new Error('Invalid url: must be a valid URL string');
  }

  // Basic URL validation
  try {
    const url = new URL(input.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid url: must use http or https protocol');
    }
  } catch (error: unknown) {
    logger.debug('Invalid URL in webhook creation validation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Invalid url: must be a valid URL');
  }

  // Validate events
  if (!input.events || !Array.isArray(input.events) || input.events.length === 0) {
    throw new Error('Invalid events: must be a non-empty array of event strings');
  }

  for (const event of input.events) {
    if (typeof event !== 'string' || event.length === 0) {
      throw new Error('Invalid events: all events must be non-empty strings');
    }
  }

  // Validate workspaceId
  if (!input.workspaceId || typeof input.workspaceId !== 'string') {
    throw new Error('Invalid workspaceId: must be a string');
  }

  return {
    name: input.name,
    url: input.url,
    events: input.events,
    workspaceId: input.workspaceId,
  };
}

// ============================================================================
// GET /api/webhooks
// ============================================================================

/**
 * GET /api/webhooks
 * Get all webhooks for the current workspace
 * Query params: workspaceId (required), page (default: 1), limit (default: 20, max: 100)
 */
export const GET = withApiAuth(async (req, session) => {
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'workspaceId query parameter is required' } },
        { status: 400 }
      );
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get webhooks with pagination
    const [webhooks, total] = await Promise.all([
      prismaRead.webhook.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          status: true,
          lastTriggeredAt: true,
          failureCount: true,
          createdAt: true,
          updatedAt: true,
          // Don't return the secret
          secret: false,
        },
      }),
      prismaRead.webhook.count({
        where: { workspaceId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        webhooks: webhooks.map((w) => ({
          ...w,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
          lastTriggeredAt: w.lastTriggeredAt?.toISOString() ?? null,
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
  } catch (error) {
    logger.error('Failed to get webhooks', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get webhooks' } },
      { status: 500 }
    );
  }
});

// ============================================================================
// POST /api/webhooks
// ============================================================================

/**
 * POST /api/webhooks
 * Create a new webhook
 */
export const POST = withApiAuth(async (req, session) => {
  try {
    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in webhook creation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput: CreateWebhookInput;
    try {
      validatedInput = validateCreateWebhookInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      validatedInput.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if webhook with same URL already exists in workspace
    const existingWebhook = await prisma.webhook.findFirst({
      where: {
        workspaceId: validatedInput.workspaceId,
        url: validatedInput.url,
      },
    });

    if (existingWebhook) {
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_WEBHOOK',
            message: 'A webhook with this URL already exists in the workspace',
          },
        },
        { status: 409 }
      );
    }

    // Generate secret for the webhook
    const secret = generateWebhookSecret();

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        name: validatedInput.name,
        url: validatedInput.url,
        secret,
        events: validatedInput.events,
        workspaceId: validatedInput.workspaceId,
        createdById: session.user.id,
        status: 'ACTIVE',
        failureCount: 0,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        status: true,
        secret: true, // Include secret only on creation
        lastTriggeredAt: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
        workspaceId: true,
        createdById: true,
      },
    });

    logger.info('Webhook created', {
      webhookId: webhook.id,
      workspaceId: webhook.workspaceId,
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          webhook: {
            ...webhook,
            createdAt: webhook.createdAt.toISOString(),
            updatedAt: webhook.updatedAt.toISOString(),
            lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() ?? null,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' } },
      { status: 500 }
    );
  }
});
