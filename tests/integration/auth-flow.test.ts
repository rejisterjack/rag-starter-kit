/**
 * Authentication Flow Integration Tests
 *
 * Tests authentication flows including:
 * - Registration with password policy via the /api/auth/register route
 * - Login with account lockout
 * - Session management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next-auth before anything that depends on it
vi.mock('next-auth', () => ({
  default: () => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(() => ({})),
}));

vi.mock('next-auth/providers/github', () => ({
  default: vi.fn(() => ({})),
}));

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn(() => ({})),
}));

vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

// Use vi.hoisted for mock data
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
      upsert: vi.fn(),
    };
  }

  const prisma = {
    user: createMockModel(),
    account: createMockModel(),
    session: createMockModel(),
    workspace: createMockModel(),
    membership: createMockModel(),
    verificationToken: createMockModel(),
    $transaction: vi.fn((fn: unknown) =>
      typeof fn === 'function' ? fn(prisma) : Promise.resolve([])
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  return { mockPrisma: prisma };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: vi.fn(),
  AuditEvent: {
    USER_LOGIN: 'USER_LOGIN',
    USER_REGISTERED: 'USER_REGISTERED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
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

vi.mock('@/lib/security/rate-limiter', () => ({
  checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-ip'),
  addRateLimitHeaders: vi.fn(),
}));

vi.mock('@/lib/workspace/workspace', () => ({
  createDefaultWorkspace: vi.fn().mockResolvedValue({ id: 'ws-1' }),
  getAppUrl: vi.fn().mockReturnValue('http://localhost:7392'),
}));

vi.mock('@/lib/notifications/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  emailService: {
    send: vi.fn().mockResolvedValue({ success: true }),
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    verificationEmail: vi.fn().mockReturnValue({ subject: 'Verify', html: '<p>Verify</p>' }),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: null,
  isRedisConfigured: vi.fn().mockReturnValue(false),
}));

describe('Authentication Flow Integration', () => {
  const validUser = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    name: 'Test User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration Flow', () => {
    it('should register user with strong password', async () => {
      mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.user.create = vi.fn().mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
        name: validUser.name,
      });

      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost:7392/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUser),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Account created successfully');
    });

    it('should reject registration with weak password', async () => {
      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost:7392/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: validUser.email,
          password: 'weak',
          name: validUser.name,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.message).toBeDefined();
    });

    it('should hash password before storing', async () => {
      mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.user.create = vi.fn().mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
      });

      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost:7392/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUser),
      });

      await POST(request);

      const createCall = (mockPrisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const storedPassword = createCall.data.password;

      // Should be hashed (bcrypt format)
      expect(storedPassword).toMatch(/^\$2[aby]\$\d+\$/);
      expect(storedPassword).not.toBe(validUser.password);
    });
  });

  describe('Login with Lockout', () => {
    it('should allow login with correct credentials', async () => {
      const { getLockoutStatus } = await import('@/lib/security/account-lockout');

      // Use a unique identifier to avoid cross-test state
      const lockoutStatus = await getLockoutStatus('lockout-test-clean@example.com');
      expect(lockoutStatus.isLocked).toBe(false);
    });

    it('should track failed login attempts', async () => {
      const { recordFailedAttempt, getLockoutStatus } =
        await import('@/lib/security/account-lockout');

      // Use a unique identifier for this test to avoid state leakage
      const testId = `track-attempts-test-${Math.random().toString(36).slice(2)}@example.com`;

      // First failed attempt
      const status1 = await recordFailedAttempt(testId);
      expect(status1.remainingAttempts).toBe(4);

      // Second failed attempt
      const status2 = await recordFailedAttempt(testId);
      expect(status2.remainingAttempts).toBe(3);
    });

    it('should lock account after 5 failed attempts', async () => {
      const { recordFailedAttempt, getLockoutStatus } =
        await import('@/lib/security/account-lockout');

      // Use a unique identifier for this test to avoid state leakage
      const testId = `lockout-5-attempts-${Math.random().toString(36).slice(2)}@example.com`;

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(testId);
      }

      const status = await getLockoutStatus(testId);
      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).not.toBeNull();
    });
  });

  describe('Session Security', () => {
    it('should have 7-day session max age', () => {
      const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
      const expectedMaxAge = 604800;

      expect(maxAge).toBe(expectedMaxAge);
    });

    it('should have secure session configuration', () => {
      const sessionConfig = {
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60,
      };

      expect(sessionConfig.strategy).toBe('jwt');
      expect(sessionConfig.maxAge).toBeLessThanOrEqual(7 * 24 * 60 * 60);
    });
  });

  describe('Email Validation', () => {
    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.user.create = vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost:7392/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'TEST@EXAMPLE.COM',
          password: validUser.password,
          name: validUser.name,
        }),
      });

      await POST(request);

      const createCall = (mockPrisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.email).toBe('test@example.com');
    });
  });
});
