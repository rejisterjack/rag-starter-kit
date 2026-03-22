/**
 * Account Lockout Unit Tests
 *
 * Tests for the account lockout protection system with Redis support
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupExpiredLockouts,
  getLockoutStats,
  getLockoutStatus,
  isAccountLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
  unlockAccount,
} from '@/lib/security/account-lockout';

// Mock audit logger
vi.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: vi.fn(),
  AuditEvent: {
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis
vi.mock('@/lib/security/rate-limiter', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Account Lockout', () => {
  const TEST_EMAIL = 'test@example.com';

  beforeEach(async () => {
    // Clean up any existing lockouts
    await unlockAccount(TEST_EMAIL, 'admin');
  });

  describe('recordFailedAttempt', () => {
    it('should track failed attempts', async () => {
      await recordFailedAttempt(TEST_EMAIL);
      const status = await getLockoutStatus(TEST_EMAIL);

      expect(status.remainingAttempts).toBe(4);
      expect(status.isLocked).toBe(false);
    });

    it('should lock account after 5 failed attempts', async () => {
      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      const status = await getLockoutStatus(TEST_EMAIL);
      expect(status.isLocked).toBe(true);
      expect(status.remainingAttempts).toBe(0);
      expect(status.message).toContain('locked');
    });

    it('should show warning message when only 2 attempts remain', async () => {
      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      const status = await getLockoutStatus(TEST_EMAIL);
      expect(status.remainingAttempts).toBe(2);
      expect(status.message).toContain('Warning');
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('should reset failed attempts on successful login', async () => {
      // Create some failed attempts
      await recordFailedAttempt(TEST_EMAIL);
      await recordFailedAttempt(TEST_EMAIL);

      // Successful login
      await recordSuccessfulLogin(TEST_EMAIL);

      const status = await getLockoutStatus(TEST_EMAIL);
      expect(status.remainingAttempts).toBe(5);
      expect(status.isLocked).toBe(false);
    });
  });

  describe('isAccountLocked', () => {
    it('should return false for non-existent record', async () => {
      expect(await isAccountLocked('nonexistent@example.com')).toBe(false);
    });

    it('should return true for locked account', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      expect(await isAccountLocked(TEST_EMAIL)).toBe(true);
    });
  });

  describe('unlockAccount', () => {
    it('should unlock a locked account', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      expect(await isAccountLocked(TEST_EMAIL)).toBe(true);

      // Unlock
      const unlocked = await unlockAccount(TEST_EMAIL, 'admin');
      expect(unlocked).toBe(true);
      expect(await isAccountLocked(TEST_EMAIL)).toBe(false);
    });

    it('should return false if account was not locked', async () => {
      const unlocked = await unlockAccount('never-locked@example.com', 'admin');
      expect(unlocked).toBe(false);
    });
  });

  describe('getLockoutStats', () => {
    it('should return correct statistics', async () => {
      // Create some lockouts
      await recordFailedAttempt('user1@example.com');

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt('user2@example.com');
      }

      const stats = await getLockoutStats();
      expect(stats.totalTracking).toBe(2);
      expect(stats.totalLocked).toBe(1);
      expect(stats.usingRedis).toBe(false); // Mock returns false
    });
  });

  describe('cleanupExpiredLockouts', () => {
    it('should clean up old records', async () => {
      // Create a record
      await recordFailedAttempt(TEST_EMAIL);

      // Stats should show the record
      const statsBefore = await getLockoutStats();
      expect(statsBefore.totalTracking).toBeGreaterThan(0);

      // Cleanup (won't remove non-expired in this test)
      const cleaned = await cleanupExpiredLockouts();
      expect(typeof cleaned).toBe('number');
    });
  });
});
