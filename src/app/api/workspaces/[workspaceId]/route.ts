import { apiError, apiSuccess } from '@/lib/api-response';

import { withApiAuth } from '@/lib/auth';
import { prismaRead } from '@/lib/db';
import {
  ConcurrentModificationError,
  extractVersion,
  updateWithVersion,
} from '@/lib/db/optimistic-locking';
import { logger } from '@/lib/logger';
import { canManageWorkspace } from '@/lib/workspace/permissions';
import { deleteWorkspace, getWorkspaceById, updateWorkspace } from '@/lib/workspace/workspace';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET /api/workspaces/[workspaceId]
 * Get a specific workspace
 */
export const GET = withApiAuth(async (_req, session, { params }: RouteParams) => {
  try {
    const { workspaceId } = await params;

    // Check if user has access to workspace
    const membership = await prismaRead.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    const workspace = await getWorkspaceById(workspaceId);

    if (!workspace) {
      return apiError('NOT_FOUND', 'Workspace not found', 404);
    }

    return apiSuccess({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        avatar: workspace.avatar,
        plan: workspace.plan,
        settings: workspace.settings,
        owner: workspace.owner,
        members: workspace.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          user: m.user,
        })),
        memberCount: workspace.members.length,
        documentCount: workspace._count.documents,
        chatCount: workspace._count.chats,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
      currentUserRole: membership.role,
    });
  } catch (error: unknown) {
    logger.error('Failed to get workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to get workspace', 500);
  }
});

/**
 * PATCH /api/workspaces/[workspaceId]
 * Update a workspace
 */
export const PATCH = withApiAuth(async (req, session, { params }: RouteParams) => {
  try {
    const { workspaceId } = await params;

    // Check if user can manage workspace
    const canManage = await canManageWorkspace(session.user.id, workspaceId);
    if (!canManage) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for workspace update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    let validatedInput: ReturnType<typeof validateUpdateWorkspaceInput>;
    const isDev = process.env.NODE_ENV === 'development';
    try {
      validatedInput = validateUpdateWorkspaceInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return apiError('VALIDATION_ERROR', isDev ? error.message : 'Validation failed', 400);
      }
      throw error;
    }

    // Update workspace (with optimistic locking if If-Match provided)
    const expectedVersion = extractVersion(req.headers);
    let responseData: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      avatar: string | null;
      plan: string;
      settings: Record<string, unknown> | null;
      version?: number;
      updatedAt: string;
    };

    try {
      if (expectedVersion !== null) {
        const updateData: Record<string, unknown> = {};
        if (validatedInput.name !== undefined) updateData.name = validatedInput.name;
        if (validatedInput.description !== undefined)
          updateData.description = validatedInput.description;
        if (validatedInput.avatar !== undefined) updateData.logoUrl = validatedInput.avatar;
        if (validatedInput.settings !== undefined) updateData.settings = validatedInput.settings;
        const workspace = await updateWithVersion(
          'workspace',
          workspaceId,
          updateData,
          expectedVersion
        );
        responseData = {
          id: String(workspace.id),
          name: String(workspace.name),
          slug: String(workspace.slug),
          description: workspace.description != null ? String(workspace.description) : null,
          avatar:
            workspace.logoUrl != null
              ? String(workspace.logoUrl)
              : workspace.avatar != null
                ? String(workspace.avatar)
                : null,
          plan: String(workspace.plan),
          settings: workspace.settings as Record<string, unknown> | null,
          version: workspace.version as number | undefined,
          updatedAt: new Date(workspace.updatedAt as string | Date).toISOString(),
        };
      } else {
        const workspace = await updateWorkspace(workspaceId, validatedInput);
        responseData = {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          avatar: workspace.avatar,
          plan: workspace.plan,
          settings: workspace.settings,
          updatedAt: workspace.updatedAt.toISOString(),
        };
      }
    } catch (e) {
      if (e instanceof ConcurrentModificationError) {
        return apiError('CONFLICT', e.message, 409);
      }
      throw e;
    }

    return apiSuccess({
      workspace: responseData,
    });
  } catch (error: unknown) {
    logger.error('Failed to update workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to update workspace', 500);
  }
});

/**
 * DELETE /api/workspaces/[workspaceId]
 * Delete a workspace
 */
export const DELETE = withApiAuth(async (_req, session, { params }: RouteParams) => {
  try {
    const { workspaceId } = await params;

    const isDev = process.env.NODE_ENV === 'development';
    try {
      await deleteWorkspace(workspaceId, session.user.id);
    } catch (error) {
      if (error instanceof Error) {
        return apiError('DELETE_FAILED', isDev ? error.message : 'Failed to delete workspace', 400);
      }
      throw error;
    }

    return apiSuccess({
      message: 'Workspace deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Failed to delete workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to delete workspace', 500);
  }
});

// =============================================================================
// Validation
// =============================================================================

interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  avatar?: string;
  settings?: Record<string, unknown>;
}

/**
 * Validate update workspace input
 */
function validateUpdateWorkspaceInput(body: unknown): UpdateWorkspaceInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;
  const result: UpdateWorkspaceInput = {};

  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 100) {
      throw new Error('Invalid name: must be a string between 1 and 100 characters');
    }
    result.name = input.name;
  }

  if ('description' in input) {
    if (input.description !== null && typeof input.description !== 'string') {
      throw new Error('Invalid description: must be a string or null');
    }
    result.description = input.description ?? undefined;
  }

  if ('avatar' in input) {
    if (input.avatar !== null && typeof input.avatar !== 'string') {
      throw new Error('Invalid avatar: must be a string or null');
    }
    result.avatar = input.avatar ?? undefined;
  }

  if ('settings' in input) {
    if (input.settings !== null && typeof input.settings !== 'object') {
      throw new Error('Invalid settings: must be an object or null');
    }
    result.settings = (input.settings ?? undefined) as Record<string, unknown> | undefined;
  }

  return result;
}
