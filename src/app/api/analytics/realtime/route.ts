/**
 * Analytics Realtime API Route
 *
 * GET endpoint for real-time metrics (SSE)
 * Streams: current active chats, recent errors, live token usage
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import {
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { getRealtimeMetrics } from '@/lib/analytics/dashboard-service';
import { logAuditEvent } from '@/lib/audit/audit-logger';

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
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
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

        return NextResponse.json(
          { error: 'Access denied to workspace analytics', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      effectiveWorkspaceId = requestedWorkspaceId;
    } else if (userWorkspaceId) {
      const hasAccess = await checkPermission(
        userId,
        userWorkspaceId,
        Permission.READ_API_USAGE
      );

      if (hasAccess) {
        effectiveWorkspaceId = userWorkspaceId;
      }
    }

    // Admins can view all workspaces
    const isAdmin = session.user.role === 'ADMIN';
    if (!effectiveWorkspaceId && !isAdmin) {
      return NextResponse.json(
        { error: 'Workspace access required', code: 'WORKSPACE_REQUIRED' },
        { status: 403 }
      );
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
        } catch (error) {
          console.error('Error fetching initial realtime data:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch initial data' })}\n\n`)
          );
        }

        // Set up interval for updates
        const intervalId = setInterval(async () => {
          try {
            const metrics = await getRealtimeMetrics(effectiveWorkspaceId);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'update', data: metrics })}\n\n`)
            );
          } catch (error) {
            console.error('Error fetching realtime data:', error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch data' })}\n\n`)
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
    console.error('Analytics realtime error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to establish realtime connection',
        code: 'INTERNAL_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// Standard GET for non-SSE requests (polling fallback)
// =============================================================================

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Step 3: Parse request body for polling mode
    let body: { workspaceId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, continue with defaults
    }

    const requestedWorkspaceId = body.workspaceId;

    // Step 4: Determine workspace access
    let effectiveWorkspaceId: string | undefined;

    if (requestedWorkspaceId) {
      const hasAccess = await checkPermission(
        userId,
        requestedWorkspaceId,
        Permission.READ_API_USAGE
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to workspace analytics', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      effectiveWorkspaceId = requestedWorkspaceId;
    } else if (userWorkspaceId) {
      const hasAccess = await checkPermission(
        userId,
        userWorkspaceId,
        Permission.READ_API_USAGE
      );

      if (hasAccess) {
        effectiveWorkspaceId = userWorkspaceId;
      }
    }

    const isAdmin = session.user.role === 'ADMIN';
    if (!effectiveWorkspaceId && !isAdmin) {
      return NextResponse.json(
        { error: 'Workspace access required', code: 'WORKSPACE_REQUIRED' },
        { status: 403 }
      );
    }

    // Step 5: Fetch realtime metrics (single poll)
    const realtimeMetrics = await getRealtimeMetrics(effectiveWorkspaceId);

    // Step 6: Build response
    const response = NextResponse.json({
      success: true,
      data: realtimeMetrics,
      meta: {
        requestDuration: Date.now() - startTime,
        workspaceId: effectiveWorkspaceId ?? 'all',
        mode: 'polling',
      },
    });

    return response;
  } catch (error) {
    console.error('Analytics realtime polling error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch realtime metrics',
        code: 'INTERNAL_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    );
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
