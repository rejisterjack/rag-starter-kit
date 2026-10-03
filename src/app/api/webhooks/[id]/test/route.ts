import { apiError, apiSuccess } from '@/lib/api-response';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { buildWebhookPayload, recordDelivery, testWebhook } from '@/lib/webhooks/delivery';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

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
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;

    // Get the webhook
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return apiError('NOT_FOUND', 'Webhook not found', 404);
    }

    // Check if user has permission to manage webhooks in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      webhook.workspaceId,
      Permission.MANAGE_WEBHOOKS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Check if webhook is active
    if (webhook.status !== 'ACTIVE') {
      return apiError('WEBHOOK_INACTIVE', 'Webhook is not active', 400);
    }

    // Send test webhook
    const testPayload = buildWebhookPayload('webhook.test', {
      message: 'This is a test webhook from RAG Starter Kit',
      test: true,
    });
    const result = await testWebhook(webhook.url, webhook.secret, {
      maxRetries: 1, // Only 1 retry for tests
      timeoutMs: 30000,
    });

    // Persist the delivery attempt so it shows up in the deliveries log (D-13)
    await recordDelivery(id, testPayload, result);

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

    return apiSuccess({
      testResult: {
        success: result.success,
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        error: result.error,
        durationMs: result.durationMs,
        attemptCount: result.attemptCount,
      },
    });
  } catch (error) {
    logger.error('Failed to test webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError('INTERNAL_ERROR', 'Failed to test webhook', 500);
  }
}
