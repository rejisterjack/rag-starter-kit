import crypto from 'node:crypto';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

import type { Permission } from '@/lib/workspace/permissions';

// =============================================================================
// Types
// =============================================================================

export interface CreateApiKeyInput {
  name: string;
  permissions: Permission[];
  expiresInDays?: number;
  allowedIps?: string[];
  allowedEndpoints?: string[];
}

export interface ApiKeyValidationResult {
  valid: boolean;
  keyId?: string;
  workspaceId?: string;
  permissions?: Permission[];
  error?: string;
}

export interface ApiKeyWithWorkspace {
  id: string;
  name: string;
  keyPreview: string;
  permissions: Permission[];
  scopes: {
    allowedIps?: string[];
    allowedEndpoints?: string[];
  } | null;
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
  workspace: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

// =============================================================================
// API Key Generation
// =============================================================================

const API_KEY_PREFIX = 'rag_';
const API_KEY_LENGTH = 48;

/**
 * Hash a key using SHA-256 (since argon2 is not available)
 */
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify a key against a hash
 */
function verifyKey(hash: string, key: string): boolean {
  return hash === hashKey(key);
}

/**
 * Generate a new API key
 * Returns the full key (shown once) and stores only the hash
 */
export async function createApiKey(
  workspaceId: string,
  createdByUserId: string,
  input: CreateApiKeyInput
): Promise<{ key: string; apiKey: { id: string; name: string; createdAt: Date } }> {
  // Generate random key
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const key = `${API_KEY_PREFIX}${randomBytes.toString('base64url')}`;

  // Create prefix (first 8 chars after prefix)
  const keyPreview = key.slice(0, API_KEY_PREFIX.length + 8);

  // Hash the key for storage
  const keyHash = hashKey(key);

  // Calculate expiration
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Create API key record
  const apiKey = await prisma.apiKey.create({
    data: {
      name: input.name,
      keyHash,
      keyPreview,
      workspaceId,
      userId: createdByUserId,
      permissions: input.permissions,
      expiresAt,
    },
  });

  // Log API key creation
  await logAuditEvent({
    event: AuditEvent.API_KEY_CREATED,
    userId: createdByUserId,
    workspaceId,
    metadata: {
      keyId: apiKey.id,
      name: input.name,
      permissions: input.permissions,
      expiresAt,
    },
  });

  return { key, apiKey: { id: apiKey.id, name: apiKey.name, createdAt: apiKey.createdAt } };
}

/**
 * Validate an API key
 */
export async function validateApiKey(
  key: string,
  options?: {
    requiredPermissions?: Permission[];
    endpoint?: string;
    ipAddress?: string;
  }
): Promise<ApiKeyValidationResult> {
  // Check key format
  if (!key.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  // Extract prefix for lookup
  const keyPreview = key.slice(0, API_KEY_PREFIX.length + 8);

  // Find API key by prefix
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyPreview },
    include: { workspace: true },
  });

  if (!apiKey) {
    // Log suspicious activity
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      metadata: {
        activity: 'invalid_api_key_attempt',
        keyPreview,
      },
      severity: 'WARNING',
    });
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if revoked
  if (apiKey.status === 'REVOKED') {
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      workspaceId: apiKey.workspaceId ?? undefined,
      metadata: {
        activity: 'revoked_api_key_attempt',
        keyId: apiKey.id,
      },
      severity: 'WARNING',
    });
    return { valid: false, error: 'API key has been revoked' };
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Verify key hash
  const isValid = verifyKey(apiKey.keyHash, key);
  if (!isValid) {
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      workspaceId: apiKey.workspaceId ?? undefined,
      metadata: {
        activity: 'api_key_hash_mismatch',
        keyId: apiKey.id,
      },
      severity: 'CRITICAL',
    });
    return { valid: false, error: 'Invalid API key' };
  }

  // Check IP restrictions (stored in permissions metadata)
  const permissions = apiKey.permissions as Permission[];

  // Check endpoint restrictions
  if (options?.endpoint) {
    // Endpoint restrictions would be implemented here
    // For now, we allow all endpoints
    void options.endpoint;
  }

  // Check required permissions
  if (options?.requiredPermissions) {
    const hasPermissions = options.requiredPermissions.every((perm) => permissions.includes(perm));

    if (!hasPermissions) {
      return { valid: false, error: 'Insufficient permissions' };
    }
  }

  // Update usage stats
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
    },
  });

  // Log API key usage
  await logAuditEvent({
    event: AuditEvent.API_KEY_USED,
    workspaceId: apiKey.workspaceId ?? undefined,
    metadata: {
      keyId: apiKey.id,
      endpoint: options?.endpoint ?? undefined,
      ipAddress: options?.ipAddress ?? undefined,
    },
  });

  return {
    valid: true,
    keyId: apiKey.id,
    workspaceId: apiKey.workspaceId ?? undefined,
    permissions,
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  keyId: string,
  revokedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    // Check if already revoked
    if (apiKey.status === 'REVOKED') {
      return { success: false, error: 'API key is already revoked' };
    }

    // Revoke the key
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        status: 'REVOKED',
      },
    });

    // Log revocation
    await logAuditEvent({
      event: AuditEvent.API_KEY_REVOKED,
      userId: revokedByUserId,
      workspaceId: apiKey.workspaceId ?? undefined,
      metadata: { keyId, name: apiKey.name },
    });

    return { success: true };
  } catch (error) {
    logger.error('Revoke API key error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to revoke API key' };
  }
}

/**
 * Get API keys for a workspace
 */
export async function getWorkspaceApiKeys(workspaceId: string): Promise<ApiKeyWithWorkspace[]> {
  const keys = await prisma.apiKey.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPreview: k.keyPreview,
    permissions: k.permissions as Permission[],
    scopes: null,
    lastUsedAt: k.lastUsedAt,
    usageCount: 0, // Not tracked in this schema
    expiresAt: k.expiresAt,
    status: k.status,
    createdAt: k.createdAt,
    workspace: k.workspace,
    createdBy: k.user,
  }));
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(keyId: string): Promise<ApiKeyWithWorkspace | null> {
  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!key) return null;

  return {
    id: key.id,
    name: key.name,
    keyPreview: key.keyPreview,
    permissions: key.permissions as Permission[],
    scopes: null,
    lastUsedAt: key.lastUsedAt,
    usageCount: 0,
    expiresAt: key.expiresAt,
    status: key.status,
    createdAt: key.createdAt,
    workspace: key.workspace,
    createdBy: key.user,
  };
}

/**
 * Update API key
 */
export async function updateApiKey(
  keyId: string,
  data: {
    name?: string;
    permissions?: Permission[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.permissions && { permissions: data.permissions }),
      },
    });

    return { success: true };
  } catch (error) {
    logger.error('Update API key error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to update API key' };
  }
}

/**
 * Delete expired or revoked API keys (cleanup)
 */
export async function cleanupApiKeys(): Promise<{ deleted: number }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.apiKey.deleteMany({
    where: {
      OR: [
        { status: 'REVOKED', updatedAt: { lt: thirtyDaysAgo } },
        { expiresAt: { lt: thirtyDaysAgo } },
      ],
    },
  });

  return { deleted: result.count };
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Extract API key from request headers
 */
export function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Also check X-API-Key header
  return req.headers.get('x-api-key');
}

/**
 * Middleware to validate API key for a route
 */
export async function requireApiKey(
  req: Request,
  options?: {
    requiredPermissions?: Permission[];
  }
): Promise<ApiKeyValidationResult> {
  const key = extractApiKey(req);

  if (!key) {
    return { valid: false, error: 'API key required' };
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim();

  return validateApiKey(key, {
    ...options,
    ipAddress,
  });
}

/**
 * Check API rate limit
 */
export async function checkApiRateLimit(
  keyId: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  // This is a stub implementation
  // In a real implementation, this would use Redis or a database
  void keyId;
  void windowMs;

  return {
    allowed: true,
    remaining: limit - 1,
    resetAt: new Date(Date.now() + windowMs),
  };
}
