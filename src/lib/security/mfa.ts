/**
 * Multi-Factor Authentication (TOTP)
 *
 * Implements RFC 6238 time-based one-time passwords.
 * Secrets are encrypted at rest using the existing field-encryption module.
 */

import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';

import { decryptField, type EncryptedField, encryptField } from '@/lib/security/field-encryption';

const TOTP_OPTIONS = {
  issuer: 'RAG Starter Kit',
  period: 30,
  digits: 6,
} as const;

const BCRYPT_ROUNDS = 12;
const BACKUP_CODE_COUNT = 10;

// =============================================================================
// Secret Management
// =============================================================================

export interface TotpSetupResult {
  uri: string;
  secret: string;
  backupCodes: string[];
}

/**
 * Generate a new TOTP secret for a user.
 * Returns the otpauth URI (for QR codes), raw secret, and backup codes.
 */
export function generateTotpSetup(_userId: string, email: string): TotpSetupResult {
  const secret = OTPAuth.Secret.fromHex(
    Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );

  const totp = new OTPAuth.TOTP({
    ...TOTP_OPTIONS,
    label: email,
    secret,
  });

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );

  return {
    uri: totp.toString(),
    secret: secret.hex,
    backupCodes,
  };
}

/**
 * Encrypt a TOTP secret for database storage
 */
export function encryptTotpSecret(secret: string, userId: string): string {
  const encrypted = encryptField(secret, userId);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt a TOTP secret from database storage
 */
export function decryptTotpSecret(encrypted: string, userId: string): string {
  const parsed = JSON.parse(encrypted) as EncryptedField;
  return decryptField(parsed, userId);
}

// =============================================================================
// Code Verification
// =============================================================================

/**
 * Verify a TOTP code against an encrypted secret
 */
export function verifyTotpCode(code: string, encryptedSecret: string, userId: string): boolean {
  const secret = decryptTotpSecret(encryptedSecret, userId);

  const totp = new OTPAuth.TOTP({
    ...TOTP_OPTIONS,
    secret: OTPAuth.Secret.fromHex(secret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// =============================================================================
// Backup Codes
// =============================================================================

/**
 * Hash backup codes for storage
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)));
}

/**
 * Verify a backup code against the hashed list.
 * Returns the index of the matched code, or -1 if not found.
 */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<number> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const matched = await bcrypt.compare(code, hashedCodes[i] as string);
    if (matched) return i;
  }
  return -1;
}

/**
 * Remove a used backup code from the list
 */
export function removeUsedBackupCode(hashedCodes: string[], index: number): string[] {
  return hashedCodes.filter((_, i) => i !== index);
}
