import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { testWebhook } from '@/lib/webhooks/delivery';

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// POST /api/webhooks/[id]/test
// ============================================================================

/**
 * POST /api/webhooks/[id]/test
 * Test a webhook by sending a test event
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

    // Check if webhook is active
    if (webhook.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: { code: 'WEBHOOK_INACTIVE', message: 'Webhook is not active' } },
        { status: 400 }
      );
    }

    // Send test webhook
    const result = await testWebhook(webhook.url, webhook.secret, {
      maxRetries: 1, // Only 1 retry for tests
      timeoutMs: 30000,
    });

    // Update webhook stats based on result
    await prisma.webhook.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(),
        ...(result.success ? { failureCount: 0 } : { failureCount: { increment: 1 } }),
        // Auto-pause if too many failures
        ...(result.success ? {} : { status: webhook.failureCount >= 4 ? 'FAILED' : undefined }),
      },
    });

    logger.info('Webhook test completed', {
      webhookId: id,
      workspaceId: webhook.workspaceId,
      userId: session.user.id,
      success: result.success,
      durationMs: result.durationMs,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        testResult: {
          success: result.success,
          statusCode: result.statusCode,
          responseBody: result.responseBody,
          error: result.error,
          durationMs: result.durationMs,
          attemptCount: result.attemptCount,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to test webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to test webhook' } },
      { status: 500 }
    );
  }
}
