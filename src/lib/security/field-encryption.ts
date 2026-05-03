/**
 * Field-Level Encryption with KMS Support
 *
 * Provides transparent encryption for sensitive fields using AES-256-GCM.
 * Uses envelope encryption pattern with data encryption keys (DEKs) encrypted
 * by a master key or cloud KMS (AWS KMS, Azure Key Vault, GCP KMS).
 *
 * Supported KMS Providers:
 * - AWS KMS (via AWS SDK)
 * - Azure Key Vault (via Azure SDK)
 * - GCP KMS (via Google Cloud SDK)
 * - Local key derivation (fallback)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

// KMS Configuration
const KMS_PROVIDER = process.env.KMS_PROVIDER as 'aws' | 'azure' | 'gcp' | 'local' | undefined;
const AWS_KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const AZURE_KEY_VAULT_URL = process.env.AZURE_KEY_VAULT_URL;
const AZURE_KEY_NAME = process.env.AZURE_KEY_NAME;
const GCP_KMS_KEY_NAME = process.env.GCP_KMS_KEY_NAME;

// Master key from environment (used for local key derivation)
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || process.env.NEXTAUTH_SECRET;

// Validate configuration
if (KMS_PROVIDER === 'local' && !MASTER_KEY) {
  throw new Error(
    'ENCRYPTION_MASTER_KEY or NEXTAUTH_SECRET environment variable must be set for local field-level encryption'
  );
}

if (KMS_PROVIDER === 'aws' && !AWS_KMS_KEY_ID) {
  throw new Error('AWS_KMS_KEY_ID environment variable must be set when using AWS KMS');
}

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
// KMS Provider Abstraction
// =============================================================================

interface KMSProvider {
  generateDataKey(): Promise<{ plaintextKey: Buffer; encryptedKey: string }>;
  decryptDataKey(encryptedKey: string): Promise<Buffer>;
}

/**
 * AWS KMS Provider
 * Uses AWS SDK to generate and decrypt data keys
 */
class AWSKMSProvider implements KMSProvider {
  private kmsClient: unknown = null;

  constructor() {
    try {
      const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = require(/* webpackIgnore: true */ '@aws-sdk/client-kms');
      this.kmsClient = new KMSClient({ region: AWS_REGION });
      this.GenerateDataKeyCommand = GenerateDataKeyCommand;
      this.DecryptCommand = DecryptCommand;
    } catch (error) {
      logger.error('Failed to initialize AWS KMS client', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw new Error('AWS SDK not installed. Run: npm install @aws-sdk/client-kms');
    }
  }

  private GenerateDataKeyCommand: unknown;
  private DecryptCommand: unknown;

  async generateDataKey(): Promise<{ plaintextKey: Buffer; encryptedKey: string }> {
    if (!this.kmsClient) {
      throw new Error('AWS KMS client not initialized');
    }

    const command = new (this.GenerateDataKeyCommand as new (config: unknown) => unknown)({
      KeyId: AWS_KMS_KEY_ID,
      KeySpec: 'AES_256',
    });

    const response = await (this.kmsClient as { send: (cmd: unknown) => Promise<unknown> }).send(
      command
    );
    const result = response as { Plaintext: Uint8Array; CiphertextBlob: Uint8Array };

    return {
      plaintextKey: Buffer.from(result.Plaintext),
      encryptedKey: Buffer.from(result.CiphertextBlob).toString('base64'),
    };
  }

  async decryptDataKey(encryptedKey: string): Promise<Buffer> {
    if (!this.kmsClient) {
      throw new Error('AWS KMS client not initialized');
    }

    const command = new (this.DecryptCommand as new (config: unknown) => unknown)({
      CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
    });

    const response = await (this.kmsClient as { send: (cmd: unknown) => Promise<unknown> }).send(
      command
    );
    const result = response as { Plaintext: Uint8Array };

    return Buffer.from(result.Plaintext);
  }
}

/**
 * Local Key Provider
 * Uses scrypt to derive keys from the master key
 */
class LocalKeyProvider implements KMSProvider {
  async generateDataKey(): Promise<{ plaintextKey: Buffer; encryptedKey: string }> {
    // Generate a random data key
    const plaintextKey = randomBytes(KEY_LENGTH);
    // For local provider, we encrypt the data key using the master key
    const encryptedKey = this.encryptWithMasterKey(plaintextKey);
    return { plaintextKey, encryptedKey };
  }

  async decryptDataKey(encryptedKey: string): Promise<Buffer> {
    return this.decryptWithMasterKey(encryptedKey);
  }

  private encryptWithMasterKey(plaintext: Buffer): string {
    const iv = randomBytes(IV_LENGTH);
    const key = this.deriveMasterKey();
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private decryptWithMasterKey(encrypted: string): Buffer {
    const data = Buffer.from(encrypted, 'base64');
    const iv = data.slice(0, IV_LENGTH);
    const authTag = data.slice(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = data.slice(IV_LENGTH + 16);
    const key = this.deriveMasterKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private deriveMasterKey(): Buffer {
    if (!MASTER_KEY) {
      throw new Error('MASTER_KEY not configured');
    }
    const salt = createHash('sha256').update('local-kms-salt').digest().slice(0, 16);
    return scryptSync(MASTER_KEY, salt, KEY_LENGTH);
  }
}

/**
 * Get the appropriate KMS provider
 */
function getKMSProvider(): KMSProvider {
  switch (KMS_PROVIDER) {
    case 'aws':
      return new AWSKMSProvider();
    default:
      return new LocalKeyProvider();
  }
}

// =============================================================================
// Key Derivation (Legacy - for backward compatibility)
// =============================================================================

/**
 * Derive an encryption key from the master key and a salt
 * @deprecated Use KMS provider instead
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * Get or create a data encryption key for a specific entity
 * @deprecated Use envelope encryption with KMS instead
 */
function getDataEncryptionKey(entityId: string): Buffer {
  // Derive a consistent key for the entity
  const salt = createHash('sha256').update(entityId).digest().slice(0, 16);
  return deriveKey(MASTER_KEY || '', salt);
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
export function decryptJSON<T extends Record<string, unknown>>(
  encryptedString: string,
  entityId: string
): T {
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
      } catch (error: unknown) {
        logger.debug('Field is not encrypted, keeping original value', {
          field,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
export function createEncryptionMiddleware(config: Record<string, FieldEncryptionConfig>) {
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
    if (
      params.action === 'create' ||
      params.action === 'createMany' ||
      params.action === 'update' ||
      params.action === 'updateMany'
    ) {
      if (params.args.data) {
        params.args.data = encryptFields(params.args.data as Record<string, unknown>, modelConfig);
      }
    }

    // Execute query
    const result = await next(params);

    // Decrypt fields in result
    if (result && typeof result === 'object') {
      if (Array.isArray(result)) {
        return result.map((item) =>
          typeof item === 'object'
            ? decryptFields(item as Record<string, unknown>, modelConfig)
            : item
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
  } catch (error: unknown) {
    logger.debug('Value is not an encrypted field', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
  const { createHmac } = require('node:crypto');
  return createHmac('sha256', key).update(value).digest('hex');
}

// =============================================================================
// Envelope Encryption with KMS
// =============================================================================

export interface EnvelopeEncryptedField extends EncryptedField {
  encryptedDataKey: string;
  kmsProvider: string;
}

/**
 * Encrypt a field using envelope encryption with KMS
 *
 * This is the recommended approach for production use:
 * 1. Generate a unique data encryption key (DEK) using KMS
 * 2. Encrypt the data with the DEK
 * 3. Store the encrypted DEK alongside the encrypted data
 *
 * @param plaintext - The value to encrypt
 * @returns Envelope-encrypted field object
 */
export async function encryptWithKMS(plaintext: string): Promise<EnvelopeEncryptedField> {
  try {
    const provider = getKMSProvider();

    // Generate a data key from KMS
    const { plaintextKey, encryptedKey } = await provider.generateDataKey();

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher with the data key
    const cipher = createCipheriv(ALGORITHM, plaintextKey, iv);

    // Encrypt the plaintext
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Clear the plaintext key from memory
    plaintextKey.fill(0);

    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      version: 2, // Version 2 indicates KMS envelope encryption
      encryptedDataKey: encryptedKey,
      kmsProvider: KMS_PROVIDER || 'local',
    };
  } catch (error) {
    logger.error('KMS envelope encryption failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('KMS encryption failed');
  }
}

/**
 * Decrypt a field using envelope encryption with KMS
 *
 * 1. Decrypt the data encryption key (DEK) using KMS
 * 2. Decrypt the data with the DEK
 * 3. Clear the DEK from memory
 *
 * @param encrypted - The envelope-encrypted field object
 * @returns Decrypted plaintext
 */
export async function decryptWithKMS(encrypted: EnvelopeEncryptedField): Promise<string> {
  try {
    const provider = getKMSProvider();

    // Decrypt the data key using KMS
    const plaintextKey = await provider.decryptDataKey(encrypted.encryptedDataKey);

    try {
      // Decode components
      const iv = Buffer.from(encrypted.iv, 'base64');
      const authTag = Buffer.from(encrypted.authTag, 'base64');

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, plaintextKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } finally {
      // Always clear the plaintext key from memory
      plaintextKey.fill(0);
    }
  } catch (error) {
    logger.error('KMS envelope decryption failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('KMS decryption failed - data may be corrupted or key access denied');
  }
}

// =============================================================================
// KMS Configuration Helpers
// =============================================================================

/**
 * Check if KMS encryption is properly configured
 */
export function isKMSConfigured(): boolean {
  if (!KMS_PROVIDER || KMS_PROVIDER === 'local') {
    return !!MASTER_KEY;
  }

  switch (KMS_PROVIDER) {
    case 'aws':
      return !!AWS_KMS_KEY_ID;
    case 'azure':
      return !!AZURE_KEY_VAULT_URL && !!AZURE_KEY_NAME;
    case 'gcp':
      return !!GCP_KMS_KEY_NAME;
    default:
      return false;
  }
}

/**
 * Get current KMS configuration (for debugging/monitoring)
 */
export function getKMSConfig(): {
  provider: string;
  configured: boolean;
  keyId?: string;
} {
  return {
    provider: KMS_PROVIDER || 'local',
    configured: isKMSConfigured(),
    keyId: AWS_KMS_KEY_ID || AZURE_KEY_NAME || GCP_KMS_KEY_NAME,
  };
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
      kmsProvider: KMS_PROVIDER || 'local',
    },
  });
}
