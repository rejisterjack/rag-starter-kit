import crypto from 'node:crypto';

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';

import type { MemberRole, Workspace, WorkspaceMember } from './types';

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

export interface WorkspaceWithMembers {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  avatar: string | null;
  ownerId: string;
  plan: string;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
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
      description: data.description ?? null,
      logoUrl: data.avatar ?? null,
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

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    avatar: workspace.logoUrl,
    ownerId: workspace.ownerId,
    plan: 'FREE',
    settings: workspace.settings as Record<string, unknown> | null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
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
  const result = await prisma.workspace.findUnique({
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
  });

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    slug: result.slug,
    description: result.description,
    logoUrl: result.logoUrl,
    avatar: result.logoUrl,
    ownerId: result.ownerId,
    plan: 'FREE',
    settings: result.settings as Record<string, unknown> | null,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    members: result.members as unknown as WorkspaceWithMembers['members'],
    owner: result.owner,
    _count: result._count,
  };
}

/**
 * Get workspace by slug
 */
export async function getWorkspaceBySlug(slug: string): Promise<WorkspaceWithMembers | null> {
  const result = await prisma.workspace.findUnique({
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
  });

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    slug: result.slug,
    description: result.description,
    logoUrl: result.logoUrl,
    avatar: result.logoUrl,
    ownerId: result.ownerId,
    plan: 'FREE',
    settings: result.settings as Record<string, unknown> | null,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    members: result.members as unknown as WorkspaceWithMembers['members'],
    owner: result.owner,
    _count: result._count,
  };
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

  return members.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    description: m.workspace.description,
    logoUrl: m.workspace.logoUrl,
    avatar: m.workspace.logoUrl,
    ownerId: m.workspace.ownerId,
    plan: 'FREE',
    settings: m.workspace.settings as Record<string, unknown> | null,
    createdAt: m.workspace.createdAt,
    updatedAt: m.workspace.updatedAt,
    members: m.workspace.members as unknown as WorkspaceWithMembers['members'],
    owner: m.workspace.owner,
    _count: m.workspace._count,
  }));
}

/**
 * Update workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  data: UpdateWorkspaceInput
): Promise<Workspace> {
  // Build update data dynamically
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.avatar !== undefined) updateData.logoUrl = data.avatar ?? null;
  if (data.settings !== undefined) updateData.settings = data.settings;

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: updateData,
  });

  // Log workspace update
  await logAuditEvent({
    event: AuditEvent.WORKSPACE_UPDATED,
    workspaceId,
    metadata: updateData,
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    avatar: workspace.logoUrl,
    ownerId: workspace.ownerId,
    plan: 'FREE',
    settings: workspace.settings as Record<string, unknown> | null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
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

  if (!membership) return null;

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    description: membership.workspace.description,
    avatar: membership.workspace.logoUrl,
    ownerId: membership.workspace.ownerId,
    plan: 'FREE',
    settings: membership.workspace.settings as Record<string, unknown> | null,
    createdAt: membership.workspace.createdAt,
    updatedAt: membership.workspace.updatedAt,
  };
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

    // User doesn't exist - create invitation
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store invitation in database
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        token: inviteToken,
        expiresAt,
        invitedById: invitedByUserId,
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
        where: { id: invitation.id },
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
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
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
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
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
      },
    });

    // Mark invitation as accepted
    await prisma.workspaceInvitation.update({
      where: { token },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
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
    logger.error('Accept invitation error', { error: error instanceof Error ? error.message : 'Unknown' });
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
    logger.error('Cancel invitation error', { error: error instanceof Error ? error.message : 'Unknown' });
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
    orderBy: { invitedAt: 'desc' },
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
