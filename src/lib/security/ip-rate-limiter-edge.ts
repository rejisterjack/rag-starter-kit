/**
 * Edge-Compatible IP Rate Limiter for Middleware
 *
 * Self-contained rate limiter that avoids importing any Node.js-only modules
 * (no prisma, no audit-logger, no pg). Safe for Next.js Edge Runtime.
 *
 * Uses an inline mock Redis when no Redis client is available (fail-open).
 */

// =============================================================================
// Configuration
// =============================================================================

const IP_RATE_LIMIT_PREFIX = 'ip_ratelimit:';
const IP_REPUTATION_PREFIX = 'ip_reputation:';
const IP_BLOCK_PREFIX = 'ip_ratelimit:block:';

const DEFAULT_CONFIG = {
  maxRequests: 30,
  windowMs: 60 * 1000,
  penaltyMultiplier: 2,
  maxPenaltyMultiplier: 8,
  blockThreshold: 5,
  blockDurationMs: 15 * 60 * 1000,
};

// =============================================================================
// Types
// =============================================================================

export interface IPRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  penaltyLevel: number;
  requiresCaptcha: boolean;
  isBlocked: boolean;
  blockExpiry?: number;
}

interface IPReputation {
  score: number;
  violationCount: number;
  lastViolation: number;
}

interface PipelineChain {
  zremrangebyscore(key: string, min: number | string, max: number | string): PipelineChain;
  zcard(key: string): PipelineChain;
  zadd(key: string, score: number, member: string): PipelineChain;
  pexpire(key: string, ms: number): PipelineChain;
  exec(): Promise<unknown[]>;
}

/** Minimal Redis interface needed for rate limiting */
interface RateLimitRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<number>;
  pipeline(): PipelineChain;
}

// =============================================================================
// Inline Redis (mock — always fails open)
// =============================================================================

const mockRedis: RateLimitRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
  pipeline: () => {
    const chain: PipelineChain = {
      zremrangebyscore: () => chain,
      zcard: () => chain,
      zadd: () => chain,
      pexpire: () => chain,
      exec: async () => [],
    };
    return chain;
  },
};

function getEdgeRedis(): RateLimitRedis {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // Upstash Redis is Edge-compatible (uses REST API)
      const { Redis } = require('@upstash/redis');
      return new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }) as unknown as RateLimitRedis;
    } catch {
      return mockRedis;
    }
  }
  return mockRedis;
}

// =============================================================================
// IP Extraction
// =============================================================================

function extractClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  const trueIP = req.headers.get('true-client-ip');
  if (trueIP) return trueIP;
  return 'unknown';
}

function isPrivateIP(ip: string): boolean {
  return [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ].some((r) => r.test(ip));
}

// =============================================================================
// Rate Limiting
// =============================================================================

export async function checkIPRateLimit(req: Request): Promise<IPRateLimitResult> {
  const cfg = DEFAULT_CONFIG;
  const ip = extractClientIP(req);
  const now = Date.now();

  if (process.env.NODE_ENV === 'development' && isPrivateIP(ip)) {
    return {
      allowed: true,
      remaining: cfg.maxRequests,
      resetTime: now + cfg.windowMs,
      penaltyLevel: 0,
      requiresCaptcha: false,
      isBlocked: false,
    };
  }

  try {
    const redis = getEdgeRedis();

    // Check if IP is blocked
    const blockExpiry = await redis.get(`${IP_BLOCK_PREFIX}${ip}`);
    if (blockExpiry) {
      const expiryTime = parseInt(blockExpiry, 10);
      if (now < expiryTime) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: expiryTime,
          penaltyLevel: 0,
          requiresCaptcha: false,
          isBlocked: true,
          blockExpiry: expiryTime,
        };
      }
      await redis.del(`${IP_BLOCK_PREFIX}${ip}`);
    }

    // Get penalty level from reputation
    const reputationData = await redis.get(`${IP_REPUTATION_PREFIX}${ip}`);
    const reputation: IPReputation = reputationData
      ? JSON.parse(reputationData)
      : { score: 0, violationCount: 0, lastViolation: 0 };

    const penaltyMultiplier = Math.min(
      cfg.penaltyMultiplier ** Math.min(reputation.violationCount, 3),
      cfg.maxPenaltyMultiplier
    );
    const adjustedLimit = Math.floor(cfg.maxRequests / penaltyMultiplier);

    // Sliding window rate limit
    const rateKey = `${IP_RATE_LIMIT_PREFIX}${ip}`;
    const windowStart = now - cfg.windowMs;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(rateKey, 0, windowStart);
    pipeline.zcard(rateKey);
    pipeline.zadd(rateKey, now, `${now}-${Math.random().toString(36).substring(2)}`);
    pipeline.pexpire(rateKey, cfg.windowMs);

    const results = await pipeline.exec();
    const currentCount = (results?.[1] as number | undefined) ?? 0;

    const allowed = currentCount < adjustedLimit;
    const remaining = Math.max(0, adjustedLimit - currentCount - 1);

    // Record violation if not allowed
    if (!allowed) {
      reputation.violationCount++;
      reputation.lastViolation = now;
      reputation.score = Math.min(100, reputation.score + 10);
      await redis.set(`${IP_REPUTATION_PREFIX}${ip}`, JSON.stringify(reputation), 'EX', 86400);

      // Block if threshold reached
      if (reputation.violationCount >= cfg.blockThreshold) {
        await redis.set(
          `${IP_BLOCK_PREFIX}${ip}`,
          (now + cfg.blockDurationMs).toString(),
          'PX',
          cfg.blockDurationMs
        );
      }
    }

    return {
      allowed,
      remaining,
      resetTime: now + cfg.windowMs,
      penaltyLevel: Math.log2(penaltyMultiplier),
      requiresCaptcha: reputation.violationCount >= 3,
      isBlocked: false,
    };
  } catch (_error: unknown) {
    // Fail open
    return {
      allowed: true,
      remaining: 1,
      resetTime: now + cfg.windowMs,
      penaltyLevel: 0,
      requiresCaptcha: false,
      isBlocked: false,
    };
  }
}
