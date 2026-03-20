import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/invite/validate?token=...
 * Validate an invitation token without accepting it
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    // Find the invitation
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

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Invitation is already ${invitation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.workspaceInvitation.update({
        where: { token },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
      },
      email: invitation.email,
      role: invitation.role,
    });
  } catch (error) {
    logger.error('Error validating invitation', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to validate invitation' },
      { status: 500 }
    );
  }
}
