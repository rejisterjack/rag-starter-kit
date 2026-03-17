import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} from '@/lib/workspace/workspace';
import { canManageWorkspace } from '@/lib/workspace/permissions';
import { validateUpdateWorkspaceInput } from '@/lib/security/input-validator';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET /api/workspaces/[workspaceId]
 * Get a specific workspace
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { workspaceId } = await params;

    // Check if user has access to workspace
    const membership = await prisma.workspaceMember.findFirst({
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
  } catch (error) {
    console.error('Get workspace error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get workspace' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/[workspaceId]
 * Update a workspace
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

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
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput;
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

    // Update workspace
    const workspace = await updateWorkspace(workspaceId, validatedInput);

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
          updatedAt: workspace.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update workspace' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]
 * Delete a workspace
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

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
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete workspace' } },
      { status: 500 }
    );
  }
}
