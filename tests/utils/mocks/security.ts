import { vi } from 'vitest';

/**
 * Mock Redis client for testing
 */
export const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn().mockReturnThis(),
  zremrangebyscore: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
  ttl: vi.fn().mockResolvedValue(-2),
  multi: vi.fn().mockReturnThis(),
};

/**
 * Create a mock Redis client with custom behavior
 */
export function createMockRedisClient(overrides: Partial<typeof mockRedis> = {}) {
  return {
    ...mockRedis,
    ...overrides,
  };
}

/**
 * Mock CSRF utilities
 */
export const mockCSRF = {
  generateToken: vi.fn().mockReturnValue('mock-csrf-token'),
  validateToken: vi.fn().mockResolvedValue(true),
  getToken: vi.fn().mockReturnValue('mock-csrf-token'),
};

/**
 * Mock rate limiter
 */
export const mockRateLimit = {
  check: vi.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60000,
  }),
  isLimited: vi.fn().mockResolvedValue(false),
  record: vi.fn().mockResolvedValue(undefined),
};

/**
 * Create a mock rate limit that fails
 */
export function createMockFailingRateLimit(resetTime?: number) {
  return {
    check: vi.fn().mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: resetTime || Date.now() + 60000,
    }),
    isLimited: vi.fn().mockResolvedValue(true),
    record: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock rate limit with custom config
 */
export function createMockRateLimitWithConfig(config: {
  limit?: number;
  windowMs?: number;
  initialRemaining?: number;
}) {
  let remaining = config.initialRemaining ?? config.limit ?? 100;

  return {
    check: vi.fn().mockImplementation(() => {
      const success = remaining > 0;
      if (success) remaining--;
      return Promise.resolve({
        success,
        limit: config.limit ?? 100,
        remaining: Math.max(0, remaining),
        reset: Date.now() + (config.windowMs ?? 60000),
      });
    }),
    isLimited: vi.fn().mockImplementation(() => Promise.resolve(remaining <= 0)),
    record: vi.fn().mockResolvedValue(undefined),
    reset: () => {
      remaining = config.initialRemaining ?? config.limit ?? 100;
    },
  };
}

/**
 * Mock IP reputation data
 */
export function createMockIPReputation(
  overrides: Partial<{
    score: number;
    violationCount: number;
    lastViolation: number;
    captchaSolved: number;
    captchaFailed: number;
  }> = {}
) {
  return {
    score: 0,
    violationCount: 0,
    lastViolation: 0,
    captchaSolved: 0,
    captchaFailed: 0,
    ...overrides,
  };
}

/**
 * Mock CAPTCHA challenge
 */
export function createMockCaptchaChallenge() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;

  return {
    challengeId: `challenge-${Date.now()}`,
    question: `What is ${num1} + ${num2}?`,
    answer: num1 + num2,
  };
}

/**
 * Reset all security mocks
 */
export function resetSecurityMocks(): void {
  mockRedis.get.mockReset();
  mockRedis.set.mockReset();
  mockRedis.del.mockReset();
  mockRedis.keys.mockReset();
  mockRedis.pipeline.mockClear();
  mockRedis.zremrangebyscore.mockClear();
  mockRedis.zcard.mockClear();
  mockRedis.zadd.mockClear();
  mockRedis.pexpire.mockClear();
  mockRedis.exec.mockReset();
  mockRedis.ttl.mockReset();
  mockRedis.multi.mockClear();

  mockCSRF.generateToken.mockReset();
  mockCSRF.validateToken.mockReset();
  mockCSRF.getToken.mockReset();

  mockRateLimit.check.mockReset();
  mockRateLimit.isLimited.mockReset();
  mockRateLimit.record.mockReset();
}
