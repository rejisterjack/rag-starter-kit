/**
 * Password Security Utilities
 *
 * Provides password hashing, verification, strength validation,
 * secure token generation, and HTML sanitization.
 */

import { randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// =============================================================================
// Password Hashing
// =============================================================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

// =============================================================================
// Password Strength Validation
// =============================================================================

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number;
  errors: string[];
}

/**
 * Validate password strength
 *
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score++;
  } else {
    errors.push('at least 8 characters');
  }

  if (/[a-z]/.test(password)) {
    score++;
  } else {
    errors.push('lowercase letter');
  }

  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    errors.push('uppercase letter');
  }

  if (/\d/.test(password)) {
    score++;
  } else {
    errors.push('number');
  }

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    score++;
  } else {
    errors.push('special character');
  }

  // Bonus points for length
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  return {
    isValid: errors.length === 0,
    score,
    errors,
  };
}

// =============================================================================
// Secure Token Generation
// =============================================================================

/**
 * Generate a cryptographically secure random token
 *
 * @param bytes - Number of random bytes (output will be hex-encoded, so 2x length)
 * @returns Hex-encoded secure token
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

// =============================================================================
// HTML Sanitization
// =============================================================================

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return purify.sanitize(input, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'span',
      'div',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_DOM: true,
  });
}
