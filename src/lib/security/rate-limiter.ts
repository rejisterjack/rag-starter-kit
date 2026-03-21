/**
 * Rate Limiter
 *
 * Supports multiple Redis backends:
 * - Upstash Redis (for serverless/production)
 * - ioredis (for Docker/self-hosted)
 * - Disabled (for local dev without Redis)
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';

// =============================================================================
// Rate Limit Configuration
// =============================================================================

export interface RateLimitConfig {
  limit: number;
  windowMs: number; // milliseconds
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export const rateLimits = {
  // Chat endpoints
  chat: { limit: 50, windowMs: 60 * 60 * 1000, prefix: 'chat' }, // 50/hour
  chatStream: { limit: 50, windowMs: 60 * 60 * 1000, prefix: 'chat_stream' },

  // Ingestion endpoints
  ingest: { limit: 10, windowMs: 60 * 60 * 1000, prefix: 'ingest' }, // 10/hour
  ingestUrl: { limit: 20, windowMs: 60 * 60 * 1000, prefix: 'ingest_url' },
  ocr: { limit: 30, windowMs: 60 * 60 * 1000, prefix: 'ocr' }, // 30/hour

  // API endpoints
  api: { limit: 100, windowMs: 60 * 1000, prefix: 'api' }, // 100/min
  apiKey: { limit: 1000, windowMs: 60 * 1000, prefix: 'api_key' },

  // Authentication endpoints
  login: { limit: 5, windowMs: 5 * 60 * 1000, prefix: 'login' }, // 5/5min
  register: { limit: 3, windowMs: 60 * 60 * 1000, prefix: 'register' }, // 3/hour
  passwordReset: { limit: 3, windowMs: 60 * 60 * 1000, prefix: 'password_reset' },

  // Workspace endpoints
  workspace: { limit: 50, windowMs: 60 * 1000, prefix: 'workspace' },

  // Document endpoints
  documents: { limit: 30, windowMs: 60 * 1000, prefix: 'documents' },

  // Admin endpoints
  admin: { limit: 100, windowMs: 60 * 1000, prefix: 'admin' },

  // Voice endpoints
  voice: { limit: 30, windowMs: 60 * 60 * 1000, prefix: 'voice' },

  // Agent endpoints
  agent: { limit: 50, windowMs: 60 * 60 * 1000, prefix: 'agent' },

  // Export endpoints
  export: { limit: 10, windowMs: 60 * 60 * 1000, prefix: 'export' },

  // Search endpoints
  search: { limit: 100, windowMs: 60 * 1000, prefix: 'search' }, // 100/min
} as const;

export type RateLimitType = keyof typeof rateLimits;

// =============================================================================
// Rate Limiter Interface
// =============================================================================

interface RateLimiterBackend {
  checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult>;
}

// =============================================================================
// In-Memory Rate Limiter (for local dev without Redis)
// =============================================================================

class InMemoryRateLimiter implements RateLimiterBackend {
  private storage = new Map<string, { count: number; resetTime: number }>();

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `${config.prefix}:${identifier}`;
    const now = Date.now();

    const record = this.storage.get(key);

    if (!record || record.resetTime < now) {
      // New window
      const resetTime = now + config.windowMs;
      this.storage.set(key, { count: 1, resetTime });
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: resetTime,
      };
    }

    if (record.count >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: record.resetTime,
      };
    }

    record.count++;
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - record.count,
      reset: record.resetTime,
    };
  }
}

// =============================================================================
// Redis Rate Limiter (ioredis)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class RedisRateLimiter implements RateLimiterBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redis: any = null;
  private connected = false;

  constructor(redisUrl: string) {
    // Lazy load ioredis
    const Redis = require('ioredis');
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.connected = true;
      logger.info('Redis rate limiter connected');
    });

    this.redis.on('error', (err: Error) => {
      this.connected = false;
      logger.warn('Redis connection error', { error: err.message });
    });
  }

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.redis || !this.connected) {
      // Fallback to in-memory if Redis is down
      logger.warn('Redis unavailable, using in-memory rate limit');
      return inMemoryLimiter.checkLimit(identifier, config);
    }

    const key = `ratelimit:${config.prefix}:${identifier}`;
    const windowMs = config.windowMs;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis sorted set for sliding window
      const multi = this.redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current entries
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on the key
      multi.pexpire(key, windowMs);

      const results = await multi.exec();
      const count = (results?.[1]?.[1] as number) || 0;

      const remaining = Math.max(0, config.limit - count - 1);
      const reset = now + windowMs;

      return {
        success: count < config.limit,
        limit: config.limit,
        remaining,
        reset,
      };
    } catch (error) {
      logger.error('Redis rate limit error', { error: String(error) });
      // Fallback to in-memory on error
      return inMemoryLimiter.checkLimit(identifier, config);
    }
  }
}

// =============================================================================
// Upstash Rate Limiter (for serverless)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class UpstashRateLimiter implements RateLimiterBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ratelimit: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private limits = new Map<string, any>();

  constructor() {
    try {
      const { Ratelimit } = require('@upstash/ratelimit');
      const { Redis } = require('@upstash/redis');

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL || '',
        token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
      });

      this.ratelimit = Ratelimit;
      this.redis = redis;
    } catch {
      logger.warn('Upstash not configured, falling back to Redis/ioredis');
    }
  }

  private redis: any;

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.ratelimit || !this.redis) {
      return inMemoryLimiter.checkLimit(identifier, config);
    }

    const key = `${config.prefix}:${config.limit}:${config.windowMs}`;

    if (!this.limits.has(key)) {
      const limiter = new this.ratelimit({
        redis: this.redis,
        limiter: this.ratelimit.slidingWindow(config.limit, this.msToWindowString(config.windowMs)),
        analytics: true,
        prefix: `ratelimit:${config.prefix}`,
      });
      this.limits.set(key, limiter);
    }

    const limiter = this.limits.get(key)!;
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: config.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  private msToWindowString(ms: number): `${number} ${'s' | 'm' | 'h' | 'd'}` {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} d`;
  }
}

// =============================================================================
// Global Rate Limiter Instance
// =============================================================================

const inMemoryLimiter = new InMemoryRateLimiter();
let rateLimiterBackend: RateLimiterBackend | null = null;

export function getRateLimiter(): RateLimiterBackend {
  if (rateLimiterBackend) {
    return rateLimiterBackend;
  }

  // Priority: Upstash -> Redis (ioredis) -> In-Memory
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    logger.info('Using Upstash Redis for rate limiting');
    rateLimiterBackend = new UpstashRateLimiter();
  } else if (process.env.REDIS_URL) {
    logger.info('Using Redis (ioredis) for rate limiting');
    rateLimiterBackend = new RedisRateLimiter(process.env.REDIS_URL);
  } else {
    logger.info('Using in-memory rate limiting (configure REDIS_URL for production)');
    rateLimiterBackend = inMemoryLimiter;
  }

  return rateLimiterBackend;
}

// =============================================================================
// Public API
// =============================================================================

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  const config = rateLimits[type];
  const limiter = getRateLimiter();
  return limiter.checkLimit(identifier, config);
}

export async function checkApiRateLimit(
  identifier: string,
  type: RateLimitType,
  metadata?: { userId?: string; workspaceId?: string; endpoint?: string }
): Promise<RateLimitResult> {
  const result = await checkRateLimit(identifier, type);

  // Log rate limit violations
  if (!result.success && metadata?.userId) {
    await logAuditEvent({
      event: AuditEvent.RATE_LIMIT_HIT,
      userId: metadata.userId,
      workspaceId: metadata.workspaceId,
      metadata: {
        endpoint: metadata.endpoint,
        rateLimitType: type,
        identifier,
      },
      severity: 'WARNING',
    });
  }

  return result;
}

export function getRateLimitIdentifier(
  req: Request,
  context?: { userId?: string; workspaceId?: string }
): string {
  // Use user ID if authenticated, otherwise use IP
  if (context?.userId) {
    return `user:${context.userId}`;
  }

  // Get IP from request headers
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';

  return `ip:${ip}`;
}

export function addRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
}

// =============================================================================
// Redis Client Export
// =============================================================================

/**
 * Get Redis client for other security modules
 * Returns null if Redis is not configured
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRedisClient(): any | null {
  try {
    if (process.env.REDIS_URL) {
      const { Redis } = require('ioredis');
      return new Redis(process.env.REDIS_URL, {
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
    }
  } catch {
    // Redis not available
  }
  return null;
}

/**
 * Shared Redis instance for security modules
 * Uses Upstash if available, otherwise ioredis
 */
export const redis = (() => {
  // Try Upstash first
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = require('@upstash/redis');
      return new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      // Fall through to ioredis
    }
  }

  // Try ioredis
  if (process.env.REDIS_URL) {
    try {
      const { Redis } = require('ioredis');
      return new Redis(process.env.REDIS_URL, {
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
    } catch {
      // Fall through to mock
    }
  }

  // Mock Redis for development without Redis
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
  } as unknown as any;
})();
