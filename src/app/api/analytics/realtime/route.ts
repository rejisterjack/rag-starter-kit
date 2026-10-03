/**
 * Analytics Realtime API Route
 *
 * GET endpoint for real-time metrics (SSE)
 * Streams: current active chats, recent errors, live token usage
 */

import { NextResponse } from 'next/server';
import { getRealtimeMetrics } from '@/lib/analytics/dashboard-service';
import { apiError } from '@/lib/api-response';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// Configuration
// =============================================================================

const SSE_RETRY_INTERVAL = 5000; // 5 seconds
const SSE_KEEPALIVE_INTERVAL = 30000; // 30 seconds

// =============================================================================
// GET Handler (SSE)
// =============================================================================

export async function GET(req: Request) {
  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const userWorkspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'api', {
      userId,
      endpoint: '/api/analytics/realtime',
    });

    if (!rateLimitResult.success) {
      return apiError('RATE_LIMIT', 'Rate limit exceeded', 429);
    }

    // Step 3: Parse query parameters
    const { searchParams } = new URL(req.url);
    const requestedWorkspaceId = searchParams.get('workspaceId');

    // Step 4: Determine workspace access
    let effectiveWorkspaceId: string | undefined;

    if (requestedWorkspaceId) {
      const hasAccess = await checkPermission(
        userId,
        requestedWorkspaceId,
        Permission.READ_API_USAGE
      );

      if (!hasAccess) {
        await logAuditEvent({
          event: 'PERMISSION_DENIED',
          userId,
          workspaceId: requestedWorkspaceId,
          metadata: {
            action: 'view_analytics_realtime',
            requiredPermission: Permission.READ_API_USAGE,
          },
          severity: 'WARNING',
        });

        return apiError('FORBIDDEN', 'Access denied to workspace analytics', 403);
      }

      effectiveWorkspaceId = requestedWorkspaceId;
    } else if (userWorkspaceId) {
      const hasAccess = await checkPermission(userId, userWorkspaceId, Permission.READ_API_USAGE);

      if (hasAccess) {
        effectiveWorkspaceId = userWorkspaceId;
      }
    }

    // Admins can view all workspaces
    const isAdmin = session.user.role === 'ADMIN';
    if (!effectiveWorkspaceId && !isAdmin) {
      return apiError('WORKSPACE_REQUIRED', 'Workspace access required', 403);
    }

    // Step 5: Log SSE connection
    await logAuditEvent({
      event: 'READ_API_USAGE',
      userId,
      workspaceId: effectiveWorkspaceId,
      metadata: {
        endpoint: '/api/analytics/realtime',
        connectionType: 'sse',
      },
    });

    // Step 6: Create SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial data
        try {
          const initialData = await getRealtimeMetrics(effectiveWorkspaceId);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'initial', data: initialData })}\n\n`)
          );
        } catch (_error: unknown) {
          logger.error('Failed to fetch initial realtime data', {
            error: _error instanceof Error ? _error.message : 'Unknown error',
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch initial data' })}\n\n`
            )
          );
        }

        // Set up interval for updates
        const intervalId = setInterval(async () => {
          try {
            const metrics = await getRealtimeMetrics(effectiveWorkspaceId);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'update', data: metrics })}\n\n`)
            );
          } catch (_error: unknown) {
            logger.error('Failed to fetch realtime metrics in SSE interval', {
              error: _error instanceof Error ? _error.message : 'Unknown error',
            });
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch data' })}\n\n`
              )
            );
          }
        }, SSE_RETRY_INTERVAL);

        // Set up keepalive
        const keepaliveId = setInterval(() => {
          controller.enqueue(encoder.encode(':keepalive\n\n'));
        }, SSE_KEEPALIVE_INTERVAL);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          clearInterval(keepaliveId);
          controller.close();
        });
      },
    });

    // Step 7: Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return apiError('INTERNAL_ERROR', 'Failed to establish realtime connection', 500, errorMessage);
  }
}

// =============================================================================
// OPTIONS Handler (CORS)
// =============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
