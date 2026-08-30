/**
 * Analytics Quality API Route
 *
 * GET endpoint for RAG quality metrics
 * Returns: avgRelevanceScore, citationAccuracy, retrievalPrecision
 * Query classification distribution, tool usage statistics
 */

import { NextResponse } from 'next/server';
import { getQualityMetrics } from '@/lib/analytics/dashboard-service';
import { apiError, apiSuccess } from '@/lib/api-response';
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
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const userWorkspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'api', {
      userId,
      endpoint: '/api/analytics/quality',
    });

    if (!rateLimitResult.success) {
      const errRes = apiError('RATE_LIMIT', 'Rate limit exceeded', 429, {
        resetAt: new Date(rateLimitResult.reset).toISOString(),
      });
      errRes.headers.set(
        'Retry-After',
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
      );
      return errRes;
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
        return apiError('INVALID_DATE', 'Invalid from date format', 400, {
          format: 'ISO 8601 (YYYY-MM-DD or full ISO string)',
        });
      }
    }

    if (toParam) {
      toDate = new Date(toParam);
      if (Number.isNaN(toDate.getTime())) {
        return apiError('INVALID_DATE', 'Invalid to date format', 400, {
          format: 'ISO 8601 (YYYY-MM-DD or full ISO string)',
        });
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      return apiError('INVALID_DATE_RANGE', 'Invalid date range', 400, {
        message: 'from date must be before to date',
      });
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
            action: 'view_analytics_quality',
            requiredPermission: Permission.READ_API_USAGE,
          },
          severity: 'WARNING',
        });

        return apiError('FORBIDDEN', 'Access denied to workspace analytics', 403);
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
      return apiError('WORKSPACE_REQUIRED', 'Workspace access required', 403);
    }

    // Step 5: Fetch quality metrics
    const qualityMetrics = await getQualityMetrics(effectiveWorkspaceId, fromDate, toDate);

    // Step 6: Log analytics access
    await logAuditEvent({
      event: 'READ_API_USAGE',
      userId,
      workspaceId: effectiveWorkspaceId,
      metadata: {
        endpoint: '/api/analytics/quality',
        from: fromDate?.toISOString(),
        to: toDate?.toISOString(),
      },
    });

    // Step 7: Build response
    const response = apiSuccess({
      ...qualityMetrics,
      meta: {
        requestDuration: Date.now() - startTime,
        workspaceId: effectiveWorkspaceId ?? 'all',
        dateRange: {
          from: fromDate?.toISOString() ?? 'last-30-days',
          to: toDate?.toISOString() ?? 'now',
        },
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return apiError('INTERNAL_ERROR', 'Failed to fetch quality metrics', 500, errorMessage);
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
