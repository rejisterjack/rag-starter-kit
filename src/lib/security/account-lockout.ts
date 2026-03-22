/**
 * Account Lockout Protection
 *
 * Prevents brute-force attacks by temporarily locking accounts after
 * multiple failed login attempts.
 *
 * Features:
 * - Tracks failed login attempts per account/IP
 * - Implements exponential backoff for lockout duration
 * - Resets counter on successful login
 * - Provides user-friendly unlock time messages
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  // Maximum failed attempts before lockout
  MAX_ATTEMPTS: 5,

  // Base lockout duration in milliseconds (15 minutes)
  BASE_LOCKOUT_DURATION_MS: 15 * 60 * 1000,

  // Maximum lockout duration (24 hours)
  MAX_LOCKOUT_DURATION_MS: 24 * 60 * 60 * 1000,

  // Time window for counting attempts (1 hour)
  ATTEMPT_WINDOW_MS: 60 * 60 * 1000,

  // Whether to use exponential backoff
  EXPONENTIAL_BACKOFF: true,
};

// =============================================================================
// Types
// =============================================================================

interface LockoutRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  remainingAttempts: number;
  message: string | null;
}

// =============================================================================
// In-Memory Store (use Redis in production)
// =============================================================================

// Map<identifier, LockoutRecord>
const lockoutStore = new Map<string, LockoutRecord>();

// =============================================================================
// Lockout Functions
// =============================================================================

/**
 * Calculate lockout duration with exponential backoff
 */
function calculateLockoutDuration(attempts: number): number {
  if (!CONFIG.EXPONENTIAL_BACKOFF) {
    return CONFIG.BASE_LOCKOUT_DURATION_MS;
  }

  // Exponential: 15min, 30min, 1hour, 2hours, 4hours, etc.
  const multiplier = 2 ** Math.max(0, attempts - CONFIG.MAX_ATTEMPTS);
  const duration = CONFIG.BASE_LOCKOUT_DURATION_MS * multiplier;

  return Math.min(duration, CONFIG.MAX_LOCKOUT_DURATION_MS);
}

/**
 * Get the lockout key for an identifier
 */
function getLockoutKey(identifier: string): string {
  return `lockout:${identifier}`;
}

/**
 * Record a failed login attempt
 *
 * @param identifier - Email or username
 * @param ipAddress - Optional IP address for additional tracking
 * @returns LockoutStatus indicating current lockout state
 */
export async function recordFailedAttempt(
  identifier: string,
  ipAddress?: string
): Promise<LockoutStatus> {
  const key = getLockoutKey(identifier);
  const now = Date.now();

  let record = lockoutStore.get(key);

  if (!record) {
    record = {
      attempts: 0,
      firstAttemptAt: now,
      lockedUntil: null,
      lastAttemptAt: now,
    };
  }

  // Reset if outside the attempt window
  if (now - record.firstAttemptAt > CONFIG.ATTEMPT_WINDOW_MS) {
    record = {
      attempts: 0,
      firstAttemptAt: now,
      lockedUntil: null,
      lastAttemptAt: now,
    };
  }

  record.attempts++;
  record.lastAttemptAt = now;

  // Check if we should lock the account
  if (record.attempts >= CONFIG.MAX_ATTEMPTS) {
    const lockoutDuration = calculateLockoutDuration(record.attempts);
    record.lockedUntil = now + lockoutDuration;

    // Log the lockout event
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      metadata: {
        activity: 'account_locked',
        identifier,
        attempts: record.attempts,
        lockedUntil: new Date(record.lockedUntil).toISOString(),
        ipAddress,
      },
      severity: 'WARNING',
    });

    logger.warn('Account locked due to failed login attempts', {
      identifier,
      attempts: record.attempts,
      lockedUntil: new Date(record.lockedUntil),
    });
  }

  lockoutStore.set(key, record);

  return getLockoutStatus(identifier);
}

/**
 * Record a successful login (resets the counter)
 *
 * @param identifier - Email or username
 */
export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  const key = getLockoutKey(identifier);

  // Remove the lockout record on successful login
  lockoutStore.delete(key);

  logger.debug('Login successful, cleared lockout record', { identifier });
}

/**
 * Get the current lockout status for an identifier
 *
 * @param identifier - Email or username
 * @returns LockoutStatus with current state
 */
export function getLockoutStatus(identifier: string): LockoutStatus {
  const key = getLockoutKey(identifier);
  const record = lockoutStore.get(key);
  const now = Date.now();

  if (!record) {
    return {
      isLocked: false,
      lockedUntil: null,
      remainingAttempts: CONFIG.MAX_ATTEMPTS,
      message: null,
    };
  }

  // Check if lockout has expired
  if (record.lockedUntil && now > record.lockedUntil) {
    // Lockout expired, reset the record
    lockoutStore.delete(key);
    return {
      isLocked: false,
      lockedUntil: null,
      remainingAttempts: CONFIG.MAX_ATTEMPTS,
      message: null,
    };
  }

  // Check if attempt window has expired
  if (now - record.firstAttemptAt > CONFIG.ATTEMPT_WINDOW_MS) {
    lockoutStore.delete(key);
    return {
      isLocked: false,
      lockedUntil: null,
      remainingAttempts: CONFIG.MAX_ATTEMPTS,
      message: null,
    };
  }

  const isLocked = record.lockedUntil !== null && now < record.lockedUntil;
  const remainingAttempts = Math.max(0, CONFIG.MAX_ATTEMPTS - record.attempts);

  let message: string | null = null;
  if (isLocked && record.lockedUntil) {
    const minutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
    message = `Account is locked. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`;
  } else if (remainingAttempts <= 2) {
    message = `Warning: ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before account is locked.`;
  }

  return {
    isLocked,
    lockedUntil: record.lockedUntil ? new Date(record.lockedUntil) : null,
    remainingAttempts,
    message,
  };
}

/**
 * Check if an account is currently locked
 *
 * @param identifier - Email or username
 * @returns boolean indicating if account is locked
 */
export function isAccountLocked(identifier: string): boolean {
  return getLockoutStatus(identifier).isLocked;
}

/**
 * Manually unlock an account (for admin use)
 *
 * @param identifier - Email or username
 * @param adminId - ID of admin performing the unlock
 */
export async function unlockAccount(identifier: string, adminId: string): Promise<boolean> {
  const key = getLockoutKey(identifier);
  const existed = lockoutStore.has(key);

  if (existed) {
    lockoutStore.delete(key);

    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      userId: adminId,
      metadata: {
        activity: 'account_unlocked',
        identifier,
        unlockedBy: adminId,
      },
    });

    logger.info('Account manually unlocked by admin', {
      identifier,
      adminId,
    });
  }

  return existed;
}

/**
 * Get lockout statistics (for monitoring)
 */
export function getLockoutStats(): {
  totalLocked: number;
  totalTracking: number;
} {
  const now = Date.now();
  let totalLocked = 0;
  let totalTracking = 0;

  for (const record of lockoutStore.values()) {
    totalTracking++;
    if (record.lockedUntil && now < record.lockedUntil) {
      totalLocked++;
    }
  }

  return { totalLocked, totalTracking };
}

/**
 * Cleanup expired lockout records
 * Call this periodically (e.g., via cron job)
 */
export function cleanupExpiredLockouts(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of lockoutStore.entries()) {
    // Remove if outside attempt window
    if (now - record.firstAttemptAt > CONFIG.ATTEMPT_WINDOW_MS) {
      lockoutStore.delete(key);
      cleaned++;
      continue;
    }

    // Remove if lockout has expired and no recent attempts
    if (record.lockedUntil && now > record.lockedUntil + CONFIG.ATTEMPT_WINDOW_MS) {
      lockoutStore.delete(key);
      cleaned++;
    }
  }

  logger.debug('Lockout cleanup completed', { cleaned, remaining: lockoutStore.size });
  return cleaned;
}
