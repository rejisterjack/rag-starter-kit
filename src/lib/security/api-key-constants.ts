/**
 * Shared API key format constants (edge-safe — no DB or bcrypt imports).
 * Used by proxy.ts format validation and api-keys.ts generation/validation.
 */

export const API_KEY_PREFIX = 'rag_';
export const API_KEY_BODY_MIN_LENGTH = 16;
export const API_KEY_BODY_MAX_LENGTH = 180;

/** Regex matching the full key string including prefix. */
export function getApiKeyFormatRegex(): RegExp {
  const escapedPrefix = API_KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^${escapedPrefix}[A-Za-z0-9_-]{${API_KEY_BODY_MIN_LENGTH},${API_KEY_BODY_MAX_LENGTH}}$`
  );
}

export function isValidApiKeyFormat(key: string): boolean {
  return getApiKeyFormatRegex().test(key);
}
