import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// =============================================================================
// Rate Limit Configuration
// =============================================================================

export interface RateLimitConfig {
  limit: number;
  window: string; // e.g., '1 h', '1 m', '1 s'
  prefix?: string;
}

export const rateLimits = {
  // Chat endpoints
  chat: { limit: 50, window: '1 h', prefix: 'chat' },
  chatStream: { limit: 50, window: '1 h', prefix: 'chat_stream' },

  // Ingestion endpoints
  ingest: { limit: 10, window: '1 h', prefix: 'ingest' },
  ingestUrl: { limit: 20, window: '1 h', prefix: 'ingest_url' },

  // API endpoints
  api: { limit: 100, window: '1 m', prefix: 'api' },
  apiKey: { limit: 1000, window: '1 m', prefix: 'api_key' },

  // Authentication endpoints
  login: { limit: 5, window: '5 m', prefix: 'login' },
  register: { limit: 3, window: '1 h', prefix: 'register' },
  passwordReset: { limit: 3, window: '1 h', prefix: 'password_reset' },

  // Workspace endpoints
  workspace: { limit: 50, window: '1 m', prefix: 'workspace' },

  // Document endpoints
  documents: { limit: 30, window: '1 m', prefix: 'documents' },

  // Admin endpoints
  admin: { limit: 100, window: '1 m', prefix: 'admin' },

  // Voice endpoints
  voice: { limit: 30, window: '1 h', prefix: 'voice' },

  // Agent endpoints
  agent: { limit: 50, window: '1 h', prefix: 'agent' },

  // Export endpoints
  export: { limit: 10, window: '1 h', prefix: 'export' },
} as const;

export type RateLimitType = keyof typeof rateLimits;

// =============================================================================
// Rate Limiter Class
// =============================================================================

export class RateLimiter {
  private redis: Redis;
  private limits: Map<string, Ratelimit>;

  constructor() {
    // Initialize Redis client
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });

    this.limits = new Map();
  }

  /**
   * Get or create a rate limiter for a specific configuration
   */
  private getLimiter(config: RateLimitConfig): Ratelimit {
    const key = `${config.prefix}:${config.limit}:${config.window}`;

    if (!this.limits.has(key)) {
      const limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(
          config.limit,
          config.window as `${number} ${'s' | 'm' | 'h' | 'd'}`
        ),
        analytics: true,
        prefix: `ratelimit:${config.prefix}`,
      });

      this.limits.set(key, limiter);
    }

    return this.limits.get(key)!;
  }

  /**
   * Check rate limit for an identifier
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig | RateLimitType
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    const rateConfig = typeof config === 'string' ? rateLimits[config] : config;
    const limiter = this.getLimiter(rateConfig);

    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: rateConfig.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  /**
   * Check rate limit with fallback to database if Redis is unavailable
   */
  async checkLimitWithFallback(
    identifier: string,
    config: RateLimitConfig | RateLimitType,
    options?: {
      userId?: string;
      workspaceId?: string;
      endpoint?: string;
    }
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    try {
      return await this.checkLimit(identifier, config);
    } catch (error) {
      logger.error('Redis rate limit error, falling back to database', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.checkLimitDatabase(identifier, config, options);
    }
  }

  /**
   * Database fallback for rate limiting
   */
  private async checkLimitDatabase(
    identifier: string,
    config: RateLimitConfig | RateLimitType,
    options?: {
      userId?: string;
      workspaceId?: string;
      endpoint?: string;
    }
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    const rateConfig = typeof config === 'string' ? rateLimits[config] : config;
    const windowMs = this.parseWindowToMs(rateConfig.window);
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    // Get or create rate limit record
    let rateLimit = await prisma.rateLimit.findFirst({
      where: {
        key: identifier,
        type: options?.endpoint || 'default',
      },
    });

    // Reset if window has passed
    if (rateLimit && rateLimit.windowStart < now) {
      rateLimit = await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: {
          requests: 0,
          windowStart: now,
        },
      });
    }

    // Create new record if doesn't exist
    if (!rateLimit) {
      rateLimit = await prisma.rateLimit.create({
        data: {
          key: identifier,
          type: options?.userId ? 'USER' : options?.workspaceId ? 'WORKSPACE' : 'IP',
          requests: 0,
          windowStart: now,
          userId: options?.userId,
        },
      });
    }

    // Increment count
    const updated = await prisma.rateLimit.update({
      where: { id: rateLimit.id },
      data: { requests: { increment: 1 } },
    });

    const success = updated.requests <= rateConfig.limit;
    const remaining = Math.max(0, rateConfig.limit - updated.requests);

    // Log rate limit hit
    if (!success) {
      await logAuditEvent({
        event: AuditEvent.RATE_LIMIT_HIT,
        userId: options?.userId,
        workspaceId: options?.workspaceId,
        metadata: {
          identifier,
          endpoint: options?.endpoint,
          limit: rateConfig.limit,
          window: rateConfig.window,
        },
        severity: 'WARNING',
      });
    }

    return {
      success,
      limit: rateConfig.limit,
      remaining,
      reset: resetAt.getTime(),
    };
  }

  /**
   * Parse window string to milliseconds
   */
  private parseWindowToMs(window: string): number {
    const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || multipliers.h);
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetLimit(identifier: string, config: RateLimitConfig | RateLimitType): Promise<void> {
    const rateConfig = typeof config === 'string' ? rateLimits[config] : config;

    try {
      await this.redis.del(`ratelimit:${rateConfig.prefix}:${identifier}`);
    } catch (error) {
      logger.error('Failed to reset rate limit in Redis', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Also reset in database
    await prisma.rateLimit.deleteMany({
      where: { key: identifier },
    });
  }

  /**
   * Get rate limit status
   */
  async getLimitStatus(
    identifier: string,
    config: RateLimitConfig | RateLimitType
  ): Promise<{
    limit: number;
    remaining: number;
    reset: number;
  } | null> {
    try {
      const rateConfig = typeof config === 'string' ? rateLimits[config] : config;
      const limiter = this.getLimiter(rateConfig);
      const result = await limiter.getRemaining(identifier);

      return {
        limit: rateConfig.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      logger.error('Failed to get rate limit status', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

// =============================================================================
// Helper Functions
// =============================================================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for an API request
 */
export async function checkApiRateLimit(
  identifier: string,
  type: RateLimitType,
  options?: {
    userId?: string;
    workspaceId?: string;
    endpoint?: string;
  }
): Promise<RateLimitResult> {
  const limiter = getRateLimiter();
  return limiter.checkLimitWithFallback(identifier, type, options);
}

/**
 * Get identifier for rate limiting
 */
export function getRateLimitIdentifier(
  req: Request,
  options?: {
    userId?: string;
    apiKeyId?: string;
    workspaceId?: string;
  }
): string {
  // Use API key ID if available
  if (options?.apiKeyId) {
    return `api:${options.apiKeyId}`;
  }

  // Use user ID if available
  if (options?.userId) {
    return `user:${options.userId}`;
  }

  // Use workspace ID if available
  if (options?.workspaceId) {
    return `workspace:${options.workspaceId}`;
  }

  // Fall back to IP address
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

/**
 * Apply rate limit to response headers
 */
export function addRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', Math.ceil(result.reset / 1000).toString());
}
