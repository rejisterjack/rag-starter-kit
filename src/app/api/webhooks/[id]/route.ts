import type { WebhookStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// ============================================================================
// Types & Validation
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  status?: WebhookStatus;
}

function validateUpdateWebhookInput(body: unknown): UpdateWebhookInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;
  const result: UpdateWebhookInput = {};

  // Validate name (optional)
  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 100) {
      throw new Error('Invalid name: must be a string between 1 and 100 characters');
    }
    result.name = input.name;
  }

  // Validate URL (optional)
  if ('url' in input) {
    if (typeof input.url !== 'string') {
      throw new Error('Invalid url: must be a valid URL string');
    }

    // Basic URL validation
    try {
      const url = new URL(input.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid url: must use http or https protocol');
      }
    } catch {
      throw new Error('Invalid url: must be a valid URL');
    }

    result.url = input.url;
  }

  // Validate events (optional)
  if ('events' in input) {
    if (!Array.isArray(input.events) || input.events.length === 0) {
      throw new Error('Invalid events: must be a non-empty array of event strings');
    }

    for (const event of input.events) {
      if (typeof event !== 'string' || event.length === 0) {
        throw new Error('Invalid events: all events must be non-empty strings');
      }
    }

    result.events = input.events;
  }

  // Validate status (optional)
  if ('status' in input) {
    if (!['ACTIVE', 'PAUSED', 'FAILED'].includes(input.status as string)) {
      throw new Error('Invalid status: must be one of ACTIVE, PAUSED, or FAILED');
    }
    result.status = input.status as WebhookStatus;
  }

  return result;
}

// ============================================================================
// GET /api/webhooks/[id]
// ============================================================================

/**
 * GET /api/webhooks/[id]
 * Get a specific webhook
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

    // Get the webhook
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      );
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      webhook.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          status: webhook.status,
          lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() ?? null,
          failureCount: webhook.failureCount,
          createdAt: webhook.createdAt.toISOString(),
          updatedAt: webhook.updatedAt.toISOString(),
          workspaceId: webhook.workspaceId,
          createdById: webhook.createdById,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get webhook' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/webhooks/[id]
// ============================================================================

/**
 * PATCH /api/webhooks/[id]
 * Update a webhook
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

    // Get the webhook to check workspace
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      );
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      existingWebhook.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
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

    let validatedInput: UpdateWebhookInput;
    try {
      validatedInput = validateUpdateWebhookInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check if URL is being changed and if it conflicts with another webhook
    if (validatedInput.url && validatedInput.url !== existingWebhook.url) {
      const duplicateWebhook = await prisma.webhook.findFirst({
        where: {
          workspaceId: existingWebhook.workspaceId,
          url: validatedInput.url,
          id: { not: id },
        },
      });

      if (duplicateWebhook) {
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
    }

    // Update webhook
    const updatedWebhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(validatedInput.name && { name: validatedInput.name }),
        ...(validatedInput.url && { url: validatedInput.url }),
        ...(validatedInput.events && { events: validatedInput.events }),
        ...(validatedInput.status && { status: validatedInput.status }),
        // Reset failure count when reactivating
        ...(validatedInput.status === 'ACTIVE' && { failureCount: 0 }),
      },
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
        workspaceId: true,
        createdById: true,
      },
    });

    logger.info('Webhook updated', {
      webhookId: id,
      workspaceId: updatedWebhook.workspaceId,
      userId: session.user.id,
      updates: validatedInput,
    });

    return NextResponse.json({
      success: true,
      data: {
        webhook: {
          ...updatedWebhook,
          createdAt: updatedWebhook.createdAt.toISOString(),
          updatedAt: updatedWebhook.updatedAt.toISOString(),
          lastTriggeredAt: updatedWebhook.lastTriggeredAt?.toISOString() ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to update webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update webhook' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/webhooks/[id]
// ============================================================================

/**
 * DELETE /api/webhooks/[id]
 * Delete a webhook
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

    // Get the webhook to check workspace
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      );
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      existingWebhook.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Delete the webhook
    await prisma.webhook.delete({
      where: { id },
    });

    logger.info('Webhook deleted', {
      webhookId: id,
      workspaceId: existingWebhook.workspaceId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Webhook deleted successfully' },
    });
  } catch (error) {
    logger.error('Failed to delete webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook' } },
      { status: 500 }
    );
  }
}
