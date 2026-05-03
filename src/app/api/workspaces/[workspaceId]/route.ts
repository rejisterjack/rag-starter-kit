import { NextResponse } from 'next/server';

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
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    const workspace = await getWorkspaceById(workspaceId);

    if (!workspace) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Workspace not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to get workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get workspace' } },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for workspace update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput: ReturnType<typeof validateUpdateWorkspaceInput>;
    try {
      validatedInput = validateUpdateWorkspaceInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Update workspace (with optimistic locking if If-Match provided)
    let workspace: Record<string, unknown>;
    const expectedVersion = extractVersion(req.headers);
    try {
      if (expectedVersion !== null) {
        const updateData: Record<string, unknown> = {};
        if (validatedInput.name !== undefined) updateData.name = validatedInput.name;
        if (validatedInput.description !== undefined)
          updateData.description = validatedInput.description;
        if (validatedInput.avatar !== undefined) updateData.logoUrl = validatedInput.avatar;
        if (validatedInput.settings !== undefined) updateData.settings = validatedInput.settings;
        workspace = await updateWithVersion('workspace', workspaceId, updateData, expectedVersion);
      } else {
        workspace = await updateWorkspace(workspaceId, validatedInput);
      }
    } catch (e) {
      if (e instanceof ConcurrentModificationError) {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: e.message } },
          { status: 409 }
        );
      }
      throw e;
    }

    const wsResult = workspace as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: {
        workspace: {
          id: wsResult.id,
          name: wsResult.name,
          slug: wsResult.slug,
          description: wsResult.description,
          avatar: wsResult.logoUrl ?? wsResult.avatar,
          plan: wsResult.plan,
          settings: wsResult.settings,
          version: wsResult.version,
          updatedAt: (wsResult.updatedAt as Date).toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to update workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update workspace' } },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/workspaces/[workspaceId]
 * Delete a workspace
 */
export const DELETE = withApiAuth(async (_req, session, { params }: RouteParams) => {
  try {
    const { workspaceId } = await params;

    try {
      await deleteWorkspace(workspaceId, session.user.id);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'DELETE_FAILED', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Workspace deleted successfully' },
    });
  } catch (error: unknown) {
    logger.error('Failed to delete workspace', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete workspace' } },
      { status: 500 }
    );
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
    result.settings = (input.settings as Record<string, unknown>) ?? undefined;
  }

  return result;
}
