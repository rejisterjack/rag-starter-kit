import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateUrl,
  validateFileType,
  validateFileSize,
  validateApiKey,
  sanitizeInput,
} from '@/lib/security/validation';

describe('Validation Utilities', () => {
  describe('Email Validation', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('not-an-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
      expect(validateEmail('test..test@example.com')).toBe(false);
    });

    it('should reject emails exceeding max length', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(validateEmail(longEmail)).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
      expect(validateUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('')).toBe(false);
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
    });

    it('should validate allowed protocols', () => {
      expect(validateUrl('https://example.com', ['https'])).toBe(true);
      expect(validateUrl('http://example.com', ['https'])).toBe(false);
      expect(validateUrl('https://example.com', ['http', 'https'])).toBe(true);
    });
  });

  describe('File Type Validation', () => {
    it('should validate allowed file types', () => {
      expect(validateFileType('document.pdf', ['pdf', 'doc'])).toBe(true);
      expect(validateFileType('image.png', ['png', 'jpg', 'gif'])).toBe(true);
      expect(validateFileType('file.txt', ['txt', 'md'])).toBe(true);
    });

    it('should reject disallowed file types', () => {
      expect(validateFileType('file.exe', ['pdf', 'doc'])).toBe(false);
      expect(validateFileType('script.js', ['pdf', 'doc'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(validateFileType('document.PDF', ['pdf'])).toBe(true);
      expect(validateFileType('IMAGE.PNG', ['png'])).toBe(true);
    });

    it('should handle files without extension', () => {
      expect(validateFileType('README', ['txt', 'md'])).toBe(false);
    });
  });

  describe('File Size Validation', () => {
    it('should validate files under limit', () => {
      expect(validateFileSize(1024, 2048)).toBe(true); // 1KB under 2KB limit
      expect(validateFileSize(10485760, 52428800)).toBe(true); // 10MB under 50MB
    });

    it('should reject files over limit', () => {
      expect(validateFileSize(3072, 2048)).toBe(false); // 3KB over 2KB limit
      expect(validateFileSize(104857600, 52428800)).toBe(false); // 100MB over 50MB
    });

    it('should handle edge cases', () => {
      expect(validateFileSize(0, 1024)).toBe(true); // Empty file
      expect(validateFileSize(1024, 1024)).toBe(true); // Exactly at limit
    });
  });

  describe('API Key Validation', () => {
    it('should validate correct API key format', () => {
      expect(validateApiKey('sk_test_1234567890abcdef')).toBe(true);
      expect(validateApiKey('pk_live_1234567890abcdef')).toBe(true);
    });

    it('should reject invalid API key formats', () => {
      expect(validateApiKey('')).toBe(false);
      expect(validateApiKey('too-short')).toBe(false);
      expect(validateApiKey('invalid_prefix_1234567890abcdef')).toBe(false);
    });

    it('should reject keys with special characters', () => {
      expect(validateApiKey('sk_test_<script>alert(1)</script>')).toBe(false);
      expect(validateApiKey('sk_test_hello world')).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello world  ')).toBe('hello world');
    });

    it('should remove null bytes', () => {
      expect(sanitizeInput('hello\0world')).toBe('helloworld');
    });

    it('should normalize unicode', () => {
      const normalized = sanitizeInput('café');
      expect(normalized).toBe('café');
    });

    it('should handle empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as unknown as string)).toBe('');
      expect(sanitizeInput(undefined as unknown as string)).toBe('');
    });

    it('should limit length', () => {
      const longString = 'a'.repeat(1000);
      const sanitized = sanitizeInput(longString, { maxLength: 100 });
      expect(sanitized.length).toBe(100);
    });
  });
});
