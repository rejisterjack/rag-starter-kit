import { apiError, apiSuccess } from '@/lib/api-response';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getAvailableWebhookEvents } from '@/lib/webhooks/delivery';
/**
 * GET /api/webhooks/events
 * Get all available webhook event types that can be subscribed to
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const events = getAvailableWebhookEvents();

    return apiSuccess({ events });
  } catch (error: unknown) {
    logger.error('Failed to get webhook events', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to get webhook events', 500);
  }
}
