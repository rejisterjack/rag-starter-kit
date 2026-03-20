/**
 * Analytics Costs API Route
 *
 * GET endpoint for cost tracking
 * Returns: estimated costs by model, by user, by workspace
 * Token usage breakdown (prompt vs completion), cost projections
 */

import { NextResponse } from 'next/server';
import { getCostAnalysis } from '@/lib/analytics/dashboard-service';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;
    const userWorkspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'api', {
      userId,
      endpoint: '/api/analytics/costs',
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

    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const requestedWorkspaceId = searchParams.get('workspaceId');

    // Parse optional date filters
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (fromParam) {
      fromDate = new Date(fromParam);
      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid from date format',
            code: 'INVALID_DATE',
            details: { format: 'ISO 8601 (YYYY-MM-DD or full ISO string)' },
          },
          { status: 400 }
        );
      }
    }

    if (toParam) {
      toDate = new Date(toParam);
      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid to date format',
            code: 'INVALID_DATE',
            details: { format: 'ISO 8601 (YYYY-MM-DD or full ISO string)' },
          },
          { status: 400 }
        );
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          error: 'Invalid date range',
          code: 'INVALID_DATE_RANGE',
          details: { message: 'from date must be before to date' },
        },
        { status: 400 }
      );
    }

    // Step 4: Determine workspace access
    let effectiveWorkspaceId: string | undefined;

    if (requestedWorkspaceId) {
      // User is requesting specific workspace data
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
            action: 'view_analytics_costs',
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
      // Use user's default workspace
      const hasAccess = await checkPermission(userId, userWorkspaceId, Permission.READ_API_USAGE);

      if (hasAccess) {
        effectiveWorkspaceId = userWorkspaceId;
      }
    }

    // Admins can view all workspaces (no workspaceId filter)
    const isAdmin = session.user.role === 'ADMIN';
    if (!effectiveWorkspaceId && !isAdmin) {
      return NextResponse.json(
        { error: 'Workspace access required', code: 'WORKSPACE_REQUIRED' },
        { status: 403 }
      );
    }

    // Step 5: Fetch cost analysis
    const costAnalysis = await getCostAnalysis(effectiveWorkspaceId, fromDate, toDate);

    // Step 6: Log analytics access
    await logAuditEvent({
      event: 'READ_API_USAGE',
      userId,
      workspaceId: effectiveWorkspaceId,
      metadata: {
        endpoint: '/api/analytics/costs',
        from: fromDate?.toISOString(),
        to: toDate?.toISOString(),
      },
    });

    // Step 7: Build response
    const response = NextResponse.json({
      success: true,
      data: costAnalysis,
      meta: {
        requestDuration: Date.now() - startTime,
        workspaceId: effectiveWorkspaceId ?? 'all',
        dateRange: {
          from: fromDate?.toISOString() ?? 'all-time',
          to: toDate?.toISOString() ?? 'now',
        },
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch cost analysis',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
