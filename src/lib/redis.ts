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

/** Chainable mock for Redis pipeline/multi commands — returns itself for chaining. */
const mockChain = {
  set: () => mockChain,
  get: () => mockChain,
  del: () => mockChain,
  zremrangebyscore: () => mockChain,
  zcard: () => mockChain,
  zadd: () => mockChain,
  pexpire: () => mockChain,
  sadd: () => mockChain,
  expire: () => mockChain,
  exec: async () => [] as unknown[],
};

/**
 * Interface describing the subset of Redis methods that the development mock
 * actually implements.  Keeping this explicit avoids `as unknown as Redis`
 * and makes it obvious which operations are available in dev mode.
 *
 * Consumers that need methods beyond this subset should ensure Redis is
 * configured (i.e. check `isRedisConfigured()` before calling them).
 */
interface MockRedis {
  get(key: string): Promise<string | null>;
  set(key: string, ...args: unknown[]): Promise<string>;
  del(...args: unknown[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: string | number, opts?: Record<string, unknown>): Promise<[string, string[]]>;
  pipeline(): typeof mockChain;
  zremrangebyscore(...args: unknown[]): Promise<number>;
  zcard(key: string): Promise<number>;
  zadd(key: string, ...args: unknown[]): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  ttl(key: string): Promise<number>;
  multi(): typeof mockChain;
  ping(): Promise<string>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
}

/**
 * Get Redis client — returns Upstash if configured and healthy, otherwise a dev mock.
 * The mock supports the same method signatures but returns safe no-op values.
 */
export function getRedis(): Redis | MockRedis {
  if (isRedisConfigured()) {
    try {
      return getUpstashRedis();
    } catch {
      logger.warn('Failed to initialize Upstash Redis, using mock');
    }
  }

  // Development mock — safe no-op that satisfies MockRedis
  return {
    get: async () => null,
    set: async () => 'OK' as const,
    del: async () => 0,
    keys: async () => [],
    scan: async () => ['0', []] as [string, string[]],
    pipeline: () => mockChain,
    zremrangebyscore: async () => 0,
    zcard: async () => 0,
    zadd: async () => 0,
    pexpire: async () => 1,
    ttl: async () => -2,
    multi: () => mockChain,
    ping: async () => 'PONG',
    incr: async () => 1,
    expire: async () => 1,
    sadd: async () => 1,
    smembers: async () => [],
  } satisfies MockRedis;
}

// Shared singleton for modules that import `redis` directly
export const redis: Redis | MockRedis = getRedis();

logger.debug('Redis module loaded', {
  configured: isRedisConfigured(),
  backend: isRedisConfigured() ? 'upstash' : 'mock',
});
