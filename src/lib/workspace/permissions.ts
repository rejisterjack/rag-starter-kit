import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';

import type { MemberRole } from './types';

// =============================================================================
// Permission Definitions
// =============================================================================

export enum Permission {
  // Document permissions
  READ_DOCUMENTS = 'read:documents',
  WRITE_DOCUMENTS = 'write:documents',
  DELETE_DOCUMENTS = 'delete:documents',
  SHARE_DOCUMENTS = 'share:documents',

  // Chat permissions
  READ_CHATS = 'read:chats',
  WRITE_CHATS = 'write:chats',
  DELETE_CHATS = 'delete:chats',

  // Workspace permissions
  MANAGE_WORKSPACE = 'manage:workspace',
  MANAGE_MEMBERS = 'manage:members',
  MANAGE_SETTINGS = 'manage:settings',
  MANAGE_BILLING = 'manage:billing',

  // API permissions
  MANAGE_API_KEYS = 'manage:api_keys',
  READ_API_USAGE = 'read:api_usage',

  // Admin permissions
  VIEW_AUDIT_LOGS = 'view:audit_logs',
  DELETE_WORKSPACE = 'delete:workspace',
}

// =============================================================================
// Role-Based Permission Mapping
// =============================================================================

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    // Full access
    Permission.READ_DOCUMENTS,
    Permission.WRITE_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.READ_CHATS,
    Permission.WRITE_CHATS,
    Permission.DELETE_CHATS,
    Permission.MANAGE_WORKSPACE,
    Permission.MANAGE_MEMBERS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_BILLING,
    Permission.MANAGE_API_KEYS,
    Permission.READ_API_USAGE,
    Permission.VIEW_AUDIT_LOGS,
    Permission.DELETE_WORKSPACE,
  ],
  ADMIN: [
    Permission.READ_DOCUMENTS,
    Permission.WRITE_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.READ_CHATS,
    Permission.WRITE_CHATS,
    Permission.DELETE_CHATS,
    Permission.MANAGE_WORKSPACE,
    Permission.MANAGE_MEMBERS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_API_KEYS,
    Permission.READ_API_USAGE,
    Permission.VIEW_AUDIT_LOGS,
  ],
  MEMBER: [
    Permission.READ_DOCUMENTS,
    Permission.WRITE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.READ_CHATS,
    Permission.WRITE_CHATS,
    Permission.DELETE_CHATS,
  ],
  VIEWER: [Permission.READ_DOCUMENTS, Permission.READ_CHATS],
};

// =============================================================================
// Permission Checking
// =============================================================================

export interface PermissionCheckResult {
  allowed: boolean;
  role?: MemberRole;
  missingPermissions?: Permission[];
}

/**
 * Check if a user has a specific permission in a workspace
 */
export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: Permission
): Promise<boolean> {
  const result = await checkPermissions(userId, workspaceId, [permission]);
  return result.allowed;
}

/**
 * Check if a user has all specified permissions in a workspace
 */
export async function checkPermissions(
  userId: string,
  workspaceId: string,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  // Get user's membership in workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    return {
      allowed: false,
      missingPermissions: permissions,
    };
  }

  // Get role permissions
  const rolePermissions = ROLE_PERMISSIONS[membership.role];

  // Check if user has all required permissions
  const missingPermissions = permissions.filter((permission) => {
    return !rolePermissions.includes(permission);
  });

  if (missingPermissions.length > 0) {
    // Log permission denied
    await logAuditEvent({
      event: AuditEvent.PERMISSION_DENIED,
      userId,
      workspaceId,
      metadata: {
        requiredPermissions: permissions,
        missingPermissions,
        role: membership.role,
      },
      severity: 'WARNING',
    });

    return {
      allowed: false,
      role: membership.role,
      missingPermissions,
    };
  }

  return {
    allowed: true,
    role: membership.role,
  };
}

/**
 * Require a specific permission - throws if not allowed
 */
export async function requirePermission(
  userId: string,
  workspaceId: string,
  permission: Permission
): Promise<void> {
  const result = await checkPermission(userId, workspaceId, permission);
  if (!result) {
    throw new PermissionError(`Missing permission: ${permission}`);
  }
}

/**
 * Get all permissions for a user in a workspace
 */
export async function getUserPermissions(
  userId: string,
  workspaceId: string
): Promise<Permission[]> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    return [];
  }

  return ROLE_PERMISSIONS[membership.role];
}

/**
 * Check if user is workspace owner
 */
export async function isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  return workspace?.ownerId === userId;
}

/**
 * Check if user is workspace admin or owner
 */
export async function isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      role: { in: ['OWNER', 'ADMIN'] },
      status: 'ACTIVE',
    },
  });

  return !!membership;
}

// =============================================================================
// Permission Error
// =============================================================================

export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PERMISSION_DENIED',
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

// =============================================================================
// Helper Functions for Common Checks
// =============================================================================

/**
 * Check if user can read documents
 */
export async function canReadDocuments(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
}

/**
 * Check if user can write documents
 */
export async function canWriteDocuments(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.WRITE_DOCUMENTS);
}

/**
 * Check if user can delete documents
 */
export async function canDeleteDocuments(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.DELETE_DOCUMENTS);
}

/**
 * Check if user can manage workspace
 */
export async function canManageWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.MANAGE_WORKSPACE);
}

/**
 * Check if user can manage members
 */
export async function canManageMembers(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.MANAGE_MEMBERS);
}

/**
 * Check if user can manage API keys
 */
export async function canManageApiKeys(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.MANAGE_API_KEYS);
}

/**
 * Check if user can view audit logs
 */
export async function canViewAuditLogs(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, Permission.VIEW_AUDIT_LOGS);
}

// =============================================================================
// Middleware Helper
// =============================================================================

export interface PermissionContext {
  userId: string;
  workspaceId: string;
  role: MemberRole;
  permissions: Permission[];
}

/**
 * Build permission context for a request
 */
export async function buildPermissionContext(
  userId: string,
  workspaceId: string
): Promise<PermissionContext | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    return null;
  }

  const permissions = await getUserPermissions(userId, workspaceId);

  return {
    userId,
    workspaceId,
    role: membership.role,
    permissions,
  };
}
