/**
 * Analytics Metrics API Route
 *
 * GET endpoint for time-series metrics
 * Query params: from, to, granularity (hour, day, week, month)
 * Returns: chatCount, tokenUsage, latency, errorRate over time
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import { checkPermission, Permission } from '@/lib/workspace/permissions';
import {
  checkApiRateLimit,
  getRateLimitIdentifier,
  addRateLimitHeaders,
} from '@/lib/security/rate-limiter';
import { getTimeSeriesData, type Granularity } from '@/lib/analytics/dashboard-service';
import { logAuditEvent } from '@/lib/audit/audit-logger';

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(req: Request) {
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
      endpoint: '/api/analytics/metrics',
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
    const granularityParam = (searchParams.get('granularity') as Granularity) ?? 'day';
    const requestedWorkspaceId = searchParams.get('workspaceId');

    // Validate required params
    if (!fromParam || !toParam) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          code: 'MISSING_PARAMS',
          details: { required: ['from', 'to'], optional: ['granularity', 'workspaceId'] },
        },
        { status: 400 }
      );
    }

    // Validate granularity
    const validGranularities: Granularity[] = ['hour', 'day', 'week', 'month'];
    if (!validGranularities.includes(granularityParam)) {
      return NextResponse.json(
        {
          error: 'Invalid granularity',
          code: 'INVALID_GRANULARITY',
          details: { valid: validGranularities },
        },
        { status: 400 }
      );
    }

    // Parse dates
    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid date format',
          code: 'INVALID_DATE',
          details: { format: 'ISO 8601 (YYYY-MM-DD or full ISO string)' },
        },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        {
          error: 'Invalid date range',
          code: 'INVALID_DATE_RANGE',
          details: { message: 'from date must be before to date' },
        },
        { status: 400 }
      );
    }

    // Limit date range based on granularity
    const maxRanges: Record<Granularity, number> = {
      hour: 7 * 24, // 7 days
      day: 90, // 90 days
      week: 52, // 52 weeks
      month: 24, // 24 months
    };

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffUnits = {
      hour: diffMs / (60 * 60 * 1000),
      day: diffMs / (24 * 60 * 60 * 1000),
      week: diffMs / (7 * 24 * 60 * 60 * 1000),
      month: diffMs / (30 * 24 * 60 * 60 * 1000),
    };

    if (diffUnits[granularityParam] > maxRanges[granularityParam]) {
      return NextResponse.json(
        {
          error: 'Date range too large',
          code: 'RANGE_TOO_LARGE',
          details: {
            granularity: granularityParam,
            max: maxRanges[granularityParam],
            unit: granularityParam + 's',
          },
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
            action: 'view_analytics_metrics',
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
      const hasAccess = await checkPermission(
        userId,
        userWorkspaceId,
        Permission.READ_API_USAGE
      );

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

    // Step 5: Fetch time-series data
    const metricsData = await getTimeSeriesData(
      effectiveWorkspaceId,
      fromDate,
      toDate,
      granularityParam
    );

    // Step 6: Log analytics access
    await logAuditEvent({
      event: 'READ_API_USAGE',
      userId,
      workspaceId: effectiveWorkspaceId,
      metadata: {
        endpoint: '/api/analytics/metrics',
        granularity: granularityParam,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pointCount: metricsData.points.length,
      },
    });

    // Step 7: Build response
    const response = NextResponse.json({
      success: true,
      data: metricsData,
      meta: {
        requestDuration: Date.now() - startTime,
        workspaceId: effectiveWorkspaceId ?? 'all',
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    console.error('Analytics metrics error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics metrics',
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
