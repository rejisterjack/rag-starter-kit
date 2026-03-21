/**
 * Field-Level Encryption
 * 
 * Provides transparent encryption for sensitive fields using AES-256-GCM.
 * Uses envelope encryption pattern with data encryption keys (DEKs) encrypted
 * by a master key.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Master key from environment (should be 32 bytes for AES-256)
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || process.env.NEXTAUTH_SECRET || '';

// =============================================================================
// Types
// =============================================================================

export interface EncryptedField {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
}

export interface DataEncryptionKey {
  id: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  createdAt: Date;
}

// =============================================================================
// Key Derivation
// =============================================================================

/**
 * Derive an encryption key from the master key and a salt
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * Get or create a data encryption key for a specific entity
 * In production, this should be stored in a separate key management service
 */
function getDataEncryptionKey(entityId: string): Buffer {
  // Derive a consistent key for the entity
  // In production, use a proper key management service like AWS KMS, Azure Key Vault, etc.
  const salt = createHash('sha256').update(entityId).digest().slice(0, 16);
  return deriveKey(MASTER_KEY, salt);
}

// =============================================================================
// Encryption
// =============================================================================

/**
 * Encrypt a string value
 * @param plaintext - The value to encrypt
 * @param entityId - Entity identifier for key derivation (e.g., userId, workspaceId)
 * @returns Encrypted field object
 */
export function encryptField(plaintext: string, entityId: string): EncryptedField {
  try {
    // Get encryption key for this entity
    const key = getDataEncryptionKey(entityId);
    
    // Generate random IV
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      version: 1,
    };
  } catch (error) {
    logger.error('Field encryption failed', {
      entityId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt an encrypted field
 * @param encrypted - The encrypted field object
 * @param entityId - Entity identifier for key derivation
 * @returns Decrypted plaintext
 */
export function decryptField(encrypted: EncryptedField, entityId: string): string {
  try {
    // Get encryption key for this entity
    const key = getDataEncryptionKey(entityId);
    
    // Decode components
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  } catch (error) {
    logger.error('Field decryption failed', {
      entityId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Decryption failed - data may be corrupted or key may have changed');
  }
}

// =============================================================================
// JSON Encryption
// =============================================================================

/**
 * Encrypt a JSON object
 * @param data - The object to encrypt
 * @param entityId - Entity identifier
 * @returns Encrypted string
 */
export function encryptJSON<T extends Record<string, unknown>>(data: T, entityId: string): string {
  const plaintext = JSON.stringify(data);
  const encrypted = encryptField(plaintext, entityId);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt a JSON object
 * @param encryptedString - The encrypted string
 * @param entityId - Entity identifier
 * @returns Decrypted object
 */
export function decryptJSON<T extends Record<string, unknown>>(encryptedString: string, entityId: string): T {
  const encrypted: EncryptedField = JSON.parse(encryptedString);
  const plaintext = decryptField(encrypted, entityId);
  return JSON.parse(plaintext);
}

// =============================================================================
// Selective Field Encryption
// =============================================================================

interface FieldEncryptionConfig {
  fields: string[];
  entityIdField: string;
}

/**
 * Encrypt specified fields in an object
 * @param data - The data object
 * @param config - Encryption configuration
 * @returns Object with encrypted fields
 */
export function encryptFields<T extends Record<string, unknown>>(
  data: T,
  config: FieldEncryptionConfig
): T {
  const result = { ...data };
  const entityId = data[config.entityIdField] as string;
  
  if (!entityId) {
    throw new Error(`Entity ID field '${config.entityIdField}' not found in data`);
  }
  
  for (const field of config.fields) {
    if (data[field] !== undefined && data[field] !== null) {
      const encrypted = encryptField(String(data[field]), entityId);
      (result as Record<string, unknown>)[field] = JSON.stringify(encrypted);
    }
  }
  
  return result;
}

/**
 * Decrypt specified fields in an object
 * @param data - The data object with encrypted fields
 * @param config - Encryption configuration
 * @returns Object with decrypted fields
 */
export function decryptFields<T extends Record<string, unknown>>(
  data: T,
  config: FieldEncryptionConfig
): T {
  const result = { ...data };
  const entityId = data[config.entityIdField] as string;
  
  if (!entityId) {
    throw new Error(`Entity ID field '${config.entityIdField}' not found in data`);
  }
  
  for (const field of config.fields) {
    const value = data[field];
    if (value !== undefined && value !== null && typeof value === 'string') {
      try {
        const encrypted: EncryptedField = JSON.parse(value);
        // Check if it's actually an encrypted field
        if (encrypted.ciphertext && encrypted.iv && encrypted.authTag) {
          (result as Record<string, unknown>)[field] = decryptField(encrypted, entityId);
        }
      } catch {
        // Not an encrypted field, keep original value
      }
    }
  }
  
  return result;
}

// =============================================================================
// Prisma Middleware
// =============================================================================

/**
 * Create a Prisma middleware for automatic field encryption/decryption
 * @param config - Field encryption configurations by model
 * @returns Prisma middleware function
 */
export function createEncryptionMiddleware(
  config: Record<string, FieldEncryptionConfig>
) {
  return async function encryptionMiddleware(
    params: {
      model?: string;
      action: string;
      args: Record<string, unknown>;
    },
    next: (params: Record<string, unknown>) => Promise<unknown>
  ): Promise<unknown> {
    const modelConfig = params.model ? config[params.model] : undefined;
    
    if (!modelConfig) {
      return next(params);
    }
    
    // Encrypt fields before create/update
    if (params.action === 'create' || params.action === 'createMany' || 
        params.action === 'update' || params.action === 'updateMany') {
      if (params.args.data) {
        params.args.data = encryptFields(
          params.args.data as Record<string, unknown>,
          modelConfig
        );
      }
    }
    
    // Execute query
    const result = await next(params);
    
    // Decrypt fields in result
    if (result && typeof result === 'object') {
      if (Array.isArray(result)) {
        return result.map(item => 
          typeof item === 'object' ? decryptFields(item as Record<string, unknown>, modelConfig) : item
        );
      }
      return decryptFields(result as Record<string, unknown>, modelConfig);
    }
    
    return result;
  };
}

// =============================================================================
// Key Rotation
// =============================================================================

/**
 * Re-encrypt data with a new key
 * @param encrypted - Current encrypted data
 * @param oldEntityId - Old entity ID (current key)
 * @param newEntityId - New entity ID (new key)
 * @returns Re-encrypted data
 */
export function rotateEncryptionKey(
  encrypted: EncryptedField,
  oldEntityId: string,
  newEntityId: string
): EncryptedField {
  // Decrypt with old key
  const plaintext = decryptField(encrypted, oldEntityId);
  
  // Re-encrypt with new key
  return encryptField(plaintext, newEntityId);
}

// =============================================================================
// Security Utilities
// =============================================================================

/**
 * Check if a value appears to be encrypted
 * @param value - The value to check
 * @returns True if the value appears to be an encrypted field
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  
  try {
    const parsed: EncryptedField = JSON.parse(value);
    return !!(
      parsed.ciphertext &&
      parsed.iv &&
      parsed.authTag &&
      typeof parsed.version === 'number'
    );
  } catch {
    return false;
  }
}

/**
 * Hash a sensitive value (for search/comparison without decryption)
 * Uses HMAC-SHA256 with the entity key
 * @param value - Value to hash
 * @param entityId - Entity identifier
 * @returns Hash string
 */
export function hashForSearch(value: string, entityId: string): string {
  const key = getDataEncryptionKey(entityId);
  const { createHmac } = require('crypto');
  return createHmac('sha256', key).update(value).digest('hex');
}

// =============================================================================
// Audit Logging
// =============================================================================

/**
 * Log encryption/decryption operations for compliance
 */
export async function logEncryptionOperation(
  operation: 'encrypt' | 'decrypt',
  entityId: string,
  fieldName: string,
  userId?: string
): Promise<void> {
  const { logAuditEvent, AuditEvent } = await import('@/lib/audit/audit-logger');
  
  await logAuditEvent({
    event: AuditEvent.ENCRYPTION_OPERATION,
    userId,
    metadata: {
      operation,
      entityId,
      fieldName,
      algorithm: ALGORITHM,
    },
  });
}


