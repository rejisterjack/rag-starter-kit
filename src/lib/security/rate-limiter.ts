/**
 * Rate Limiter
 *
 * Supports:
 * - Upstash Redis (for serverless/production)
 * - In-memory (for local dev without Redis)
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// =============================================================================
// Rate Limit Configuration
// =============================================================================

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export const rateLimits = {
  chat: { limit: 50, windowMs: 60 * 60 * 1000, prefix: 'chat' },
  chatStream: { limit: 50, windowMs: 60 * 60 * 1000, prefix: 'chat_stream' },
  ingest: { limit: 10, windowMs: 60 * 60 * 1000, prefix: 'ingest' },
  ingestUrl: { limit: 20, windowMs: 60 * 60 * 1000, prefix: 'ingest_url' },
  ocr: { limit: 30, windowMs: 60 * 60 * 1000, prefix: 'ocr' },
  api: { limit: 100, windowMs: 60 * 1000, prefix: 'api' },
  apiKey: { limit: 1000, windowMs: 60 * 1000, prefix: 'api_key' },
  login: { limit: 5, windowMs: 5 * 60 * 1000, prefix: 'login' },
  register: { limit: 3, windowMs: 60 * 60 * 1000, prefix: 'register' },
  passwordReset: { limit: 3, windowMs: 60 * 60 * 1000, prefix: 'password_reset' },
  workspace: { limit: 50, windowMs: 60 * 1000, prefix: 'workspace' },
  documents: { limit: 30, windowMs: 60 * 1000, prefix: 'documents' },
  admin: { limit: 100, windowMs: 60 * 1000, prefix: 'admin' },
  voice: { limit: 30, windowMs: 60 * 60 * 1000, prefix: 'voice' },
  agent: { limit: 50, windowMs: 60 * 60 * 1000, prefix: 'agent' },
  export: { limit: 10, windowMs: 60 * 60 * 1000, prefix: 'export' },
  search: { limit: 100, windowMs: 60 * 1000, prefix: 'search' },
  feedback: { limit: 30, windowMs: 60 * 1000, prefix: 'feedback' },
  share: { limit: 20, windowMs: 60 * 1000, prefix: 'share' },
  share_view: { limit: 60, windowMs: 60 * 1000, prefix: 'share_view' },
  demo: { limit: 20, windowMs: 15 * 60 * 1000, prefix: 'demo' }, // 20 req per 15 min for public demo
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
  private lastCleanup = Date.now();
  private static readonly CLEANUP_INTERVAL_MS = 60_000; // 1 minute
  private static readonly MAX_ENTRIES = 10_000; // Safety cap to prevent unbounded growth

  /**
   * Periodic cleanup of expired entries to prevent memory leaks.
   * Runs at most once per CLEANUP_INTERVAL_MS.
   */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < InMemoryRateLimiter.CLEANUP_INTERVAL_MS) {
      return;
    }

    this.lastCleanup = now;
    let removed = 0;

    for (const [key, record] of this.storage) {
      if (record.resetTime < now) {
        this.storage.delete(key);
        removed++;
      }
    }

    // Safety: if still too many entries, evict oldest
    if (this.storage.size > InMemoryRateLimiter.MAX_ENTRIES) {
      const excess = this.storage.size - InMemoryRateLimiter.MAX_ENTRIES;
      const iterator = this.storage.keys();
      for (let i = 0; i < excess; i++) {
        const key = iterator.next().value;
        if (key) this.storage.delete(key);
      }
    }

    if (removed > 0) {
      logger.debug('Rate limiter cleanup completed', { removed, remaining: this.storage.size });
    }
  }

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    this.maybeCleanup();

    const key = `${config.prefix}:${identifier}`;
    const now = Date.now();

    const record = this.storage.get(key);

    if (!record || record.resetTime < now) {
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
// Upstash Rate Limiter (for serverless)
// =============================================================================

class UpstashRateLimiter implements RateLimiterBackend {
  private ratelimit: unknown = null;
  private limits = new Map<string, unknown>();
  private redis: unknown = null;

  constructor() {
    try {
      const { Ratelimit } = require('@upstash/ratelimit');
      const { Redis } = require('@upstash/redis');

      const redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL || '',
        token: env.UPSTASH_REDIS_REST_TOKEN || '',
      });

      this.ratelimit = Ratelimit;
      this.redis = redis;
    } catch (error: unknown) {
      logger.warn('Upstash not configured, falling back to in-memory', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.ratelimit || !this.redis) {
      return inMemoryLimiter.checkLimit(identifier, config);
    }

    try {
      const key = `${config.prefix}:${config.limit}:${config.windowMs}`;

      if (!this.limits.has(key)) {
        const Ratelimit = this.ratelimit as new (config: unknown) => unknown;
        const ratelimitModule = this.ratelimit as {
          slidingWindow: (limit: number, window: string) => unknown;
        };
        const limiter = new Ratelimit({
          redis: this.redis,
          limiter: ratelimitModule.slidingWindow(
            config.limit,
            this.msToWindowString(config.windowMs)
          ),
          analytics: true,
          prefix: `ratelimit:${config.prefix}`,
        });
        this.limits.set(key, limiter);
      }

      const limiter = this.limits.get(key);
      if (!limiter) {
        return inMemoryLimiter.checkLimit(identifier, config);
      }
      const result = await (
        limiter as {
          limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
        }
      ).limit(identifier);

      return {
        success: result.success,
        limit: config.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (err) {
      logger.warn('Upstash rate limit check failed, falling back to in-memory', {
        error: err instanceof Error ? err.message : String(err),
      });
      return inMemoryLimiter.checkLimit(identifier, config);
    }
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

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    logger.info('Using Upstash Redis for rate limiting');
    rateLimiterBackend = new UpstashRateLimiter();
  } else {
    logger.info('Using in-memory rate limiting (configure Upstash for production)');
    rateLimiterBackend = inMemoryLimiter;
  }

  return rateLimiterBackend;
}

// =============================================================================
// Public API
// =============================================================================

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  limitOverride?: number
): Promise<RateLimitResult> {
  const config = { ...rateLimits[type] };
  if (limitOverride !== undefined) {
    (config as any).limit = limitOverride;
  }
  const limiter = getRateLimiter();
  return limiter.checkLimit(identifier, config);
}

export async function checkApiRateLimit(
  identifier: string,
  type: RateLimitType,
  metadata?: { userId?: string; workspaceId?: string; endpoint?: string; limitOverride?: number }
): Promise<RateLimitResult> {
  const result = await checkRateLimit(identifier, type, metadata?.limitOverride);

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
  if (context?.userId) {
    return `user:${context.userId}`;
  }

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
// Redis Client Export (shared Upstash instance)
// =============================================================================

import { getRedis } from '@/lib/redis';

export const redis = getRedis();
