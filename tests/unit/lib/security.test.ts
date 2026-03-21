import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  sanitizeHtml,
  validatePasswordStrength,
} from '@/lib/security/password';
import { encrypt, decrypt } from '@/lib/security/encryption';

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
});
