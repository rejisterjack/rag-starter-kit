import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  sanitizeHtml,
  validatePasswordStrength,
} from '@/lib/security/password';
import { encrypt, decrypt } from '@/lib/security/encryption';
import {
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
} from '@/lib/security/field-encryption';
import {
  generateCsrfToken,
  generateCsrfTokenForAppRouter,
  validateCsrfToken,
  withCsrfProtection,
  getCsrfToken,
  fetchWithCsrf,
  CsrfTokenInput,
  CsrfTokenScript,
} from '@/lib/security/csrf';
import {
  RateLimiter,
  checkRateLimit,
  checkApiRateLimit,
  getRateLimitIdentifier,
  addRateLimitHeaders,
  rateLimits,
  getRateLimiter,
} from '@/lib/security/rate-limiter';
import {
  checkIPRateLimit,
  extractClientIP,
  isPrivateIP,
  generateCaptchaChallenge,
  verifyCaptchaChallenge,
  recordCaptchaSuccess,
  recordCaptchaFailure,
  cleanupIPRateLimits,
  IPReputation,
} from '@/lib/security/ip-rate-limiter';

// Mock Redis
const mockRedis = {
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
};

vi.mock('@/lib/security/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    redis: mockRedis,
  };
});

describe('Security Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(1000);
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('Password Strength Validation', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should reject short password', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('uppercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('number');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('special character');
    });

    it('should provide score for each password', () => {
      const weak = validatePasswordStrength('weak');
      const medium = validatePasswordStrength('Medium1!');
      const strong = validatePasswordStrength('VeryStrong123!@#');

      expect(weak.score).toBeLessThan(medium.score);
      expect(medium.score).toBeLessThan(strong.score);
    });
  });

  describe('Token Generation', () => {
    it('should generate secure token', () => {
      const token = generateSecureToken(32);
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // hex encoding doubles length
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken(32);
      const token2 = generateSecureToken(32);
      expect(token1).not.toBe(token2);
    });

    it('should generate token with correct length', () => {
      const token16 = generateSecureToken(16);
      expect(token16.length).toBe(32);

      const token64 = generateSecureToken(64);
      expect(token64.length).toBe(128);
    });
  });

  describe('HTML Sanitization', () => {
    it('should remove script tags', () => {
      const dirty = '<p>Hello</p><script>alert("xss")</script>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Hello</p>');
    });

    it('should remove event handlers', () => {
      const dirty = '<img src="x" onerror="alert(\'xss\')">';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onerror');
    });

    it('should allow safe HTML', () => {
      const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const clean = sanitizeHtml(safe);
      expect(clean).toContain('<strong>');
      expect(clean).toContain('<em>');
    });

    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as unknown as string)).toBe('');
    });

    it('should remove javascript: URLs', () => {
      const dirty = '<a href="javascript:alert(\'xss\')">Click</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('should handle nested malicious content', () => {
      const dirty = '<p><script>alert(1)</script><span onclick="evil()">text</span></p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onclick');
    });
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt text', () => {
      const secret = 'my-secret-key-32chars-long!!';
      const text = 'Sensitive data';

      const encrypted = encrypt(text, secret);
      expect(encrypted).not.toBe(text);
      expect(encrypted).toBeDefined();

      const decrypted = decrypt(encrypted, secret);
      expect(decrypted).toBe(text);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const secret = 'my-secret-key-32chars-long!!';
      const text = 'Test';

      const encrypted1 = encrypt(text, secret);
      const encrypted2 = encrypt(text, secret);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail with wrong key', () => {
      const secret = 'my-secret-key-32chars-long!!';
      const wrongSecret = 'wrong-key-32chars-long!!!!!';
      const text = 'Sensitive data';

      const encrypted = encrypt(text, secret);

      expect(() => decrypt(encrypted, wrongSecret)).toThrow();
    });
  });

  describe('Field Encryption', () => {
    const entityId = 'user-123';

    beforeEach(() => {
      process.env.ENCRYPTION_MASTER_KEY = 'test-master-key-32chars-long!!';
      process.env.NEXTAUTH_SECRET = 'test-master-key-32chars-long!!';
    });

    it('should encrypt and decrypt field', () => {
      const plaintext = 'Sensitive field data';

      const encrypted = encryptField(plaintext, entityId);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('version');

      const decrypted = decryptField(encrypted, entityId);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt JSON data', () => {
      const data = { ssn: '123-45-6789', dob: '1990-01-01' };

      const encrypted = encryptJSON(data, entityId);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptJSON<typeof data>(encrypted, entityId);
      expect(decrypted).toEqual(data);
    });

    it('should encrypt specific fields in object', () => {
      const data = {
        id: 'user-123',
        name: 'John Doe',
        ssn: '123-45-6789',
        email: 'john@example.com',
      };

      const encrypted = encryptFields(data, {
        fields: ['ssn', 'email'],
        entityIdField: 'id',
      });

      expect(encrypted.id).toBe('user-123');
      expect(encrypted.name).toBe('John Doe');
      // SSN and email should be encrypted (JSON strings)
      expect(typeof encrypted.ssn).toBe('string');
      expect(typeof encrypted.email).toBe('string');
      expect(encrypted.ssn).not.toBe('123-45-6789');
    });

    it('should decrypt specific fields in object', () => {
      const data = {
        id: 'user-123',
        name: 'John Doe',
        ssn: '123-45-6789',
      };

      const encrypted = encryptFields(data, {
        fields: ['ssn'],
        entityIdField: 'id',
      });

      const decrypted = decryptFields(encrypted, {
        fields: ['ssn'],
        entityIdField: 'id',
      });

      expect(decrypted.ssn).toBe('123-45-6789');
    });

    it('should throw if entity ID field missing', () => {
      const data = { name: 'John' };

      expect(() =>
        encryptFields(data, {
          fields: ['name'],
          entityIdField: 'id',
        })
      ).toThrow('Entity ID field');
    });

    it('should rotate encryption key', () => {
      const plaintext = 'Secret data';
      const oldEntityId = 'old-key';
      const newEntityId = 'new-key';

      const encrypted = encryptField(plaintext, oldEntityId);
      const rotated = rotateEncryptionKey(encrypted, oldEntityId, newEntityId);

      // Should be decryptable with new key
      const decrypted = decryptField(rotated, newEntityId);
      expect(decrypted).toBe(plaintext);
    });

    it('should detect encrypted fields', () => {
      const plaintext = 'test';
      const encrypted = encryptField(plaintext, entityId);

      expect(isEncrypted(JSON.stringify(encrypted))).toBe(true);
      expect(isEncrypted('plaintext')).toBe(false);
      expect(isEncrypted('{"normal": "json"}')).toBe(false);
    });

    it('should create searchable hash', () => {
      const value = 'searchable@example.com';

      const hash1 = hashForSearch(value, entityId);
      const hash2 = hashForSearch(value, entityId);

      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1).not.toBe(value); // Not plaintext
    });

    it('should create encryption middleware', async () => {
      const middleware = createEncryptionMiddleware({
        User: {
          fields: ['ssn'],
          entityIdField: 'id',
        },
      });

      const next = vi.fn().mockResolvedValue({ id: 'user-123', ssn: '123-45-6789' });

      const result = await middleware(
        {
          model: 'User',
          action: 'create',
          args: { data: { id: 'user-123', ssn: '123-45-6789' } },
        },
        next
      );

      expect(next).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should generate CSRF token', () => {
      const mockReq = { headers: {} } as unknown as Request;
      const mockRes = { setHeader: vi.fn() } as unknown as Response;

      const token = generateCsrfToken(mockReq, mockRes);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate CSRF token for App Router', () => {
      const result = generateCsrfTokenForAppRouter();

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('cookieHeader');
      expect(result.token.length).toBe(64); // 32 bytes hex encoded
    });

    it('should validate CSRF token from header', async () => {
      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('valid-token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        },
      } as unknown as import('next/server').NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(true);
    });

    it('should reject invalid CSRF token', async () => {
      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('invalid-token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        },
      } as unknown as import('next/server').NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(false);
    });

    it('should skip validation for safe methods', async () => {
      const mockReq = {
        method: 'GET',
        headers: {
          get: vi.fn(),
        },
      } as unknown as import('next/server').NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(true);
    });

    it('should reject missing token', async () => {
      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'token' }),
        },
      } as unknown as import('next/server').NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(false);
    });

    it('should reject missing cookie', async () => {
      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as import('next/server').NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(false);
    });

    it('should wrap handler with CSRF protection', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('OK'));
      const protectedHandler = withCsrfProtection(handler);

      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('valid-token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        },
      } as unknown as import('next/server').NextRequest;

      await protectedHandler(mockReq);

      expect(handler).toHaveBeenCalled();
    });

    it('should block requests with invalid CSRF via middleware', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('OK'));
      const protectedHandler = withCsrfProtection(handler);

      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('invalid'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'token' }),
        },
      } as unknown as import('next/server').NextRequest;

      const response = await protectedHandler(mockReq);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });

    it('should render CSRF token input component', () => {
      const element = CsrfTokenInput();

      expect(element.type).toBe('input');
      expect(element.props.type).toBe('hidden');
      expect(element.props.name).toBe('_csrf');
    });

    it('should render CSRF token script component', () => {
      const element = CsrfTokenScript();

      expect(element.type).toBe('script');
      expect(element.props.dangerouslySetInnerHTML).toBeDefined();
    });

    it('should get CSRF token from DOM', () => {
      // Mock document
      const mockMeta = {
        getAttribute: vi.fn().mockReturnValue('test-token'),
      };
      Object.defineProperty(global, 'document', {
        value: {
          querySelector: vi.fn().mockReturnValue(mockMeta),
        },
        writable: true,
      });

      const token = getCsrfToken();

      expect(token).toBe('test-token');
    });

    it('should return null for missing token', () => {
      Object.defineProperty(global, 'document', {
        value: {
          querySelector: vi.fn().mockReturnValue(null),
        },
        writable: true,
      });

      const token = getCsrfToken();

      expect(token).toBeNull();
    });

    it('should include CSRF token in fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response('OK'));

      Object.defineProperty(global, 'document', {
        value: {
          querySelector: vi.fn().mockReturnValue({
            getAttribute: vi.fn().mockReturnValue('test-token'),
          }),
        },
        writable: true,
      });

      await fetchWithCsrf('/api/test', { method: 'POST' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-csrf-token': 'test-token',
          }),
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create rate limiter', () => {
      const limiter = getRateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should check rate limit', async () => {
      mockRedis.exec.mockResolvedValueOnce([[null, 0], [null, 0], [null, 1], [null, 1]]);

      const result = await checkRateLimit('user-123', 'chat');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('reset');
    });

    it('should deny when limit exceeded', async () => {
      // Mock that we already have 50 requests (at limit)
      mockRedis.exec.mockResolvedValueOnce([
        [null, 0],
        [null, 50],
        [null, 1],
        [null, 1],
      ]);

      const result = await checkRateLimit('user-123', 'chat');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should get rate limit identifier from user', () => {
      const mockReq = new Request('http://localhost');

      const identifier = getRateLimitIdentifier(mockReq, { userId: 'user-123' });

      expect(identifier).toBe('user:user-123');
    });

    it('should get rate limit identifier from IP', () => {
      const mockReq = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const identifier = getRateLimitIdentifier(mockReq);

      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should add rate limit headers', () => {
      const headers = new Headers();
      const result = {
        success: true,
        limit: 100,
        remaining: 50,
        reset: Date.now() + 60000,
      };

      addRateLimitHeaders(headers, result);

      expect(headers.get('X-RateLimit-Limit')).toBe('100');
      expect(headers.get('X-RateLimit-Remaining')).toBe('50');
      expect(headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should have predefined rate limits', () => {
      expect(rateLimits.chat).toBeDefined();
      expect(rateLimits.chat.limit).toBe(50);
      expect(rateLimits.chat.windowMs).toBe(60 * 60 * 1000);

      expect(rateLimits.login).toBeDefined();
      expect(rateLimits.login.limit).toBe(5);
    });

    it('should check API rate limit with metadata', async () => {
      mockRedis.exec.mockResolvedValueOnce([[null, 0], [null, 0], [null, 1], [null, 1]]);

      const result = await checkApiRateLimit('user-123', 'chat', {
        userId: 'user-123',
        workspaceId: 'ws-1',
        endpoint: '/api/chat',
      });

      expect(result).toBeDefined();
    });
  });

  describe('IP Rate Limiting', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should extract client IP from headers', () => {
      const mockReq = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      const ip = extractClientIP(mockReq);

      expect(ip).toBe('192.168.1.1');
    });

    it('should extract client IP from x-real-ip', () => {
      const mockReq = new Request('http://localhost', {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
      });

      const ip = extractClientIP(mockReq);

      expect(ip).toBe('192.168.1.2');
    });

    it('should fallback to unknown', () => {
      const mockReq = new Request('http://localhost');

      const ip = extractClientIP(mockReq);

      expect(ip).toBe('unknown');
    });

    it('should detect private IPs', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should not detect public IPs as private', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('203.0.113.1')).toBe(false);
    });

    it('should allow request for private IP in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockReq = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '127.0.0.1' },
      });

      const result = await checkIPRateLimit(mockReq);

      expect(result.allowed).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should check rate limit for public IP', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRedis.get.mockResolvedValueOnce(null); // Not blocked
      mockRedis.get.mockResolvedValueOnce(null); // No reputation
      mockRedis.exec.mockResolvedValueOnce([[null, 0], [null, 0], [null, 1], [null, 1]]);

      const mockReq = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      const result = await checkIPRateLimit(mockReq);

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');

      process.env.NODE_ENV = originalEnv;
    });

    it('should block when IP is blocked', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const futureTime = Date.now() + 60000;
      mockRedis.get.mockResolvedValueOnce(futureTime.toString()); // Blocked

      const mockReq = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      const result = await checkIPRateLimit(mockReq);

      expect(result.allowed).toBe(false);
      expect(result.isBlocked).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should require CAPTCHA after violations', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRedis.get.mockResolvedValueOnce(null); // Not blocked
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          score: 30,
          violationCount: 3,
          lastViolation: Date.now(),
          captchaSolved: 0,
          captchaFailed: 0,
        } as IPReputation)
      );
      mockRedis.exec.mockResolvedValueOnce([[null, 0], [null, 0], [null, 1], [null, 1]]);

      const mockReq = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      const result = await checkIPRateLimit(mockReq);

      expect(result.requiresCaptcha).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should generate CAPTCHA challenge', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      const challenge = await generateCaptchaChallenge('192.168.1.1');

      expect(challenge).toHaveProperty('challengeId');
      expect(challenge).toHaveProperty('question');
      expect(challenge.question).toMatch(/What is \d+ \+ \d+\?/);
    });

    it('should verify correct CAPTCHA answer', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ ip: '192.168.1.1', answer: 15, createdAt: Date.now() })
      );
      mockRedis.del.mockResolvedValueOnce(1);
      mockRedis.set.mockResolvedValueOnce('OK');

      const result = await verifyCaptchaChallenge('challenge-123', '15', '192.168.1.1');

      expect(result).toBe(true);
    });

    it('should reject incorrect CAPTCHA answer', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ ip: '192.168.1.1', answer: 15, createdAt: Date.now() })
      );
      mockRedis.del.mockResolvedValueOnce(1);
      mockRedis.set.mockResolvedValueOnce('OK');

      const result = await verifyCaptchaChallenge('challenge-123', '20', '192.168.1.1');

      expect(result).toBe(false);
    });

    it('should reject CAPTCHA from wrong IP', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ ip: '192.168.1.1', answer: 15, createdAt: Date.now() })
      );

      const result = await verifyCaptchaChallenge('challenge-123', '15', '10.0.0.1');

      expect(result).toBe(false);
    });

    it('should reject expired CAPTCHA', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await verifyCaptchaChallenge('challenge-123', '15', '192.168.1.1');

      expect(result).toBe(false);
    });

    it('should record CAPTCHA success', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          score: 50,
          violationCount: 3,
          lastViolation: Date.now(),
          captchaSolved: 0,
          captchaFailed: 0,
        })
      );
      mockRedis.set.mockResolvedValueOnce('OK');

      await recordCaptchaSuccess('192.168.1.1');

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should record CAPTCHA failure', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          score: 50,
          violationCount: 3,
          lastViolation: Date.now(),
          captchaSolved: 0,
          captchaFailed: 0,
        })
      );
      mockRedis.set.mockResolvedValueOnce('OK');

      await recordCaptchaFailure('192.168.1.1');

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should cleanup expired rate limits', async () => {
      mockRedis.keys.mockResolvedValueOnce(['ip_ratelimit:1', 'ip_ratelimit:2']);
      mockRedis.keys.mockResolvedValueOnce(['ip_reputation:1']);
      mockRedis.ttl.mockResolvedValueOnce(-1);
      mockRedis.del.mockResolvedValueOnce(1);
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          score: 10,
          violationCount: 1,
          lastViolation: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        })
      );
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await cleanupIPRateLimits();

      expect(result.rateLimitsRemoved).toBeGreaterThanOrEqual(0);
      expect(result.reputationsRemoved).toBeGreaterThanOrEqual(0);
    });

    it('should fail open on Redis error', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));

      const mockReq = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      const result = await checkIPRateLimit(mockReq);

      expect(result.allowed).toBe(true); // Fail open

      process.env.NODE_ENV = originalEnv;
    });
  });
});
