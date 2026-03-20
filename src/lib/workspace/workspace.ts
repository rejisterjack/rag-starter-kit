import crypto from 'crypto';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/notifications/email';

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
export async function getWorkspaceById(workspaceId: string): Promise<WorkspaceWithMembers | null> {
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
export async function getWorkspaceBySlug(slug: string): Promise<WorkspaceWithMembers | null> {
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
export async function deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
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
export async function switchWorkspace(userId: string, workspaceId: string): Promise<void> {
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
 * Supports both existing users (direct add) and new users (email invitation)
 */
export async function inviteMember(
  workspaceId: string,
  invitedByUserId: string,
  email: string,
  role: MemberRole = 'MEMBER'
): Promise<{ success: boolean; error?: string; inviteToken?: string }> {
  try {
    // Get workspace and inviter info
    const [workspace, invitedBy] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: invitedByUserId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    if (!invitedBy) {
      return { success: false, error: 'Inviter not found' };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Check if already a member
      const existingMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: existingUser.id,
        },
      });

      if (existingMember) {
        return { success: false, error: 'User is already a member of this workspace' };
      }

      // Create membership for existing user
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: existingUser.id,
          role,
          status: 'ACTIVE',
          invitedBy: invitedByUserId,
          invitedAt: new Date(),
        },
      });

      // Send notification email to existing user
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await emailService.sendEmail({
        to: email,
        template: emailService.invitationEmail({
          invitedByName: invitedBy.name || invitedBy.email,
          workspaceName: workspace.name,
          inviteUrl: `${appUrl}/workspaces/${workspaceId}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        }),
      });

      // Log invitation
      await logAuditEvent({
        event: AuditEvent.MEMBER_INVITED,
        userId: invitedByUserId,
        workspaceId,
        metadata: { invitedUserId: existingUser.id, invitedEmail: email, role },
      });

      return { success: true };
    }

    // User doesn't exist - create invitation token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store invitation in database
    await prisma.workspaceInvitation.create({
      data: {
        email,
        workspaceId,
        invitedById: invitedByUserId,
        role,
        token: inviteToken,
        expiresAt,
        status: 'PENDING',
      },
    });

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite/accept?token=${inviteToken}`;

    const emailResult = await emailService.sendEmail({
      to: email,
      template: emailService.invitationEmail({
        invitedByName: invitedBy.name || invitedBy.email,
        workspaceName: workspace.name,
        inviteUrl,
        expiresAt,
      }),
    });

    if (!emailResult.success) {
      // If email fails, delete the invitation
      await prisma.workspaceInvitation.delete({
        where: { token: inviteToken },
      });
      return { success: false, error: `Failed to send invitation email: ${emailResult.error}` };
    }

    // Log invitation
    await logAuditEvent({
      event: AuditEvent.MEMBER_INVITED,
      userId: invitedByUserId,
      workspaceId,
      metadata: { invitedEmail: email, role, token: inviteToken },
    });

    return { success: true, inviteToken };
  } catch (error) {
    console.error('Invite member error:', error);
    return { success: false, error: 'Failed to invite member' };
  }
}

/**
 * Accept a workspace invitation
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<{ success: boolean; error?: string; workspaceId?: string }> {
  try {
    // Find invitation
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return { success: false, error: 'Invalid invitation token' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, error: `Invitation is already ${invitation.status.toLowerCase()}` };
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.workspaceInvitation.update({
        where: { token },
        data: { status: 'EXPIRED' },
      });
      return { success: false, error: 'Invitation has expired' };
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify email matches
    if (user.email !== invitation.email) {
      return { success: false, error: 'Invitation email does not match your account email' };
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    });

    if (existingMember) {
      // Update invitation status and return success
      await prisma.workspaceInvitation.update({
        where: { token },
        data: { status: 'ACCEPTED' },
      });
      return { success: true, workspaceId: invitation.workspaceId };
    }

    // Create membership
    await prisma.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        status: 'ACTIVE',
        invitedBy: invitation.invitedById,
        invitedAt: invitation.createdAt,
      },
    });

    // Mark invitation as accepted
    await prisma.workspaceInvitation.update({
      where: { token },
      data: { status: 'ACCEPTED' },
    });

    // Log acceptance
    await logAuditEvent({
      event: AuditEvent.MEMBER_INVITED,
      userId,
      workspaceId: invitation.workspaceId,
      metadata: { action: 'accepted_invitation', token },
    });

    return { success: true, workspaceId: invitation.workspaceId };
  } catch (error) {
    console.error('Accept invitation error:', error);
    return { success: false, error: 'Failed to accept invitation' };
  }
}

/**
 * Cancel/revoke an invitation
 */
export async function cancelInvitation(
  token: string,
  cancelledByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, error: `Invitation is already ${invitation.status.toLowerCase()}` };
    }

    // Update to cancelled
    await prisma.workspaceInvitation.update({
      where: { token },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: cancelledByUserId,
      },
    });

    // Log cancellation
    await logAuditEvent({
      event: AuditEvent.MEMBER_REMOVED,
      userId: cancelledByUserId,
      workspaceId: invitation.workspaceId,
      metadata: { action: 'cancelled_invitation', token },
    });

    return { success: true };
  } catch (error) {
    console.error('Cancel invitation error:', error);
    return { success: false, error: 'Failed to cancel invitation' };
  }
}

/**
 * Get pending invitations for a workspace
 */
export async function getWorkspaceInvitations(workspaceId: string): Promise<
  Array<{
    id: string;
    email: string;
    role: MemberRole;
    status: string;
    expiresAt: Date;
    invitedBy: { id: string; name: string | null; email: string };
  }>
> {
  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role as MemberRole,
    status: inv.status,
    expiresAt: inv.expiresAt,
    invitedBy: inv.invitedBy,
  }));
}

/**
 * Clean up expired invitations
 */
export async function cleanupExpiredInvitations(): Promise<{ expired: number }> {
  const result = await prisma.workspaceInvitation.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return { expired: result.count };
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
      return {
        success: false,
        error: 'Workspace owner cannot leave. Transfer ownership or delete workspace.',
      };
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
