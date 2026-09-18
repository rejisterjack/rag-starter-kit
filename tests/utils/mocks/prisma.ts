/**
 * Prisma Mock for Testing
 *
 * Mock implementation of Prisma client for unit and integration tests.
 * This avoids the need for a real database connection in tests.
 */

import { vi } from 'vitest';

// =============================================================================
// Types
// =============================================================================

/**
 * Deep mock proxy type that recursively mocks all properties as vi.fn()
 */
export type DeepMockProxy<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown
    ? ReturnType<typeof vi.fn>
    : T[K] extends object
      ? DeepMockProxy<T[K]>
      : T[K];
};

// Type for a mock model with all standard Prisma operations
interface MockModel {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
}

// Type for the full mock Prisma client
interface MockPrismaClient {
  [key: string]: MockModel | ReturnType<typeof vi.fn>;
  user: MockModel;
  account: MockModel;
  session: MockModel;
  verificationToken: MockModel;
  workspace: MockModel;
  membership: MockModel;
  workspaceInvitation: MockModel;
  document: MockModel;
  chunk: MockModel;
  documentChunk: MockModel;
  documentImage: MockModel;
  imageEmbedding: MockModel;
  ingestionJob: MockModel;
  chat: MockModel;
  message: MockModel;
  messageFeedback: MockModel;
  chatShare: MockModel;
  documentTag: MockModel;
  documentTagsOnDocuments: MockModel;
  documentCollection: MockModel;
  documentCollectionsOnDocuments: MockModel;
  apiKey: MockModel;
  apiUsage: MockModel;
  tokenUsage: MockModel;
  auditLog: MockModel;
  rateLimit: MockModel;
  ragEvent: MockModel;
  retrievedChunk: MockModel;
  metric: MockModel;
  integrationAccount: MockModel;
  experiment: MockModel;
  experimentEvent: MockModel;
  samlConnection: MockModel;
  webhook: MockModel;
  webhookDelivery: MockModel;
  consent: MockModel;
  passwordReset: MockModel;
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $executeRaw: ReturnType<typeof vi.fn>;
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $extends: ReturnType<typeof vi.fn>;
}

// =============================================================================
// Mock Data
// =============================================================================

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

// =============================================================================
// Helper: Create a mock model with all standard Prisma operations
// =============================================================================

function createMockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

// =============================================================================
// Mock Prisma Client
// =============================================================================

/**
 * Standard mock Prisma client that covers all models and common operations.
 */
export const mockPrisma = {
  // Auth models
  user: createMockModel(),
  account: createMockModel(),
  session: createMockModel(),
  verificationToken: createMockModel(),

  // Workspace models
  workspace: createMockModel(),
  membership: createMockModel(),
  workspaceInvitation: createMockModel(),

  // Document models
  document: createMockModel(),
  chunk: createMockModel(),
  documentChunk: createMockModel(),
  documentImage: createMockModel(),
  imageEmbedding: createMockModel(),
  ingestionJob: createMockModel(),

  // Chat models
  chat: createMockModel(),
  message: createMockModel(),
  messageFeedback: createMockModel(),
  chatShare: createMockModel(),

  // Organization models
  documentTag: createMockModel(),
  documentTagsOnDocuments: createMockModel(),
  documentCollection: createMockModel(),
  documentCollectionsOnDocuments: createMockModel(),

  // API models
  apiKey: createMockModel(),
  apiUsage: createMockModel(),
  tokenUsage: createMockModel(),

  // Audit & Security
  auditLog: createMockModel(),
  rateLimit: createMockModel(),

  // Analytics
  ragEvent: createMockModel(),
  retrievedChunk: createMockModel(),
  metric: createMockModel(),

  // Integration & Experiment
  integrationAccount: createMockModel(),
  experiment: createMockModel(),
  experimentEvent: createMockModel(),

  // SAML & Webhooks
  samlConnection: createMockModel(),
  webhook: createMockModel(),
  webhookDelivery: createMockModel(),

  // GDPR
  consent: createMockModel(),

  // Legacy aliases used in some tests
  passwordReset: createMockModel(),

  // Prisma client methods
  $transaction: vi.fn((fnOrOptions: unknown) => {
    if (typeof fnOrOptions === 'function') {
      return fnOrOptions(mockPrisma);
    }
    return Promise.resolve([]);
  }) as ReturnType<typeof vi.fn>,
  $queryRaw: vi.fn().mockResolvedValue([]),
  $executeRaw: vi.fn().mockResolvedValue(0),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $extends: vi.fn().mockReturnValue({}) as ReturnType<typeof vi.fn>,
} satisfies MockPrismaClient;

// =============================================================================
// Reset Helpers
// =============================================================================

/**
 * Reset all mocks before each test
 */
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

  // Reset $queryRaw to default empty result
  mockPrisma.$queryRaw.mockResolvedValue([]);
}

/**
 * Setup default mock returns
 */
export function setupDefaultMockReturns() {
  mockPrisma.user.findUnique.mockResolvedValue(mockUsers[0]);
  mockPrisma.workspace.findMany.mockResolvedValue(mockWorkspaces);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Get the mock Prisma client (alias for direct access)
 * Useful when tests need to dynamically assign properties like $queryRaw
 */
export function getMockPrisma() {
  return mockPrisma;
}

/**
 * Create a fresh mock Prisma client for isolated test scenarios
 */
export function createMockPrismaClient(): MockPrismaClient {
  const client: MockPrismaClient = {
    user: createMockModel(),
    account: createMockModel(),
    session: createMockModel(),
    verificationToken: createMockModel(),
    workspace: createMockModel(),
    membership: createMockModel(),
    workspaceInvitation: createMockModel(),
    document: createMockModel(),
    chunk: createMockModel(),
    documentChunk: createMockModel(),
    documentImage: createMockModel(),
    imageEmbedding: createMockModel(),
    ingestionJob: createMockModel(),
    chat: createMockModel(),
    message: createMockModel(),
    messageFeedback: createMockModel(),
    chatShare: createMockModel(),
    documentTag: createMockModel(),
    documentTagsOnDocuments: createMockModel(),
    documentCollection: createMockModel(),
    documentCollectionsOnDocuments: createMockModel(),
    apiKey: createMockModel(),
    apiUsage: createMockModel(),
    tokenUsage: createMockModel(),
    auditLog: createMockModel(),
    rateLimit: createMockModel(),
    ragEvent: createMockModel(),
    retrievedChunk: createMockModel(),
    metric: createMockModel(),
    integrationAccount: createMockModel(),
    experiment: createMockModel(),
    experimentEvent: createMockModel(),
    samlConnection: createMockModel(),
    webhook: createMockModel(),
    webhookDelivery: createMockModel(),
    consent: createMockModel(),
    passwordReset: createMockModel(),

    $transaction: vi.fn((fnOrOptions: unknown) => {
      if (typeof fnOrOptions === 'function') {
        return fnOrOptions(client);
      }
      return Promise.resolve([]);
    }) as ReturnType<typeof vi.fn>,
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $extends: vi.fn().mockReturnValue({}) as ReturnType<typeof vi.fn>,
  };

  return client;
}

// =============================================================================
// Specialized Mock Helpers
// =============================================================================

/**
 * Mock $transaction that invokes the callback with the mock Prisma client
 */
export function mockTransaction(
  implementation?: (prisma: MockPrismaClient) => Promise<unknown>
): void {
  if (implementation) {
    mockPrisma.$transaction.mockImplementation(
      (fn: (prisma: MockPrismaClient) => Promise<unknown>) => fn(mockPrisma)
    );
  } else {
    mockPrisma.$transaction.mockImplementation(
      (fn: (prisma: MockPrismaClient) => Promise<unknown>) => fn(mockPrisma)
    );
  }
}

/**
 * Mock vector search via $queryRaw that returns pre-configured results
 */
export function mockVectorSearch(results: unknown[] = []): void {
  mockPrisma.$queryRaw.mockResolvedValue(results);
}
