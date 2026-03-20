/**
 * Security module exports
 */

// Export from api-keys (excluding items that are also in rate-limiter)
export {
  createApiKey,
  validateApiKey,
  revokeApiKey,
  getWorkspaceApiKeys,
  getApiKeyById,
  updateApiKey,
  cleanupApiKeys,
  extractApiKey,
  requireApiKey,
  type CreateApiKeyInput,
  type ApiKeyValidationResult,
  type ApiKeyWithWorkspace,
} from './api-keys';

// Export from rate-limiter (checkApiRateLimit is preferred from here)
export {
  RateLimiter,
  getRateLimiter,
  checkApiRateLimit,
  getRateLimitIdentifier,
  addRateLimitHeaders,
  rateLimits,
  type RateLimitConfig,
  type RateLimitType,
  type RateLimitResult,
} from './rate-limiter';

// Export from input-validator
export * from './input-validator';

// Export from virus-scanner
export * from './virus-scanner';
