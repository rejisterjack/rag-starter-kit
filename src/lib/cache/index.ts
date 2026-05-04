/**
 * Cache Layer
 *
 * Cache-aside pattern on top of the existing Upstash Redis client.
 * Falls back gracefully when Redis is unavailable.
 */

import { logger } from '@/lib/logger';
import { isRedisConfigured, redis } from '@/lib/redis';

/**
 * Get a cached value, deserialized from JSON.
 */
export async function get<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) return null;
  try {
    const raw = await redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw as string) as T;
  } catch (error) {
    logger.debug('Cache get failed', { key, error: error instanceof Error ? error.message : '' });
    return null;
  }
}

/**
 * Set a cached value with TTL in milliseconds.
 */
export async function set<T>(key: string, value: T, ttlMs: number): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redis.set(key, JSON.stringify(value), { px: ttlMs });
  } catch (error) {
    logger.debug('Cache set failed', { key, error: error instanceof Error ? error.message : '' });
  }
}

/**
 * Invalidate cache entries matching a key pattern.
 * Uses SCAN-based iteration to avoid blocking Redis on large key spaces.
 */
export async function invalidate(pattern: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    // Use SCAN for non-blocking pattern matching (avoids O(N) KEYS command)
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const scanResult = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });
      // Upstash returns [string cursor, string[] keys]
      cursor = String((scanResult as unknown as [string, string[]])[0]);
      const keys = (scanResult as unknown as [string, string[]])[1];
      if (keys && keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      logger.debug('Cache invalidation completed', { pattern, keysDeleted: totalDeleted });
    }
  } catch (error) {
    // Fallback: try KEYS if SCAN is not supported (older Upstash SDK versions)
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      logger.debug('Cache invalidation failed', {
        pattern,
        error: error instanceof Error ? error.message : '',
      });
    }
  }
}

/**
 * Delete a single cache key.
 */
export async function del(key: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redis.del(key);
  } catch (error) {
    logger.debug('Cache del failed', { key, error: error instanceof Error ? error.message : '' });
  }
}

/**
 * Cache-aside: return cached value or compute, cache, and return.
 * Never throws — on cache failure, falls back to the computation function.
 */
export async function getOrSet<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) return cached;

  const value = await fn();
  await set(key, value, ttlMs);
  return value;
}
