/**
 * Centralized Upstash Redis Client
 *
 * Provides a shared Redis instance using Upstash REST API.
 * Falls back to a mock for local development without Redis.
 */

import { Redis } from '@upstash/redis';

import { logger } from '@/lib/logger';

let _redis: Redis | null = null;

export function getUpstashRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}

export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Get Redis client — returns Upstash if configured and healthy, otherwise a dev mock.
 * The mock supports the same method signatures but returns safe no-op values.
 */
export function getRedis(): Redis {
  if (isRedisConfigured()) {
    try {
      return getUpstashRedis();
    } catch {
      logger.warn('Failed to initialize Upstash Redis, using mock');
    }
  }

  // Development mock — safe no-op that matches the Redis interface
  return {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    keys: async () => [],
    pipeline: () => ({
      zremrangebyscore: () => ({
        zcard: () => ({ zadd: () => ({ pexpire: () => ({ exec: async () => [] }) }) }),
      }),
      zcard: () => ({ zadd: () => ({ pexpire: () => ({ exec: async () => [] }) }) }),
      zadd: () => ({ pexpire: () => ({ exec: async () => [] }) }),
      exec: async () => [],
    }),
    zremrangebyscore: async () => 0,
    zcard: async () => 0,
    zadd: async () => 0,
    pexpire: async () => 1,
    ttl: async () => -2,
    multi: () => ({
      del: () => ({ exec: async () => [] }),
      exec: async () => [],
    }),
  } as unknown as Redis;
}

// Shared singleton for modules that import `redis` directly
export const redis = getRedis();

logger.debug('Redis module loaded', {
  configured: isRedisConfigured(),
  backend: isRedisConfigured() ? 'upstash' : 'mock',
});
