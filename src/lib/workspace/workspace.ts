import { prisma } from '@/lib/db';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';

import type { MemberRole, MemberStatus, Workspace, WorkspaceMember } from './types';

// =============================================================================
// Types
// =============================================================================

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  description?: string;
  avatar?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  avatar?: string;
  settings?: Record<string, unknown>;
}

export interface WorkspaceWithMembers extends Workspace {
  members: (WorkspaceMember & {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  })[];
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  _count: {
    documents: number;
    chats: number;
  };
}

// =============================================================================
// Workspace CRUD Operations
// =============================================================================

/**
 * Create a new workspace
 */
export async function createWorkspace(
  userId: string,
  data: CreateWorkspaceInput
): Promise<Workspace> {
  // Generate slug if not provided
  const slug = data.slug || generateSlug(data.name);
  
  // Check if slug is already taken
  const existing = await prisma.workspace.findUnique({
    where: { slug },
  });

  if (existing) {
    throw new Error('Workspace slug already taken');
  }

  // Create workspace with owner as first member
  const workspace = await prisma.workspace.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      avatar: data.avatar,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      },
    },
  });

  // Log workspace creation
  await logAuditEvent({
    event: AuditEvent.WORKSPACE_CREATED,
    userId,
    workspaceId: workspace.id,
    metadata: { name: data.name, slug },
  });

  return workspace;
}

/**
 * Create default workspace for new users
 */
export async function createDefaultWorkspace(
  userId: string,
  data: { name: string }
): Promise<Workspace> {
  const baseSlug = generateSlug(data.name);
  let slug = baseSlug;
  let counter = 1;

  // Find unique slug
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return createWorkspace(userId, {
    name: data.name,
    slug,
    description: 'Your personal workspace',
  });
}

/**
 * Get workspace by ID
 */
export async function getWorkspaceById(
  workspaceId: string
): Promise<WorkspaceWithMembers | null> {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
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
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      _count: {
        select: {
          documents: true,
          chats: true,
        },
      },
    },
  }) as Promise<WorkspaceWithMembers | null>;
}

/**
 * Get workspace by slug
 */
export async function getWorkspaceBySlug(
  slug: string
): Promise<WorkspaceWithMembers | null> {
  return prisma.workspace.findUnique({
    where: { slug },
    include: {
      members: {
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
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      _count: {
        select: {
          documents: true,
          chats: true,
        },
      },
    },
  }) as Promise<WorkspaceWithMembers | null>;
}

/**
 * Get all workspaces for a user
 */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceWithMembers[]> {
  const members = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          members: {
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
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              documents: true,
              chats: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return members.map((m) => m.workspace) as WorkspaceWithMembers[];
}

/**
 * Update workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  data: UpdateWorkspaceInput
): Promise<Workspace> {
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.settings && { settings: data.settings }),
    },
  });

  // Log workspace update
  await logAuditEvent({
    event: AuditEvent.WORKSPACE_UPDATED,
    workspaceId,
    metadata: data,
  });

  return workspace;
}

/**
 * Delete workspace (only owner can do this)
 */
export async function deleteWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  if (workspace.ownerId !== userId) {
    throw new Error('Only workspace owner can delete workspace');
  }

  // Check if this is the user's only workspace
  const userWorkspaces = await prisma.workspaceMember.count({
    where: { userId },
  });

  if (userWorkspaces <= 1) {
    throw new Error('Cannot delete your only workspace');
  }

  // Log before deletion
  await logAuditEvent({
    event: AuditEvent.WORKSPACE_DELETED,
    userId,
    workspaceId,
    metadata: { name: workspace.name },
  });

  // Delete workspace (cascade will handle related records)
  await prisma.workspace.delete({
    where: { id: workspaceId },
  });
}

// =============================================================================
// Workspace Switching
// =============================================================================

/**
 * Switch to a different workspace
 * This updates the user's session to use the new workspace
 */
export async function switchWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  // Verify user is a member of the workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    throw new Error('Access denied to workspace');
  }

  // Update user's current workspace preference (stored in session via JWT callback)
  // This is handled by the session callback in auth config
}

/**
 * Get user's current active workspace
 */
export async function getCurrentWorkspace(userId: string): Promise<Workspace | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: { workspace: true },
  });

  return membership?.workspace || null;
}

// =============================================================================
// Member Management
// =============================================================================

/**
 * Invite member to workspace
 */
export async function inviteMember(
  workspaceId: string,
  invitedByUserId: string,
  email: string,
  role: MemberRole = 'MEMBER'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // User doesn't exist - send invitation email
      // TODO: Implement invitation email flow
      return { success: false, error: 'User not found. Invite system coming soon.' };
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id,
      },
    });

    if (existingMember) {
      return { success: false, error: 'User is already a member of this workspace' };
    }

    // Create membership
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role,
        status: 'ACTIVE',
        invitedBy: invitedByUserId,
        invitedAt: new Date(),
      },
    });

    // Log invitation
    await logAuditEvent({
      event: AuditEvent.MEMBER_INVITED,
      userId: invitedByUserId,
      workspaceId,
      metadata: { invitedUserId: user.id, invitedEmail: email, role },
    });

    return { success: true };
  } catch (error) {
    console.error('Invite member error:', error);
    return { success: false, error: 'Failed to invite member' };
  }
}

/**
 * Remove member from workspace
 */
export async function removeMember(
  workspaceId: string,
  memberUserId: string,
  removedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cannot remove owner
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === memberUserId) {
      return { success: false, error: 'Cannot remove workspace owner' };
    }

    // Cannot remove yourself if you're the last admin
    const adminCount = await prisma.workspaceMember.count({
      where: {
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
      },
    });

    const targetMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: memberUserId,
      },
    });

    if (adminCount <= 1 && targetMember?.role === 'ADMIN') {
      return { success: false, error: 'Cannot remove the last admin' };
    }

    // Remove member
    await prisma.workspaceMember.deleteMany({
      where: {
        workspaceId,
        userId: memberUserId,
      },
    });

    // Log removal
    await logAuditEvent({
      event: AuditEvent.MEMBER_REMOVED,
      userId: removedByUserId,
      workspaceId,
      metadata: { removedUserId: memberUserId },
    });

    return { success: true };
  } catch (error) {
    console.error('Remove member error:', error);
    return { success: false, error: 'Failed to remove member' };
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  workspaceId: string,
  memberUserId: string,
  newRole: MemberRole,
  updatedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cannot change owner's role
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === memberUserId && newRole !== 'OWNER') {
      return { success: false, error: 'Cannot change workspace owner role' };
    }

    // Update role
    await prisma.workspaceMember.updateMany({
      where: {
        workspaceId,
        userId: memberUserId,
      },
      data: {
        role: newRole,
      },
    });

    // Log role change
    await logAuditEvent({
      event: AuditEvent.MEMBER_ROLE_CHANGED,
      userId: updatedByUserId,
      workspaceId,
      metadata: { targetUserId: memberUserId, newRole },
    });

    return { success: true };
  } catch (error) {
    console.error('Update member role error:', error);
    return { success: false, error: 'Failed to update member role' };
  }
}

/**
 * Leave workspace
 */
export async function leaveWorkspace(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cannot leave if you're the owner
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === userId) {
      return { success: false, error: 'Workspace owner cannot leave. Transfer ownership or delete workspace.' };
    }

    // Check if this is the user's last workspace
    const workspaceCount = await prisma.workspaceMember.count({
      where: { userId },
    });

    if (workspaceCount <= 1) {
      return { success: false, error: 'Cannot leave your only workspace' };
    }

    // Leave workspace
    await prisma.workspaceMember.deleteMany({
      where: {
        workspaceId,
        userId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Leave workspace error:', error);
    return { success: false, error: 'Failed to leave workspace' };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}
