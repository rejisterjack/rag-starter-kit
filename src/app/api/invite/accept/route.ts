import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { acceptInvitation } from '@/lib/workspace/workspace';

/**
 * POST /api/invite/accept
 * Accept a workspace invitation
 */
export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation details first
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation email matches user's email
    if (invitation.email !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Accept the invitation
    const result = await acceptInvitation(token, session.user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Log the acceptance
    await logAuditEvent({
      event: AuditEvent.MEMBER_JOINED,
      userId: session.user.id,
      workspaceId: result.workspaceId,
      metadata: { invitedEmail: invitation.email, role: invitation.role },
    });

    return NextResponse.json({
      success: true,
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
      },
    });
  } catch (error) {
    logger.error('Error accepting invitation', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
