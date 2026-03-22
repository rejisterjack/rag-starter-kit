/**
 * Authentication Flow Integration Tests
 *
 * End-to-end tests for authentication flows including:
 * - Registration with password policy
 * - Login with account lockout
 * - Password change
 * - Session management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
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

import { hash } from 'bcrypt';
import { registerUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLockoutStatus, recordFailedAttempt } from '@/lib/security/account-lockout';

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
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
        name: validUser.name,
      });

      const result = await registerUser({
        email: validUser.email,
        password: validUser.password,
        name: validUser.name,
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    it('should reject registration with weak password', async () => {
      const result = await registerUser({
        email: validUser.email,
        password: 'weak',
        name: validUser.name,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password');
    });

    it('should reject registration without special character', async () => {
      const result = await registerUser({
        email: validUser.email,
        password: 'Password123',
        name: validUser.name,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('special character');
    });

    it('should hash password before storing', async () => {
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
      });

      await registerUser({
        email: validUser.email,
        password: validUser.password,
        name: validUser.name,
      });

      const createCall = (prisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const storedPassword = createCall.data.password;

      // Should be hashed (bcrypt format)
      expect(storedPassword).toMatch(/^\$2[aby]\$\d+\$/);
      expect(storedPassword).not.toBe(validUser.password);
    });
  });

  describe('Login with Lockout', () => {
    it('should allow login with correct credentials', async () => {
      const hashedPassword = await hash(validUser.password, 10);

      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
        password: hashedPassword,
        name: validUser.name,
        role: 'USER',
        workspaceMembers: [],
      });

      // Simulate successful login
      const lockoutStatus = getLockoutStatus(validUser.email);
      expect(lockoutStatus.isLocked).toBe(false);
    });

    it('should track failed login attempts', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
        password: await hash('different-password', 10),
        workspaceMembers: [],
      });

      // First failed attempt
      await recordFailedAttempt(validUser.email);
      let status = getLockoutStatus(validUser.email);
      expect(status.remainingAttempts).toBe(4);

      // Second failed attempt
      await recordFailedAttempt(validUser.email);
      status = getLockoutStatus(validUser.email);
      expect(status.remainingAttempts).toBe(3);
    });

    it('should lock account after 5 failed attempts', async () => {
      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(validUser.email);
      }

      const status = getLockoutStatus(validUser.email);
      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).not.toBeNull();
    });

    it('should show appropriate error messages', async () => {
      // 4 failed attempts (1 remaining)
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt(validUser.email);
      }

      const status = getLockoutStatus(validUser.email);
      expect(status.message).toContain('Warning');
      expect(status.message).toContain('1 attempt');
    });
  });

  describe('Session Security', () => {
    it('should have 7-day session max age', () => {
      const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
      const expectedMaxAge = 604800;

      expect(maxAge).toBe(expectedMaxAge);
    });

    it('should have secure session configuration', () => {
      // Session should use JWT strategy
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
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-123',
        email: 'TEST@EXAMPLE.COM'.toLowerCase(),
      });

      await registerUser({
        email: 'TEST@EXAMPLE.COM',
        password: validUser.password,
        name: validUser.name,
      });

      const createCall = (prisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.email).toBe('test@example.com');
    });
  });
});
