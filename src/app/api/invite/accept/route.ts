import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { acceptInvitation } from '@/lib/workspace/workspace';

/**
 * POST /api/invite/accept
 * Accept a workspace invitation
 */
export const POST = withApiAuth(async (req, session) => {
  try {
    // Parse request body
    let body: { token?: string };
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for invite acceptance', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const { token } = body;

    if (!token) {
      return apiError('BAD_REQUEST', 'Invitation token is required', 400);
    }

    // Get invitation details first
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return apiError('NOT_FOUND', 'Invalid invitation token', 404);
    }

    // Check if invitation email matches user's email
    if (invitation.email !== session.user.email) {
      return apiError('FORBIDDEN', 'This invitation was sent to a different email address', 403);
    }

    // Accept the invitation
    const result = await acceptInvitation(token, session.user.id);

    if (!result.success) {
      return apiError('BAD_REQUEST', result.error ?? 'Failed to accept invitation', 400);
    }

    // Log the acceptance
    await logAuditEvent({
      event: AuditEvent.MEMBER_JOINED,
      userId: session.user.id,
      workspaceId: result.workspaceId,
      metadata: { invitedEmail: invitation.email, role: invitation.role },
    });

    return apiSuccess({
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
      },
    });
  } catch (error) {
    logger.error('Error accepting invitation', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return apiError('INTERNAL_ERROR', 'Failed to accept invitation', 500);
  }
});
