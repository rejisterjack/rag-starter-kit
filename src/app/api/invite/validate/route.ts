import { apiError, apiSuccess } from '@/lib/api-response';

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
      return apiError('BAD_REQUEST', 'Token is required', 400);
    }

    // Find the invitation
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return apiError('NOT_FOUND', 'Invalid invitation token', 404);
    }

    if (invitation.status !== 'PENDING') {
      return apiError(
        'BAD_REQUEST',
        `Invitation is already ${invitation.status.toLowerCase()}`,
        400
      );
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.workspaceInvitation.update({
        where: { token },
        data: { status: 'EXPIRED' },
      });

      return apiError('BAD_REQUEST', 'Invitation has expired', 400);
    }

    return apiSuccess({
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
    return apiError('INTERNAL_ERROR', 'Failed to validate invitation', 500);
  }
}
