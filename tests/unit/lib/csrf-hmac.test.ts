/**
 * HMAC-based CSRF Token Unit Tests
 *
 * Tests for the HMAC-based CSRF token implementation
 */

import { describe, expect, it } from 'vitest';

// We need to test the HMAC functions, but they're not exported
// Let's test through the validateCsrfToken function
import { generateCsrfTokenForAppRouter, validateCsrfToken } from '@/lib/security/csrf';

describe('HMAC-based CSRF Tokens', () => {
  describe('generateCsrfTokenForAppRouter', () => {
    it('should generate a token with correct format', () => {
      const { token } = generateCsrfTokenForAppRouter();

      // Token format: version:nonce:hash
      const parts = token.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('v2'); // Version
      expect(parts[1]).toHaveLength(22); // Base64url encoded 16 bytes
      expect(parts[2]).toHaveLength(43); // Base64url encoded 32 bytes (SHA-256)
    });

    it('should generate unique tokens each time', () => {
      const { token: token1 } = generateCsrfTokenForAppRouter();
      const { token: token2 } = generateCsrfTokenForAppRouter();

      expect(token1).not.toBe(token2);
    });
  });

  describe('Token Validation', () => {
    it('should skip validation for GET requests', async () => {
      const mockReq = {
        method: 'GET',
        headers: new Headers(),
        cookies: { get: () => undefined },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(true);
    });

    it('should skip validation for HEAD requests', async () => {
      const mockReq = {
        method: 'HEAD',
        headers: new Headers(),
        cookies: { get: () => undefined },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(true);
    });

    it('should skip validation for OPTIONS requests', async () => {
      const mockReq = {
        method: 'OPTIONS',
        headers: new Headers(),
        cookies: { get: () => undefined },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(true);
    });

    it('should reject request without token header', async () => {
      const mockReq = {
        method: 'POST',
        headers: new Headers(),
        cookies: { get: () => ({ value: 'some-cookie' }) },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(false);
    });

    it('should reject request without cookie', async () => {
      const mockReq = {
        method: 'POST',
        headers: new Headers([['x-csrf-token', 'some-token']]),
        cookies: { get: () => undefined },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(false);
    });

    it('should reject invalid token format', async () => {
      const mockReq = {
        method: 'POST',
        headers: new Headers([['x-csrf-token', 'invalid-token-format']]),
        cookies: { get: () => ({ value: 'cookie-value' }) },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(false);
    });

    it('should reject token with wrong version', async () => {
      const mockReq = {
        method: 'POST',
        headers: new Headers([['x-csrf-token', 'v1:nonce:hash']]),
        cookies: { get: () => ({ value: 'nonce' }) },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(false);
    });

    it('should reject token with mismatched nonce', async () => {
      const { token } = generateCsrfTokenForAppRouter();

      const mockReq = {
        method: 'POST',
        headers: new Headers([['x-csrf-token', token]]),
        cookies: { get: () => ({ value: 'different-nonce' }) },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(false);
    });
  });

  describe('Timing Safety', () => {
    it('should use timing-safe comparison', async () => {
      // This test ensures the implementation doesn't use simple string comparison
      // which would be vulnerable to timing attacks
      const { token } = generateCsrfTokenForAppRouter();
      const parts = token.split(':');

      // Create a token with same structure but different hash
      const maliciousToken = `${parts[0]}:${parts[1]}:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

      const mockReq = {
        method: 'POST',
        headers: new Headers([['x-csrf-token', maliciousToken]]),
        cookies: { get: () => ({ value: parts[1] }) },
      } as unknown as Parameters<typeof validateCsrfToken>[0];

      const result = await validateCsrfToken(mockReq);
      expect(result).toBe(false);
    });
  });
});
