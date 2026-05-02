/**
 * IP-Based Rate Limiter for Anonymous Users
 *
 * Provides stricter rate limiting for unauthenticated users with:
 * - IP reputation tracking
 * - Progressive delays
 * - CAPTCHA challenges after threshold
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import { redis } from './rate-limiter';

// =============================================================================
// Configuration
// =============================================================================

const IP_RATE_LIMIT_PREFIX = 'ip_ratelimit:';
const IP_REPUTATION_PREFIX = 'ip_reputation:';
const IP_CHALLENGE_PREFIX = 'ip_challenge:';

interface IPRateLimitConfig {
  // Base limits
  maxRequests: number;
  windowMs: number;

  // Progressive penalty
  penaltyMultiplier: number;
  maxPenaltyMultiplier: number;

  // CAPTCHA threshold
  captchaThreshold: number;
  captchaWindowMs: number;

  // Block threshold
  blockThreshold: number;
  blockDurationMs: number;
}

const DEFAULT_CONFIG: IPRateLimitConfig = {
  maxRequests: 30, // 30 requests per window
  windowMs: 60 * 1000, // 1 minute
  penaltyMultiplier: 2, // Double the limit after violation
  maxPenaltyMultiplier: 8, // Max 8x stricter
  captchaThreshold: 3, // Show CAPTCHA after 3 violations
  captchaWindowMs: 5 * 60 * 1000, // 5 minutes
  blockThreshold: 5, // Block after 5 violations
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
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

export interface IPReputation {
  score: number; // 0-100, higher is worse
  violationCount: number;
  lastViolation: number;
  captchaSolved: number;
  captchaFailed: number;
}

// =============================================================================
// IP Extraction
// =============================================================================

/**
 * Extract client IP from request
 * Handles various proxy configurations
 */
export function extractClientIP(req: Request): string {
  // Check for forwarded IP (common proxy headers)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP in the chain (client IP)
    return forwarded.split(',')[0].trim();
  }

  // Other common headers
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;

  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  const trueIP = req.headers.get('true-client-ip');
  if (trueIP) return trueIP;

  // Fallback
  return 'unknown';
}

/**
 * Check if IP is in private/reserved range
 */
export function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^127\./, // Loopback
    /^10\./, // Private Class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
    /^192\.168\./, // Private Class C
    /^169\.254\./, // Link-local
    /^::1$/, // IPv6 loopback
    /^fc00:/i, // IPv6 private
    /^fe80:/i, // IPv6 link-local
  ];

  return privateRanges.some((range) => range.test(ip));
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Check IP-based rate limit with progressive penalties
 */
export async function checkIPRateLimit(
  req: Request,
  config: Partial<IPRateLimitConfig> = {}
): Promise<IPRateLimitResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const ip = extractClientIP(req);
  const now = Date.now();

  // Skip rate limiting for private IPs in development
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
    // Check if IP is blocked
    const blockKey = `${IP_RATE_LIMIT_PREFIX}block:${ip}`;
    const blockExpiry = await redis.get(blockKey);

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
      // Block expired, remove it
      await redis.del(blockKey);
    }

    // Get current penalty level
    const reputation = await getIPReputation(ip);
    const penaltyMultiplier = Math.min(
      cfg.penaltyMultiplier ** Math.min(reputation.violationCount, 3),
      cfg.maxPenaltyMultiplier
    );

    const adjustedLimit = Math.floor(cfg.maxRequests / penaltyMultiplier);

    // Check rate limit using Redis
    const rateKey = `${IP_RATE_LIMIT_PREFIX}${ip}`;
    const windowStart = now - cfg.windowMs;

    // Use Redis sorted set for sliding window
    const pipeline = redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(rateKey, 0, windowStart);

    // Count current entries
    pipeline.zcard(rateKey);

    // Add current request
    pipeline.zadd(rateKey, now, `${now}-${Math.random().toString(36).substring(2)}`);

    // Set expiry
    pipeline.pexpire(rateKey, cfg.windowMs);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    const allowed = currentCount < adjustedLimit;
    const remaining = Math.max(0, adjustedLimit - currentCount - 1);

    // Check if CAPTCHA is required
    const requiresCaptcha = reputation.violationCount >= cfg.captchaThreshold;

    // If not allowed, record violation
    if (!allowed) {
      await recordIPViolation(ip, req);
    }

    return {
      allowed,
      remaining,
      resetTime: now + cfg.windowMs,
      penaltyLevel: Math.log2(penaltyMultiplier),
      requiresCaptcha,
      isBlocked: false,
    };
  } catch (error) {
    logger.error('IP rate limit check failed', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fail open on error (allow request)
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

/**
 * Record a rate limit violation for an IP
 */
async function recordIPViolation(ip: string, req: Request): Promise<void> {
  try {
    const reputation = await getIPReputation(ip);

    reputation.violationCount++;
    reputation.lastViolation = Date.now();
    reputation.score = Math.min(100, reputation.score + 10);

    await saveIPReputation(ip, reputation);

    // Log the violation
    await logAuditEvent({
      event: AuditEvent.RATE_LIMIT_HIT,
      metadata: {
        ip,
        userAgent: req.headers.get('user-agent'),
        violationCount: reputation.violationCount,
      },
      severity: 'WARNING',
    });

    // Check if IP should be blocked
    const cfg = DEFAULT_CONFIG;
    if (reputation.violationCount >= cfg.blockThreshold) {
      const blockKey = `${IP_RATE_LIMIT_PREFIX}block:${ip}`;
      await redis.set(
        blockKey,
        (Date.now() + cfg.blockDurationMs).toString(),
        'PX',
        cfg.blockDurationMs
      );

      logger.warn('IP blocked due to rate limit violations', {
        ip,
        violationCount: reputation.violationCount,
        blockDuration: cfg.blockDurationMs,
      });
    }
  } catch (error) {
    logger.error('Failed to record IP violation', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// IP Reputation
// =============================================================================

/**
 * Get IP reputation from Redis
 */
async function getIPReputation(ip: string): Promise<IPReputation> {
  try {
    const data = await redis.get(`${IP_REPUTATION_PREFIX}${ip}`);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error: unknown) {
    logger.debug('Failed to parse IP reputation data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return {
    score: 0,
    violationCount: 0,
    lastViolation: 0,
    captchaSolved: 0,
    captchaFailed: 0,
  };
}

/**
 * Save IP reputation to Redis
 */
async function saveIPReputation(ip: string, reputation: IPReputation): Promise<void> {
  // Expire reputation after 24 hours of no violations
  const ttl = 24 * 60 * 60; // 24 hours in seconds
  await redis.set(`${IP_REPUTATION_PREFIX}${ip}`, JSON.stringify(reputation), 'EX', ttl);
}

/**
 * Record successful CAPTCHA solve
 */
export async function recordCaptchaSuccess(ip: string): Promise<void> {
  const reputation = await getIPReputation(ip);
  reputation.captchaSolved++;
  reputation.score = Math.max(0, reputation.score - 20);
  await saveIPReputation(ip, reputation);
}

/**
 * Record failed CAPTCHA attempt
 */
export async function recordCaptchaFailure(ip: string): Promise<void> {
  const reputation = await getIPReputation(ip);
  reputation.captchaFailed++;
  reputation.score = Math.min(100, reputation.score + 15);
  await saveIPReputation(ip, reputation);
}

// =============================================================================
// CAPTCHA Challenge
// =============================================================================

/**
 * Generate a CAPTCHA challenge for an IP
 */
export async function generateCaptchaChallenge(ip: string): Promise<{
  challengeId: string;
  question: string;
}> {
  const challengeId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Simple math CAPTCHA (can be replaced with reCAPTCHA/hCaptcha integration)
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = num1 + num2;

  const challenge = {
    ip,
    answer,
    createdAt: Date.now(),
  };

  // Store challenge with 5 minute expiry
  await redis.set(`${IP_CHALLENGE_PREFIX}${challengeId}`, JSON.stringify(challenge), 'EX', 300);

  return {
    challengeId,
    question: `What is ${num1} + ${num2}?`,
  };
}

/**
 * Verify a CAPTCHA challenge response
 */
export async function verifyCaptchaChallenge(
  challengeId: string,
  response: string,
  ip: string
): Promise<boolean> {
  try {
    const data = await redis.get(`${IP_CHALLENGE_PREFIX}${challengeId}`);

    if (!data) {
      return false;
    }

    const challenge = JSON.parse(data);

    // Verify IP matches
    if (challenge.ip !== ip) {
      return false;
    }

    // Verify answer
    const isCorrect = parseInt(response, 10) === challenge.answer;

    // Delete challenge (one-time use)
    await redis.del(`${IP_CHALLENGE_PREFIX}${challengeId}`);

    if (isCorrect) {
      await recordCaptchaSuccess(ip);
    } else {
      await recordCaptchaFailure(ip);
    }

    return isCorrect;
  } catch (error: unknown) {
    logger.warn('CAPTCHA verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up expired IP rate limit data
 * Can be called from a scheduled job
 */
export async function cleanupIPRateLimits(): Promise<{
  rateLimitsRemoved: number;
  reputationsRemoved: number;
}> {
  try {
    // Find and delete old rate limit keys
    const rateLimitKeys = await redis.keys(`${IP_RATE_LIMIT_PREFIX}*`);
    const reputationKeys = await redis.keys(`${IP_REPUTATION_PREFIX}*`);

    let rateLimitsRemoved = 0;
    let reputationsRemoved = 0;

    // Check each rate limit key for expiration
    for (const key of rateLimitKeys) {
      const ttl = await redis.ttl(key);
      if (ttl < 0) {
        await redis.del(key);
        rateLimitsRemoved++;
      }
    }

    // Clean up old reputation entries
    const now = Date.now();
    for (const key of reputationKeys) {
      const data = await redis.get(key);
      if (data) {
        const reputation: IPReputation = JSON.parse(data);
        // Remove if no violations in last 7 days
        if (now - reputation.lastViolation > 7 * 24 * 60 * 60 * 1000) {
          await redis.del(key);
          reputationsRemoved++;
        }
      }
    }

    logger.info('IP rate limit cleanup completed', {
      rateLimitsRemoved,
      reputationsRemoved,
    });

    return { rateLimitsRemoved, reputationsRemoved };
  } catch (error) {
    logger.error('IP rate limit cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { rateLimitsRemoved: 0, reputationsRemoved: 0 };
  }
}
