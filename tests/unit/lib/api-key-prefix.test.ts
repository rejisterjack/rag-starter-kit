import { describe, expect, it } from 'vitest';
import {
  API_KEY_PREFIX,
  getApiKeyFormatRegex,
  isValidApiKeyFormat,
} from '@/lib/security/api-key-constants';

describe('API key prefix alignment', () => {
  it('uses rag_ prefix', () => {
    expect(API_KEY_PREFIX).toBe('rag_');
  });

  it('accepts keys generated with the rag_ prefix', () => {
    const sampleKey = `${API_KEY_PREFIX}${'a'.repeat(32)}`;
    expect(isValidApiKeyFormat(sampleKey)).toBe(true);
    expect(getApiKeyFormatRegex().test(sampleKey)).toBe(true);
  });

  it('rejects legacy rsk_ prefix keys at the proxy layer', () => {
    const legacyKey = `rsk_${'a'.repeat(32)}`;
    expect(isValidApiKeyFormat(legacyKey)).toBe(false);
  });

  it('rejects keys without prefix', () => {
    expect(isValidApiKeyFormat('not-a-valid-key')).toBe(false);
  });
});
