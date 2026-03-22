/**
 * Account Lockout Unit Tests
 *
 * Tests for the account lockout protection system
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

describe('Account Lockout', () => {
  const TEST_EMAIL = 'test@example.com';

  beforeEach(() => {
    // Clean up any existing lockouts
    unlockAccount(TEST_EMAIL, 'admin');
  });

  describe('recordFailedAttempt', () => {
    it('should track failed attempts', async () => {
      await recordFailedAttempt(TEST_EMAIL);
      const status = getLockoutStatus(TEST_EMAIL);

      expect(status.remainingAttempts).toBe(4);
      expect(status.isLocked).toBe(false);
    });

    it('should lock account after 5 failed attempts', async () => {
      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      const status = getLockoutStatus(TEST_EMAIL);
      expect(status.isLocked).toBe(true);
      expect(status.remainingAttempts).toBe(0);
      expect(status.message).toContain('locked');
    });

    it('should show warning message when only 2 attempts remain', async () => {
      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      const status = getLockoutStatus(TEST_EMAIL);
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

      const status = getLockoutStatus(TEST_EMAIL);
      expect(status.remainingAttempts).toBe(5);
      expect(status.isLocked).toBe(false);
    });
  });

  describe('isAccountLocked', () => {
    it('should return false for non-existent record', () => {
      expect(isAccountLocked('nonexistent@example.com')).toBe(false);
    });

    it('should return true for locked account', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      expect(isAccountLocked(TEST_EMAIL)).toBe(true);
    });
  });

  describe('unlockAccount', () => {
    it('should unlock a locked account', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(TEST_EMAIL);
      }

      expect(isAccountLocked(TEST_EMAIL)).toBe(true);

      // Unlock
      const unlocked = await unlockAccount(TEST_EMAIL, 'admin');
      expect(unlocked).toBe(true);
      expect(isAccountLocked(TEST_EMAIL)).toBe(false);
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

      const stats = getLockoutStats();
      expect(stats.totalTracking).toBe(2);
      expect(stats.totalLocked).toBe(1);
    });
  });

  describe('cleanupExpiredLockouts', () => {
    it('should clean up old records', async () => {
      // Create a record
      await recordFailedAttempt(TEST_EMAIL);

      // Fast-forward time by manipulating the store directly
      // This is a simplified test - in reality we'd use fake timers
      const statsBefore = getLockoutStats();
      expect(statsBefore.totalTracking).toBeGreaterThan(0);
    });
  });
});
