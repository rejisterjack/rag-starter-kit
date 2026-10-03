import { apiError, apiSuccess } from '@/lib/api-response';

import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { canManageMembers, invalidatePermissionCache } from '@/lib/workspace/permissions';
import { removeMember, updateMemberRole } from '@/lib/workspace/workspace';

interface RouteParams {
  params: Promise<{ workspaceId: string; memberId: string }>;
}

/**
 * PATCH /api/workspaces/[workspaceId]/members/[memberId]
 * Update a member's role
 */
export const PATCH = withApiAuth(async (req, session, { params }: RouteParams) => {
  try {
    const { workspaceId, memberId } = await params;

    // Check if user can manage members
    const canManage = await canManageMembers(session.user.id, workspaceId);
    if (!canManage) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for member update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    const { role } = body as { role: string };

    if (!role || !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
      return apiError('INVALID_ROLE', 'Invalid role specified', 400);
    }

    // Get the member's user ID
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      return apiError('NOT_FOUND', 'Member not found', 404);
    }

    // Update member role
    const result = await updateMemberRole(
      workspaceId,
      member.userId,
      role as 'ADMIN' | 'MEMBER' | 'VIEWER',
      session.user.id
    );

    if (!result.success) {
      return apiError('UPDATE_FAILED', result.error ?? 'Failed to update member', 400);
    }

    // Invalidate cached permissions for the affected member
    await invalidatePermissionCache(member.userId, workspaceId);

    return apiSuccess({
      message: 'Member role updated successfully',
    });
  } catch (error: unknown) {
    logger.error('Failed to update member', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to update member', 500);
  }
});

/**
 * DELETE /api/workspaces/[workspaceId]/members/[memberId]
 * Remove a member from the workspace
 */
export const DELETE = withApiAuth(async (_req, session, { params }: RouteParams) => {
  try {
    const { workspaceId, memberId } = await params;

    // Check if user can manage members
    const canManage = await canManageMembers(session.user.id, workspaceId);
    if (!canManage) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Get the member's user ID
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      return apiError('NOT_FOUND', 'Member not found', 404);
    }

    // Cannot remove yourself through this endpoint
    if (member.userId === session.user.id) {
      return apiError('CANNOT_REMOVE_SELF', 'Use leave workspace instead', 400);
    }

    // Remove member
    const result = await removeMember(workspaceId, member.userId, session.user.id);

    if (!result.success) {
      return apiError('REMOVE_FAILED', result.error ?? 'Failed to remove member', 400);
    }

    // Invalidate cached permissions for the removed member
    await invalidatePermissionCache(member.userId, workspaceId);

    return apiSuccess({
      message: 'Member removed successfully',
    });
  } catch (error: unknown) {
    logger.error('Failed to remove member', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to remove member', 500);
  }
});
