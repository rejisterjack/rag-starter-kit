/**
 * Webhook Delivery Logs API
 * GET /api/webhooks/[id]/deliveries - Get delivery logs for a webhook
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { DeliveryStatus } from '@/generated/prisma/client';
import { apiError, apiSuccess } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'RETRYING']).nullish(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id: webhookId } = await params;
    const { searchParams } = new URL(req.url);

    // searchParams.get() returns null when a param is absent; strip nulls so
    // .default()/nullish behave as intended instead of failing invalid_type
    const rawQuery: Record<string, string> = {};
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const statusParam = searchParams.get('status');
    if (limitParam !== null) rawQuery.limit = limitParam;
    if (offsetParam !== null) rawQuery.offset = offsetParam;
    if (statusParam !== null && statusParam !== '') rawQuery.status = statusParam;

    const query = querySchema.safeParse(rawQuery);

    if (!query.success) {
      return apiError('BAD_REQUEST', 'Invalid query parameters', 400, query.error.errors);
    }

    const { limit, offset, status: maybeStatus } = query.data;
    const status = maybeStatus ?? undefined;

    // Get webhook to check permissions
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      select: { workspaceId: true },
    });

    if (!webhook) {
      return apiError('NOT_FOUND', 'Webhook not found', 404);
    }

    // Check permissions
    const hasAccess = await checkPermission(
      session.user.id,
      webhook.workspaceId,
      Permission.READ_WEBHOOKS
    );

    if (!hasAccess) {
      return apiError('FORBIDDEN', 'Forbidden', 403);
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

    return apiSuccess({
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
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch webhook deliveries', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to fetch deliveries', 500);
  }
}
