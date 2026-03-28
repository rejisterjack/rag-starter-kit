/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption for sensitive data at rest.
 * Uses the ENCRYPTION_MASTER_KEY environment variable for encryption.
 *
 * SECURITY NOTE: The master key should be:
 * - At least 32 characters long
 * - Stored securely (e.g., in a secrets manager)
 * - Never committed to version control
 * - Rotated periodically
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { logger } from '@/lib/logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Derive an encryption key from the master key and salt
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * Encrypt sensitive data
 *
 * @param plaintext - The data to encrypt
 * @returns Encrypted data as a base64 string (format: salt:iv:authTag:ciphertext)
 * @throws Error if encryption fails or master key is not configured
 */
export function encrypt(plaintext: string): string {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKey) {
    logger.warn('ENCRYPTION_MASTER_KEY not set, storing data unencrypted');
    // Return plaintext with a marker to indicate it's unencrypted
    return `unencrypted:${plaintext}`;
  }

  if (masterKey.length < 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters');
  }

  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from master key
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: salt:iv:authTag:ciphertext (all base64 encoded)
    const encrypted = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(ciphertext, 'base64'),
    ]).toString('base64');

    return `enc:v1:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt encrypted data
 *
 * @param encryptedData - The encrypted data (format: enc:v1:salt:iv:authTag:ciphertext or unencrypted:plaintext)
 * @returns The decrypted plaintext
 * @throws Error if decryption fails or data is corrupted
 */
export function decrypt(encryptedData: string): string {
  // Check if data is unencrypted (for backward compatibility)
  if (encryptedData.startsWith('unencrypted:')) {
    return encryptedData.slice('unencrypted:'.length);
  }

  // Check if data is in the expected format
  if (!encryptedData.startsWith('enc:v1:')) {
    // Legacy: assume it's plaintext
    logger.warn('Decrypting legacy unencrypted data');
    return encryptedData;
  }

  const masterKey = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY not set, cannot decrypt data');
  }

  try {
    // Extract the encrypted portion
    const encrypted = encryptedData.slice('enc:v1:'.length);
    const encryptedBuffer = Buffer.from(encrypted, 'base64');

    // Extract components
    let offset = 0;
    const salt = encryptedBuffer.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = encryptedBuffer.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const authTag = encryptedBuffer.subarray(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;

    const ciphertext = encryptedBuffer.subarray(offset);

    // Derive key
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf8');
  } catch (error) {
    logger.error('Decryption failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new Error('Failed to decrypt data - data may be corrupted or master key has changed');
  }
}

/**
 * Check if data is encrypted
 */
export function isEncrypted(data: string | null | undefined): boolean {
  if (!data) return false;
  return data.startsWith('enc:v1:') || data.startsWith('unencrypted:');
}

/**
 * Hash a value using SHA-256 (for one-way hashing like API keys)
 */
export function hashValue(value: string): string {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Verify a value against its hash
 */
export function verifyHash(value: string, hash: string): boolean {
  return hashValue(value) === hash;
}
