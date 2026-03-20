import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  removeMember,
  updateMemberRole,
} from '@/lib/workspace/workspace';
import { canManageMembers } from '@/lib/workspace/permissions';

interface RouteParams {
  params: Promise<{ workspaceId: string; memberId: string }>;
}

/**
 * PATCH /api/workspaces/[workspaceId]/members/[memberId]
 * Update a member's role
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

    const { workspaceId, memberId } = await params;

    // Check if user can manage members
    const canManage = await canManageMembers(session.user.id, workspaceId);
    if (!canManage) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { role } = body as { role: string };

    if (!role || !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ROLE', message: 'Invalid role specified' } },
        { status: 400 }
      );
    }

    // Get the member's user ID
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Update member role
    const result = await updateMemberRole(
      workspaceId,
      member.userId,
      role as 'ADMIN' | 'MEMBER' | 'VIEWER',
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Member role updated successfully' },
    });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update member' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/members/[memberId]
 * Remove a member from the workspace
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { workspaceId, memberId } = await params;

    // Check if user can manage members
    const canManage = await canManageMembers(session.user.id, workspaceId);
    if (!canManage) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get the member's user ID
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Cannot remove yourself through this endpoint
    if (member.userId === session.user.id) {
      return NextResponse.json(
        { error: { code: 'CANNOT_REMOVE_SELF', message: 'Use leave workspace instead' } },
        { status: 400 }
      );
    }

    // Remove member
    const result = await removeMember(
      workspaceId,
      member.userId,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'REMOVE_FAILED', message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Member removed successfully' },
    });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' } },
      { status: 500 }
    );
  }
}
