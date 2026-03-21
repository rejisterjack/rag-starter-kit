/**
 * Prisma Mock for Testing
 *
 * Mock implementation of Prisma client for unit and integration tests.
 * This avoids the need for a real database connection in tests.
 */

import { vi } from 'vitest';

// Mock user data
export const mockUsers = [
  {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock workspace data
export const mockWorkspaces = [
  {
    id: 'workspace-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock Prisma client
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  chat: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  message: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

// Reset all mocks before each test
export function resetPrismaMocks() {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as ReturnType<typeof vi.fn>).mockReset();
        }
      });
    }
  });
}

// Setup default mock returns
export function setupDefaultMockReturns() {
  mockPrisma.user.findUnique.mockResolvedValue(mockUsers[0]);
  mockPrisma.workspace.findMany.mockResolvedValue(mockWorkspaces);
}
