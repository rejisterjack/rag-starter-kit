/**
 * User Fixtures
 * 
 * Sample users for testing authentication and authorization.
 */

import type { User } from '@prisma/client';

/**
 * Regular user fixture
 */
export const regularUser: Partial<User> = {
  id: 'user-001',
  email: 'user@example.com',
  name: 'Regular User',
  image: 'https://example.com/avatar1.png',
  emailVerified: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Admin user fixture
 */
export const adminUser: Partial<User> = {
  id: 'user-002',
  email: 'admin@example.com',
  name: 'Admin User',
  image: 'https://example.com/avatar2.png',
  emailVerified: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Unverified user fixture
 */
export const unverifiedUser: Partial<User> = {
  id: 'user-003',
  email: 'unverified@example.com',
  name: 'Unverified User',
  image: null,
  emailVerified: null,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
};

/**
 * User with premium plan
 */
export const premiumUser: Partial<User> = {
  id: 'user-004',
  email: 'premium@example.com',
  name: 'Premium User',
  image: 'https://example.com/avatar4.png',
  emailVerified: new Date('2024-01-01'),
  createdAt: new Date('2023-12-01'),
  updatedAt: new Date('2024-01-15'),
};

/**
 * New user (recently created)
 */
export const newUser: Partial<User> = {
  id: 'user-005',
  email: 'newuser@example.com',
  name: 'New User',
  image: null,
  emailVerified: null,
  createdAt: new Date(), // Today
  updatedAt: new Date(),
};

/**
 * Collection of all user fixtures
 */
export const allUsers: Partial<User>[] = [
  regularUser,
  adminUser,
  unverifiedUser,
  premiumUser,
  newUser,
];

/**
 * Mock NextAuth session for regular user
 */
export const regularUserSession = {
  user: {
    id: regularUser.id!,
    email: regularUser.email!,
    name: regularUser.name!,
    image: regularUser.image!,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * Mock NextAuth session for admin user
 */
export const adminUserSession = {
  user: {
    id: adminUser.id!,
    email: adminUser.email!,
    name: adminUser.name!,
    image: adminUser.image!,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * Mock NextAuth session for unauthenticated user
 */
export const unauthenticatedSession = null;

/**
 * Create a mock user with custom properties
 */
export const createMockUser = (overrides: Partial<User> = {}): Partial<User> => ({
  id: `user-${Date.now()}`,
  email: `user${Date.now()}@example.com`,
  name: 'Test User',
  image: null,
  emailVerified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Mock user preferences
 */
export const mockUserPreferences = {
  theme: 'dark',
  language: 'en',
  notifications: {
    email: true,
    push: false,
  },
  defaultWorkspaceId: 'workspace-001',
};

/**
 * Mock OAuth accounts
 */
export const mockGitHubAccount = {
  provider: 'github',
  providerAccountId: '12345678',
  type: 'oauth',
  userId: regularUser.id,
  access_token: 'mock-github-token',
  token_type: 'bearer',
  scope: 'read:user user:email',
};

export const mockGoogleAccount = {
  provider: 'google',
  providerAccountId: '123456789012345678901',
  type: 'oauth',
  userId: adminUser.id,
  access_token: 'mock-google-token',
  refresh_token: 'mock-google-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'Bearer',
  scope: 'openid email profile',
  id_token: 'mock-id-token',
};
