import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getAvailableWebhookEvents } from '@/lib/webhooks/delivery';

/**
 * GET /api/webhooks/events
 * Get all available webhook event types that can be subscribed to
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const events = getAvailableWebhookEvents();

    return NextResponse.json({
      success: true,
      data: {
        events,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get webhook events' } },
      { status: 500 }
    );
  }
}
