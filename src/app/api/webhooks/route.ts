import { apiError, apiSuccess } from '@/lib/api-response';

import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateUrlSafety } from '@/lib/security/ssrf-protection';
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

async function validateCreateWebhookInput(body: unknown): Promise<CreateWebhookInput> {
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

  // SSRF protection — block private/internal URLs
  try {
    const ssrfResult = await validateUrlSafety(input.url);
    if (!ssrfResult.safe) {
      throw new Error(`Invalid url: ${ssrfResult.reason || 'URL is not allowed'}`);
    }
  } catch (error: unknown) {
    logger.warn('SSRF validation failed for webhook URL', {
      url: input.url,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid url: could not verify URL safety');
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
      return apiError('BAD_REQUEST', 'workspaceId query parameter is required', 400);
    }

    // Check if user has permission to manage webhooks in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_WEBHOOKS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
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

    return apiSuccess({
      webhooks: webhooks.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
        lastTriggeredAt: w.lastTriggeredAt?.toISOString() ?? null,
      })),
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

    return apiError('INTERNAL_ERROR', 'Failed to get webhooks', 500);
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
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    let validatedInput: CreateWebhookInput;
    const isDev = process.env.NODE_ENV === 'development';
    try {
      validatedInput = await validateCreateWebhookInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return apiError('VALIDATION_ERROR', isDev ? error.message : 'Validation failed', 400);
      }
      throw error;
    }

    // Check if user has permission to manage webhooks in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      validatedInput.workspaceId,
      Permission.MANAGE_WEBHOOKS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Check if webhook with same URL already exists in workspace
    const existingWebhook = await prisma.webhook.findFirst({
      where: {
        workspaceId: validatedInput.workspaceId,
        url: validatedInput.url,
      },
    });

    if (existingWebhook) {
      return apiError(
        'DUPLICATE_WEBHOOK',
        'A webhook with this URL already exists in the workspace',
        409
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

    return apiSuccess(
      {
        webhook: {
          ...webhook,
          createdAt: webhook.createdAt.toISOString(),
          updatedAt: webhook.updatedAt.toISOString(),
          lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() ?? null,
        },
      },
      201
    );
  } catch (error) {
    logger.error('Failed to create webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError('INTERNAL_ERROR', 'Failed to create webhook', 500);
  }
});
