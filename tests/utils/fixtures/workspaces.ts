/**
 * Workspace Fixtures
 * 
 * Sample workspaces for testing multi-tenancy and collaboration features.
 */

import type { Workspace, Membership } from '@prisma/client';

/**
 * Personal workspace fixture
 */
export const personalWorkspace: Partial<Workspace> = {
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
export const teamWorkspace: Partial<Workspace> = {
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
export const enterpriseWorkspace: Partial<Workspace> = {
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
export const archivedWorkspace: Partial<Workspace> = {
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
export const allWorkspaces: Partial<Workspace>[] = [
  personalWorkspace,
  teamWorkspace,
  enterpriseWorkspace,
  archivedWorkspace,
];

/**
 * Membership fixtures
 */
export const ownerMembership: Partial<Membership> = {
  id: 'membership-001',
  userId: 'user-001',
  workspaceId: 'workspace-001',
  role: 'owner',
  invitedEmail: null,
  joinedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const adminMembership: Partial<Membership> = {
  id: 'membership-002',
  userId: 'user-002',
  workspaceId: 'workspace-002',
  role: 'admin',
  invitedEmail: null,
  joinedAt: new Date('2023-12-01'),
  createdAt: new Date('2023-12-01'),
  updatedAt: new Date('2024-01-15'),
};

export const memberMembership: Partial<Membership> = {
  id: 'membership-003',
  userId: 'user-003',
  workspaceId: 'workspace-002',
  role: 'member',
  invitedEmail: null,
  joinedAt: new Date('2023-12-15'),
  createdAt: new Date('2023-12-15'),
  updatedAt: new Date('2024-01-10'),
};

export const viewerMembership: Partial<Membership> = {
  id: 'membership-004',
  userId: 'user-004',
  workspaceId: 'workspace-002',
  role: 'viewer',
  invitedEmail: null,
  joinedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const pendingMembership: Partial<Membership> = {
  id: 'membership-005',
  userId: 'user-005',
  workspaceId: 'workspace-003',
  role: 'member',
  invitedEmail: 'pending@example.com',
  joinedAt: null, // Not joined yet
  createdAt: new Date('2024-01-20'),
  updatedAt: new Date('2024-01-20'),
};

/**
 * Collection of all membership fixtures
 */
export const allMemberships: Partial<Membership>[] = [
  ownerMembership,
  adminMembership,
  memberMembership,
  viewerMembership,
  pendingMembership,
];

/**
 * Create a mock workspace with custom properties
 */
export const createMockWorkspace = (overrides: Partial<Workspace> = {}): Partial<Workspace> => ({
  id: `workspace-${Date.now()}`,
  name: 'Test Workspace',
  slug: `test-workspace-${Date.now()}`,
  description: 'A test workspace',
  plan: 'free',
  storageUsed: 0,
  memberCount: 1,
  documentCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Create a mock membership with custom properties
 */
export const createMockMembership = (overrides: Partial<Membership> = {}): Partial<Membership> => ({
  id: `membership-${Date.now()}`,
  userId: 'user-001',
  workspaceId: 'workspace-001',
  role: 'member',
  invitedEmail: null,
  joinedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Workspace plan limits
 */
export const planLimits = {
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

/**
 * Role permissions
 */
export const rolePermissions = {
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
