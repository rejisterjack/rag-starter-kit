/**
 * Workspace Fixtures
 *
 * Sample workspaces for testing multi-tenancy and collaboration features.
 */

import type { Workspace, WorkspaceMember, WorkspaceRole, MemberStatus } from '@prisma/client';

// =============================================================================
// Workspace Types
// =============================================================================

type WorkspacePlan = 'free' | 'pro' | 'enterprise';

type WorkspaceWithPlan = Workspace & {
  plan: WorkspacePlan;
  storageUsed: number;
  memberCount: number;
  documentCount: number;
  deletedAt?: Date | null;
};

type MembershipWithRole = WorkspaceMember & {
  role: WorkspaceRole | 'owner' | 'admin' | 'member' | 'viewer';
  invitedEmail: string | null;
};

// =============================================================================
// Workspace Fixtures
// =============================================================================

/**
 * Personal workspace fixture
 */
export const personalWorkspace: Partial<WorkspaceWithPlan> = {
  id: 'workspace-001',
  name: 'Personal Workspace',
  slug: 'personal-workspace',
  description: 'My personal workspace',
  plan: 'free',
  storageUsed: 50_000_000, // 50MB
  memberCount: 1,
  documentCount: 5,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
};

/**
 * Team workspace fixture
 */
export const teamWorkspace: Partial<WorkspaceWithPlan> = {
  id: 'workspace-002',
  name: 'Engineering Team',
  slug: 'engineering-team',
  description: 'Workspace for the engineering team',
  plan: 'pro',
  storageUsed: 500_000_000, // 500MB
  memberCount: 10,
  documentCount: 50,
  createdAt: new Date('2023-12-01'),
  updatedAt: new Date('2024-01-20'),
};

/**
 * Enterprise workspace fixture
 */
export const enterpriseWorkspace: Partial<WorkspaceWithPlan> = {
  id: 'workspace-003',
  name: 'Acme Corp',
  slug: 'acme-corp',
  description: 'Enterprise workspace for Acme Corporation',
  plan: 'enterprise',
  storageUsed: 5_000_000_000, // 5GB
  memberCount: 100,
  documentCount: 500,
  createdAt: new Date('2023-06-01'),
  updatedAt: new Date('2024-01-25'),
};

/**
 * Archived workspace fixture
 */
export const archivedWorkspace: Partial<WorkspaceWithPlan> = {
  id: 'workspace-004',
  name: 'Old Project',
  slug: 'old-project',
  description: 'Archived project workspace',
  plan: 'free',
  storageUsed: 100_000_000, // 100MB
  memberCount: 3,
  documentCount: 10,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-12-31'),
  deletedAt: new Date('2023-12-31'),
};

/**
 * Collection of all workspace fixtures
 */
export const allWorkspaces: Partial<WorkspaceWithPlan>[] = [
  personalWorkspace,
  teamWorkspace,
  enterpriseWorkspace,
  archivedWorkspace,
];

// =============================================================================
// Membership Fixtures
// =============================================================================

/**
 * Owner membership fixture
 */
export const ownerMembership: Partial<MembershipWithRole> = {
  id: 'membership-001',
  userId: 'user-001',
  workspaceId: 'workspace-001',
  role: 'OWNER',
  status: 'ACTIVE' as MemberStatus,
  invitedEmail: null,
  joinedAt: new Date('2024-01-01'),
};

/**
 * Admin membership fixture
 */
export const adminMembership: Partial<MembershipWithRole> = {
  id: 'membership-002',
  userId: 'user-002',
  workspaceId: 'workspace-002',
  role: 'ADMIN',
  status: 'ACTIVE' as MemberStatus,
  invitedEmail: null,
  joinedAt: new Date('2023-12-01'),
};

/**
 * Member membership fixture
 */
export const memberMembership: Partial<MembershipWithRole> = {
  id: 'membership-003',
  userId: 'user-003',
  workspaceId: 'workspace-002',
  role: 'MEMBER',
  status: 'ACTIVE' as MemberStatus,
  invitedEmail: null,
  joinedAt: new Date('2023-12-15'),
};

/**
 * Viewer membership fixture
 */
export const viewerMembership: Partial<MembershipWithRole> = {
  id: 'membership-004',
  userId: 'user-004',
  workspaceId: 'workspace-002',
  role: 'VIEWER',
  status: 'ACTIVE' as MemberStatus,
  invitedEmail: null,
  joinedAt: new Date('2024-01-01'),
};

/**
 * Pending membership fixture
 */
export const pendingMembership: Partial<MembershipWithRole> = {
  id: 'membership-005',
  userId: 'user-005',
  workspaceId: 'workspace-003',
  role: 'MEMBER',
  status: 'PENDING' as MemberStatus,
  invitedEmail: 'pending@example.com',
  joinedAt: undefined, // Not joined yet
};

/**
 * Collection of all membership fixtures
 */
export const allMemberships: Partial<MembershipWithRole>[] = [
  ownerMembership,
  adminMembership,
  memberMembership,
  viewerMembership,
  pendingMembership,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock workspace with custom properties
 */
export function createMockWorkspace(
  overrides: Partial<WorkspaceWithPlan> = {}
): Partial<WorkspaceWithPlan> {
  const now = Date.now();
  return {
    id: `workspace-${now}`,
    name: 'Test Workspace',
    slug: `test-workspace-${now}`,
    description: 'A test workspace',
    plan: 'free',
    storageUsed: 0,
    memberCount: 1,
    documentCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock membership with custom properties
 */
export function createMockMembership(
  overrides: Partial<MembershipWithRole> = {}
): Partial<MembershipWithRole> {
  return {
    id: `membership-${Date.now()}`,
    userId: 'user-001',
    workspaceId: 'workspace-001',
    role: 'MEMBER',
    status: 'ACTIVE' as MemberStatus,
    invitedEmail: null,
    joinedAt: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Plan Limits
// =============================================================================

export interface PlanLimit {
  maxMembers: number;
  maxStorage: number;
  maxDocuments: number;
  features: string[];
}

export const planLimits: Record<WorkspacePlan, PlanLimit> = {
  free: {
    maxMembers: 3,
    maxStorage: 100 * 1024 * 1024, // 100MB
    maxDocuments: 10,
    features: ['basic_chat', 'basic_upload'],
  },
  pro: {
    maxMembers: 20,
    maxStorage: 2 * 1024 * 1024 * 1024, // 2GB
    maxDocuments: 100,
    features: ['basic_chat', 'basic_upload', 'advanced_analytics', 'api_access'],
  },
  enterprise: {
    maxMembers: 1000,
    maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
    maxDocuments: 10000,
    features: ['all_features', 'sso', 'audit_logs', 'dedicated_support'],
  },
};

// =============================================================================
// Role Permissions
// =============================================================================

export interface RolePermissions {
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canManageBilling: boolean;
  canDeleteWorkspace: boolean;
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
  canViewAnalytics: boolean;
  canManageIntegrations: boolean;
}

export const rolePermissions: Record<string, RolePermissions> = {
  owner: {
    canManageWorkspace: true,
    canManageMembers: true,
    canManageBilling: true,
    canDeleteWorkspace: true,
    canUploadDocuments: true,
    canDeleteDocuments: true,
    canViewAnalytics: true,
    canManageIntegrations: true,
  },
  admin: {
    canManageWorkspace: true,
    canManageMembers: true,
    canManageBilling: false,
    canDeleteWorkspace: false,
    canUploadDocuments: true,
    canDeleteDocuments: true,
    canViewAnalytics: true,
    canManageIntegrations: true,
  },
  member: {
    canManageWorkspace: false,
    canManageMembers: false,
    canManageBilling: false,
    canDeleteWorkspace: false,
    canUploadDocuments: true,
    canDeleteDocuments: false,
    canViewAnalytics: false,
    canManageIntegrations: false,
  },
  viewer: {
    canManageWorkspace: false,
    canManageMembers: false,
    canManageBilling: false,
    canDeleteWorkspace: false,
    canUploadDocuments: false,
    canDeleteDocuments: false,
    canViewAnalytics: false,
    canManageIntegrations: false,
  },
};
