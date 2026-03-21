import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { generateWebhookSecret } from '@/lib/webhooks/delivery';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// POST /api/webhooks/[id]/regenerate-secret
// ============================================================================

/**
 * POST /api/webhooks/[id]/regenerate-secret
 * Regenerate the webhook secret (useful if secret is compromised)
 */
export async function POST(_req: Request, { params }: RouteParams) {
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

    // Generate new secret
    const newSecret = generateWebhookSecret();

    // Update webhook with new secret
    const updatedWebhook = await prisma.webhook.update({
      where: { id },
      data: {
        secret: newSecret,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        status: true,
        secret: true, // Include secret in response
        lastTriggeredAt: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
        workspaceId: true,
        createdById: true,
      },
    });

    logger.info('Webhook secret regenerated', {
      webhookId: id,
      workspaceId: webhook.workspaceId,
      userId: session.user.id,
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
        warning: 'Please save this secret now. It will not be shown again.',
      },
    });
  } catch (error) {
    logger.error('Failed to regenerate webhook secret', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate webhook secret' } },
      { status: 500 }
    );
  }
}
