/**
 * Password Policy Unit Tests
 *
 * Tests for the enhanced password policy validation
 */

import { describe, expect, it } from 'vitest';
import { changePasswordSchema, registerUserSchema } from '@/lib/security/input-validator';

describe('Password Policy', () => {
  const validEmail = 'test@example.com';

  describe('registerUserSchema', () => {
    it('should accept valid password with all requirements', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: 'ValidPass123!',
      });

      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 12 characters', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: 'Short1!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('12 characters');
      }
    });

    it('should reject password without lowercase letter', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: 'PASSWORD123!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('lowercase'))).toBe(true);
      }
    });

    it('should reject password without uppercase letter', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: 'password123!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('uppercase'))).toBe(true);
      }
    });

    it('should reject password without number', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: 'Password!@#',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('number'))).toBe(true);
      }
    });

    it('should reject password without special character', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: 'Password123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('special character'))).toBe(true);
      }
    });

    it('should reject password longer than 128 characters', () => {
      const result = registerUserSchema.safeParse({
        email: validEmail,
        password: `Valid123!${'a'.repeat(130)}`,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('128 characters');
      }
    });

    it('should accept password with various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '='];

      for (const char of specialChars) {
        const result = registerUserSchema.safeParse({
          email: validEmail,
          password: `ValidPass123${char}`,
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid password change', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456@',
      });

      expect(result.success).toBe(true);
    });

    it('should apply same password policy as registration', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPass123!',
        newPassword: 'weak',
      });

      expect(result.success).toBe(false);
    });
  });
});
