/**
 * @fileoverview Security Module - Comprehensive security utilities
 *
 * Provides enterprise-grade security features including:
 * - API key management and validation
 * - Rate limiting (per-user, per-endpoint, IP-based)
 * - Input validation and sanitization
 * - Field-level encryption
 * - CSRF protection
 * - Virus scanning integration
 *
 * ## Security Layers
 *
 * 1. **Perimeter**: TLS, security headers, WAF rules
 * 2. **Authentication**: Session validation, API key verification
 * 3. **Authorization**: RBAC, workspace isolation
 * 4. **Input**: Schema validation, sanitization
 * 5. **Data**: Encryption at rest and in transit
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   checkApiRateLimit,
 *   validateApiKey,
 *   encryptField
 * } from '@/lib/security';
 *
 * // Rate limiting
 * const limit = await checkApiRateLimit(userId, 'chat');
 * if (!limit.success) return error(429);
 *
 * // API key validation
 * const apiKey = extractApiKey(req);
 * const valid = await validateApiKey(apiKey);
 *
 * // Field encryption
 * const encrypted = encryptField(sensitiveData, key);
 * ```
 *
 * @module security
 * @see {@link module:security/rate-limiter} for rate limiting
 * @see {@link module:security/api-keys} for API key management
 * @see {@link module:security/field-encryption} for encryption
 */

// Export from api-keys (excluding items that are also in rate-limiter)
export {
  type ApiKeyValidationResult,
  type ApiKeyWithWorkspace,
  type CreateApiKeyInput,
  cleanupApiKeys,
  createApiKey,
  extractApiKey,
  getApiKeyById,
  getWorkspaceApiKeys,
  requireApiKey,
  revokeApiKey,
  updateApiKey,
  validateApiKey,
} from './api-keys';
// Export from csrf
export {
  CsrfTokenInput,
  CsrfTokenScript,
  fetchWithCsrf,
  getCsrfToken,
  useCsrf,
  validateCsrfToken,
  withCsrfProtection,
} from './csrf.tsx';
// Export from field-encryption
export {
  createEncryptionMiddleware,
  type DataEncryptionKey,
  decryptField,
  decryptFields,
  decryptJSON,
  type EncryptedField,
  encryptField,
  encryptFields,
  encryptJSON,
  hashForSearch,
  isEncrypted,
  logEncryptionOperation,
  rotateEncryptionKey,
} from './field-encryption';
// Export from input-validator
export * from './input-validator';

// Export from ip-rate-limiter
export {
  checkIPRateLimit,
  cleanupIPRateLimits,
  extractClientIP,
  generateCaptchaChallenge,
  type IPRateLimitResult,
  type IPReputation,
  isPrivateIP,
  recordCaptchaFailure,
  recordCaptchaSuccess,
  verifyCaptchaChallenge,
} from './ip-rate-limiter';
// Export from rate-limiter (checkApiRateLimit is preferred from here)
export {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimiter,
  getRateLimitIdentifier,
  type RateLimitConfig,
  RateLimiter,
  type RateLimitResult,
  type RateLimitType,
  rateLimits,
} from './rate-limiter';
// Export from virus-scanner
export * from './virus-scanner';
