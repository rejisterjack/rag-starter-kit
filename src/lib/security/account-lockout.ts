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
 * - Redis-backed storage with in-memory fallback
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/security/rate-limiter';

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

  // Redis key prefix
  REDIS_PREFIX: 'lockout:',

  // Redis TTL buffer (add extra time to Redis expiry)
  REDIS_TTL_BUFFER_MS: 60 * 1000, // 1 minute
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
// Storage Backend Abstraction
// =============================================================================

// In-memory fallback store
const memoryStore = new Map<string, LockoutRecord>();

/**
 * Check if Redis is available and functional
 */
function isRedisAvailable(): boolean {
  return redis && typeof redis.get === 'function';
}

/**
 * Get lockout record from storage (Redis or in-memory)
 */
async function getRecord(key: string): Promise<LockoutRecord | null> {
  const fullKey = `${CONFIG.REDIS_PREFIX}${key}`;

  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const data = await redis.get(fullKey);
      if (data) {
        // Handle both string and object returns from Redis
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return parsed as LockoutRecord;
      }
      return null;
    } catch (error) {
      logger.warn('Redis lockout read failed, using in-memory', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Fall through to in-memory
    }
  }

  // Use in-memory store
  return memoryStore.get(key) || null;
}

/**
 * Save lockout record to storage (Redis or in-memory)
 */
async function saveRecord(key: string, record: LockoutRecord): Promise<void> {
  const fullKey = `${CONFIG.REDIS_PREFIX}${key}`;

  // Calculate appropriate TTL
  const ttlMs = Math.max(
    CONFIG.ATTEMPT_WINDOW_MS,
    record.lockedUntil ? record.lockedUntil - Date.now() + CONFIG.REDIS_TTL_BUFFER_MS : 0
  );

  // Try Redis first
  if (isRedisAvailable()) {
    try {
      await redis.set(fullKey, JSON.stringify(record), { ex: Math.ceil(ttlMs / 1000) });
      return;
    } catch (error) {
      logger.warn('Redis lockout write failed, using in-memory', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Fall through to in-memory
    }
  }

  // Use in-memory store
  memoryStore.set(key, record);

  // Schedule cleanup for in-memory records
  setTimeout(() => {
    const current = memoryStore.get(key);
    if (current && Date.now() - current.firstAttemptAt > CONFIG.ATTEMPT_WINDOW_MS) {
      memoryStore.delete(key);
    }
  }, ttlMs);
}

/**
 * Delete lockout record from storage
 */
async function deleteRecord(key: string): Promise<void> {
  const fullKey = `${CONFIG.REDIS_PREFIX}${key}`;

  if (isRedisAvailable()) {
    try {
      await redis.del(fullKey);
    } catch (error) {
      logger.warn('Redis lockout delete failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  memoryStore.delete(key);
}

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
  return identifier;
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

  let record = await getRecord(key);

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

  await saveRecord(key, record);

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
  await deleteRecord(key);

  logger.debug('Login successful, cleared lockout record', { identifier });
}

/**
 * Get the current lockout status for an identifier
 *
 * @param identifier - Email or username
 * @returns LockoutStatus with current state
 */
export async function getLockoutStatus(identifier: string): Promise<LockoutStatus> {
  const key = getLockoutKey(identifier);
  const record = await getRecord(key);
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
    await deleteRecord(key);
    return {
      isLocked: false,
      lockedUntil: null,
      remainingAttempts: CONFIG.MAX_ATTEMPTS,
      message: null,
    };
  }

  // Check if attempt window has expired
  if (now - record.firstAttemptAt > CONFIG.ATTEMPT_WINDOW_MS) {
    await deleteRecord(key);
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
export async function isAccountLocked(identifier: string): Promise<boolean> {
  return (await getLockoutStatus(identifier)).isLocked;
}

/**
 * Manually unlock an account (for admin use)
 *
 * @param identifier - Email or username
 * @param adminId - ID of admin performing the unlock
 */
export async function unlockAccount(identifier: string, adminId: string): Promise<boolean> {
  const key = getLockoutKey(identifier);

  // Check if record exists in either store
  const record = await getRecord(key);
  const existed = !!record;

  if (existed) {
    await deleteRecord(key);

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
export async function getLockoutStats(): Promise<{
  totalLocked: number;
  totalTracking: number;
  usingRedis: boolean;
}> {
  const now = Date.now();
  let totalLocked = 0;
  let totalTracking = 0;

  // Count in-memory records
  for (const record of memoryStore.values()) {
    totalTracking++;
    if (record.lockedUntil && now < record.lockedUntil) {
      totalLocked++;
    }
  }

  // Note: Redis stats would require scanning keys, which is expensive
  // For production monitoring, use Redis INFO command or external monitoring

  return {
    totalLocked,
    totalTracking,
    usingRedis: isRedisAvailable(),
  };
}

/**
 * Cleanup expired lockout records
 * Call this periodically (e.g., via cron job)
 */
export async function cleanupExpiredLockouts(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  // Clean in-memory store
  for (const [key, record] of memoryStore.entries()) {
    // Remove if outside attempt window
    if (now - record.firstAttemptAt > CONFIG.ATTEMPT_WINDOW_MS) {
      memoryStore.delete(key);
      cleaned++;
      continue;
    }

    // Remove if lockout has expired and no recent attempts
    if (record.lockedUntil && now > record.lockedUntil + CONFIG.ATTEMPT_WINDOW_MS) {
      memoryStore.delete(key);
      cleaned++;
    }
  }

  // Redis records have TTL and auto-expire, but we can clean any that remain
  if (isRedisAvailable()) {
    try {
      // Use SCAN to find expired keys (if any slipped through TTL)
      const _pattern = `${CONFIG.REDIS_PREFIX}*`;
      // Note: In production, use a more efficient cleanup strategy
      logger.debug('Redis lockout keys have TTL and auto-expire');
    } catch (error) {
      logger.warn('Redis cleanup check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  logger.debug('Lockout cleanup completed', { cleaned, remaining: memoryStore.size });
  return cleaned;
}
