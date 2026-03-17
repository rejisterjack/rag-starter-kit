import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { inviteMember } from '@/lib/workspace/workspace';
import { canManageMembers } from '@/lib/workspace/permissions';
import { validateInviteMemberInput } from '@/lib/security/input-validator';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET /api/workspaces/[workspaceId]/members
 * Get all members of a workspace
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

    // Get all members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user,
        })),
      },
    });
  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get members' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/members
 * Invite a new member to the workspace
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { workspaceId } = await params;

    // Check if user can manage members
    const canManage = await canManageMembers(session.user.id, workspaceId);
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
      validatedInput = validateInviteMemberInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Invite member
    const result = await inviteMember(
      workspaceId,
      session.user.id,
      validatedInput.email,
      validatedInput.role
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'INVITE_FAILED', message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { message: 'Invitation sent successfully' },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to invite member' } },
      { status: 500 }
    );
  }
}
