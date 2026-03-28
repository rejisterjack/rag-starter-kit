/**
 * Session Utilities
 *
 * Helper functions for session management and workspace context
 */

import { prisma } from '@/lib/db';
import { auth } from './index';

/**
 * Get the current workspace from session
 * Used by API routes to determine the active workspace
 */
export async function getServerSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // If workspaceId is in session, return that workspace
  if (session.user.workspaceId) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: session.user.workspaceId,
        members: {
          some: { userId: session.user.id },
        },
      },
    });
    if (workspace) return workspace;
  }

  // Otherwise, return the user's first workspace
  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: 'asc' },
    include: { workspace: true },
  });

  return member?.workspace || null;
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id || null;
}

/**
 * Get current workspace ID from session
 */
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.workspaceId || null;
}
