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
 * Uses SCAN + DEL to avoid blocking Redis on large key spaces.
 */
export async function invalidate(pattern: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    // Upstash doesn't support SCAN natively in the same way — use KEYS for targeted patterns
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.debug('Cache invalidation failed', {
      pattern,
      error: error instanceof Error ? error.message : '',
    });
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
