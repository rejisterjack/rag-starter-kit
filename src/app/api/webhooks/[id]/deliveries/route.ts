/**
 * Webhook Delivery Logs API
 * GET /api/webhooks/[id]/deliveries - Get delivery logs for a webhook
 */

import type { DeliveryStatus } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'RETRYING']).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: webhookId } = await params;
    const { searchParams } = new URL(req.url);

    const query = querySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      status: searchParams.get('status'),
    });

    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: query.error.errors },
        { status: 400 }
      );
    }

    const { limit, offset, status } = query.data;

    // Get webhook to check permissions
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      select: { workspaceId: true },
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Check permissions
    const hasAccess = await checkPermission(
      session.user.id,
      webhook.workspaceId,
      Permission.READ_WEBHOOKS
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build filter
    const where: { webhookId: string; status?: DeliveryStatus } = { webhookId };
    if (status) where.status = status;

    // Fetch deliveries
    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          event: true,
          status: true,
          statusCode: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          retryCount: true,
          error: true,
          payload: true,
          response: true,
        },
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    // Calculate stats
    const stats = await prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: { webhookId },
      _count: { status: true },
    });

    const statsMap = stats.reduce(
      (acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        deliveries: deliveries.map((d) => ({
          ...d,
          payload: undefined, // Don't include full payload in list
          response: d.response ? d.response.slice(0, 1000) : null,
        })),
        total,
        stats: {
          delivered: statsMap.DELIVERED || 0,
          failed: statsMap.FAILED || 0,
          pending: statsMap.PENDING || 0,
          retrying: statsMap.RETRYING || 0,
        },
        pagination: {
          limit,
          offset,
          hasMore: offset + deliveries.length < total,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch webhook deliveries', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}
