/**
 * Session Store - Redis-backed session revocation
 *
 * Enables immediate invalidation of JWT sessions before their
 * natural expiration. Uses the existing Upstash Redis client.
 */

import { redis } from '@/lib/redis';

const KEY_PREFIX = 'session';

function revokedKey(jti: string): string {
  return `${KEY_PREFIX}:revoked:${jti}`;
}

function activeKey(userId: string): string {
  return `${KEY_PREFIX}:active:${userId}`;
}

/**
 * Check if a session's JTI has been revoked
 */
export async function isSessionRevoked(jti: string): Promise<boolean> {
  try {
    const result = await redis.get(revokedKey(jti));
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Track an active session JTI for a user
 */
export async function trackSession(userId: string, jti: string): Promise<void> {
  try {
    const key = activeKey(userId);
    await redis.sadd(key, jti);
    await redis.expire(key, 7 * 24 * 60 * 60);
  } catch {
    // Non-critical — revocation list is the safety net
  }
}

/**
 * Revoke a single session by JTI.
 * @param remainingSeconds TTL for the revocation entry (should match token remaining life)
 */
export async function revokeSession(jti: string, remainingSeconds?: number): Promise<void> {
  const ttl = remainingSeconds ?? 7 * 24 * 60 * 60;
  await redis.set(revokedKey(jti), '1', { ex: ttl });
}

/**
 * Revoke all active sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  try {
    const key = activeKey(userId);
    const jtis = await redis.smembers(key);

    if (jtis.length === 0) return 0;

    const pipeline = redis.pipeline();
    for (const jti of jtis) {
      if (typeof jti === 'string') {
        pipeline.set(revokedKey(jti), '1', { ex: 7 * 24 * 60 * 60 });
      }
    }
    pipeline.del(key);
    await pipeline.exec();

    return jtis.length;
  } catch {
    return 0;
  }
}
