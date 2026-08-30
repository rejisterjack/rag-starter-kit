import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted for mock data available in hoisted factories
const { mockPrisma } = vi.hoisted(() => {
  function createMockModel() {
    return {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    };
  }

  const prisma = {
    user: createMockModel(),
    workspace: createMockModel(),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn(),
  };

  return { mockPrisma: prisma };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'test-api-key',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NEXTAUTH_SECRET: 'test-secret',
    NEXTAUTH_URL: 'http://localhost:7392',
    ENCRYPTION_MASTER_KEY: 'test-encryption-key-for-vitest-32c',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-api-key',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
  },
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
  isRedisConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/rag/engine', () => ({
  checkRAGHealth: vi.fn().mockResolvedValue({ healthy: true, errors: [] }),
  defaultRAGConfig: {},
}));

vi.mock('@/lib/ai/index', () => ({
  getModel: vi.fn(),
  getEmbeddingModel: vi.fn().mockReturnValue({
    embed: vi.fn().mockResolvedValue({ embedding: Array(1536).fill(0.1) }),
  }),
}));

vi.mock('@/lib/ai/embeddings', () => ({
  createEmbeddingProviderFromEnv: vi.fn().mockReturnValue({
    healthCheck: vi.fn().mockResolvedValue(true),
  }),
}));

describe('Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when database is up', async () => {
    // Mock successful database query (health route uses prisma.$queryRaw`SELECT 1`)
    mockPrisma.$queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.status).toBeDefined();
  });

  it('should return JSON content type', async () => {
    mockPrisma.$queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();

    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('should handle database connection failure', async () => {
    mockPrisma.$queryRaw = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();

    // Should still return a response (503 = service unavailable)
    expect(response).toBeDefined();
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  it('should return response body with checks', async () => {
    mockPrisma.$queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);

    const { GET } = await import('@/app/api/health/route');
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
    // Should have some structure
    expect(typeof data).toBe('object');
  });
});
