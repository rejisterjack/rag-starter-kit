/**
 * Prisma Client Mock
 * 
 * Provides a mock Prisma client for unit and integration tests.
 * Uses vitest's mocking utilities to create type-safe mocks.
 */

import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

/**
 * Creates a mock Prisma client with all models and methods
 */
export const createMockPrismaClient = (): DeepMockProxy<PrismaClient> => {
  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $extends: vi.fn(),

    // User model
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Workspace model
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Document model
    document: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Chunk model
    chunk: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Chat model
    chat: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Message model
    message: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Membership model (workspace members)
    membership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // TokenUsage model
    tokenUsage: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  } as unknown as DeepMockProxy<PrismaClient>;
};

/**
 * Type helper for deep mock proxy
 */
export type DeepMockProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer _A) => infer _R
    ? MockFunction<T[K]>
    : T[K] extends object
    ? DeepMockProxy<T[K]>
    : T[K];
};

type MockFunction<T extends (...args: any[]) => any> = T & {
  mockResolvedValue: (value: Awaited<ReturnType<T>>) => void;
  mockRejectedValue: (value: any) => void;
  mockReturnValue: (value: ReturnType<T>) => void;
  mockImplementation: (fn: T) => void;
};

/**
 * Singleton mock Prisma instance for tests
 */
export const mockPrisma = createMockPrismaClient();

/**
 * Reset all mock implementations between tests
 */
export const resetPrismaMocks = (): void => {
  vi.clearAllMocks();
};

/**
 * Helper to mock Prisma's $transaction
 */
export const mockTransaction = <T>(results: T[]): void => {
  (mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (operations: Promise<any>[]) => {
      return Promise.all(operations.map((_, i) => Promise.resolve(results[i])));
    }
  );
};

/**
 * Helper to mock vector search query
 */
export const mockVectorSearch = (results: any[]): void => {
  (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(results);
};
