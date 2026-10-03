import { apiError, apiSuccess } from '@/lib/api-response';

import { withApiAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { validateCreateWorkspaceInput } from '@/lib/security/input-validator';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { createWorkspace, getUserWorkspaces } from '@/lib/workspace/workspace';

/**
 * GET /api/workspaces
 * Get all workspaces for the current user with pagination
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
export const GET = withApiAuth(async (req, session) => {
  try {
    // Parse pagination params
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const allWorkspaces = await getUserWorkspaces(session.user.id);

    // Calculate pagination
    const total = allWorkspaces.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    const workspaces = allWorkspaces.slice(startIndex, endIndex);

    return apiSuccess({
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        avatar: w.avatar,
        plan: w.plan,
        role: w.members.find((m) => m.userId === session.user.id)?.role || 'MEMBER',
        memberCount: w.members.length,
        documentCount: w._count.documents,
        chatCount: w._count.chats,
        createdAt: w.createdAt.toISOString(),
      })),
      currentWorkspaceId: session.user.workspaceId,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to get workspaces', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to get workspaces', 500);
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace
 */
export const POST = withApiAuth(async (req, session) => {
  try {
    // Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId: session.user.id });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'workspace', {
      userId: session.user.id,
      endpoint: '/api/workspaces',
    });

    if (!rateLimitResult.success) {
      return apiError('RATE_LIMIT', 'Rate limit exceeded', 429);
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in workspace creation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    let validatedInput: ReturnType<typeof validateCreateWorkspaceInput>;
    const isDev = process.env.NODE_ENV === 'development';
    try {
      validatedInput = validateCreateWorkspaceInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return apiError('VALIDATION_ERROR', isDev ? error.message : 'Validation failed', 400);
      }
      throw error;
    }

    // Create workspace
    const workspace = await createWorkspace(session.user.id, validatedInput);

    return apiSuccess(
      {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          plan: workspace.plan,
          createdAt: workspace.createdAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Workspace slug already taken') {
      return apiError('SLUG_TAKEN', 'Workspace slug is already taken', 409);
    }

    const isDev = process.env.NODE_ENV === 'development';
    logger.error('Failed to create workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError(
      'INTERNAL_ERROR',
      isDev
        ? error instanceof Error
          ? error.message
          : 'Internal server error'
        : 'Failed to create workspace',
      500
    );
  }
});
