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

// Export from ip-rate-limiter
export {
  checkIPRateLimit,
  extractClientIP,
  isPrivateIP,
  generateCaptchaChallenge,
  verifyCaptchaChallenge,
  recordCaptchaSuccess,
  recordCaptchaFailure,
  cleanupIPRateLimits,
  type IPRateLimitResult,
  type IPReputation,
} from './ip-rate-limiter';

// Export from csrf
export {
  useCsrf,
  fetchWithCsrf,
  getCsrfToken,
  CsrfTokenInput,
  CsrfTokenScript,
  validateCsrfToken,
  withCsrfProtection,
} from './csrf.tsx';

// Export from field-encryption
export {
  encryptField,
  decryptField,
  encryptJSON,
  decryptJSON,
  encryptFields,
  decryptFields,
  createEncryptionMiddleware,
  rotateEncryptionKey,
  isEncrypted,
  hashForSearch,
  logEncryptionOperation,
  type EncryptedField,
  type DataEncryptionKey,
} from './field-encryption';
