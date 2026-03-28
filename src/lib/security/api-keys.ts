import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
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
const BCRYPT_ROUNDS = 12; // Higher = more secure but slower

/**
 * Hash a key using bcrypt (secure, slow hash)
 *
 * Uses bcrypt with 12 rounds of salt for secure key storage.
 * Unlike SHA-256, bcrypt is designed to be slow to prevent brute-force attacks.
 */
async function hashKey(key: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(key, salt);
}

/**
 * Verify a key against a hash using bcrypt
 */
async function verifyKey(hash: string, key: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
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

  // Hash the key for storage (async for bcrypt)
  const keyHash = await hashKey(key);

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

  // Verify key hash using bcrypt
  const isValid = await verifyKey(apiKey.keyHash, key);
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

  // Get permissions
  const permissions = apiKey.permissions as Permission[];

  // Check IP restrictions (if implemented in the future)
  // IP restriction checks would go here when the feature is implemented
  // For now, we skip this check since scopes field doesn't exist in the schema
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void options?.ipAddress;

  // Placeholder for IP check - always passes for now
  // IP restriction checks would go here when implemented
  // For now, we skip this check since scopes field doesn't exist in the schema

  // Check endpoint restrictions (placeholder - feature not yet implemented)
  // Endpoint restriction checks would go here when the scopes feature is implemented
  // For now, we skip this check

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
 * In-memory rate limit store for API keys
 * Note: In a multi-instance deployment, use Redis instead
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check API rate limit
 * Uses in-memory store with database fallback tracking
 */
export async function checkApiRateLimit(
  keyId: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = new Date(now + windowMs);

  try {
    // Try in-memory rate limiting first (fast path)
    const cacheKey = `ratelimit:${keyId}`;
    const cached = rateLimitStore.get(cacheKey);

    if (cached && cached.resetAt > now) {
      // Window still active
      if (cached.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: new Date(cached.resetAt) };
      }
      cached.count++;
      return { allowed: true, remaining: limit - cached.count, resetAt: new Date(cached.resetAt) };
    }

    // New window or expired - use database for accurate count
    const recentRequests = await prisma.apiUsage.count({
      where: {
        apiKeyId: keyId,
        createdAt: { gte: new Date(windowStart) },
      },
    });

    if (recentRequests >= limit) {
      // Update cache to prevent repeated DB queries
      rateLimitStore.set(cacheKey, { count: recentRequests, resetAt: now + windowMs });
      return { allowed: false, remaining: 0, resetAt };
    }

    // Set new window in cache
    rateLimitStore.set(cacheKey, { count: recentRequests + 1, resetAt: now + windowMs });

    return { allowed: true, remaining: limit - recentRequests - 1, resetAt };
  } catch (error) {
    logger.error('Rate limit check failed', {
      keyId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    // Fail open to avoid blocking legitimate requests on DB errors
    return { allowed: true, remaining: 1, resetAt };
  }
}
