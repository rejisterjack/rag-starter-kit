import crypto from 'crypto';

import { hash, verify } from 'argon2';

import { prisma } from '@/lib/db';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';

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
  prefix: string;
  permissions: Permission[];
  scopes: {
    allowedIps?: string[];
    allowedEndpoints?: string[];
  } | null;
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  isRevoked: boolean;
  createdAt: Date;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
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
 * Generate a new API key
 * Returns the full key (shown once) and stores only the hash
 */
export async function createApiKey(
  workspaceId: string,
  createdByUserId: string,
  input: CreateApiKeyInput
): Promise<{ key: string; apiKey: Awaited<ReturnType<typeof prisma.apiKey.create>> }> {
  // Generate random key
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const key = `${API_KEY_PREFIX}${randomBytes.toString('base64url')}`;
  
  // Create prefix (first 8 chars after prefix)
  const prefix = key.slice(0, API_KEY_PREFIX.length + 8);
  
  // Hash the key for storage (use Argon2 for security)
  const hashedKey = await hash(key, {
    type: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Calculate expiration
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Create API key record
  const apiKey = await prisma.apiKey.create({
    data: {
      name: input.name,
      prefix,
      hashedKey,
      workspaceId,
      createdById: createdByUserId,
      permissions: input.permissions,
      scopes: {
        ...(input.allowedIps && { allowedIps: input.allowedIps }),
        ...(input.allowedEndpoints && { allowedEndpoints: input.allowedEndpoints }),
      },
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

  return { key, apiKey };
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
  const prefix = key.slice(0, API_KEY_PREFIX.length + 8);

  // Find API key by prefix
  const apiKey = await prisma.apiKey.findFirst({
    where: { prefix },
    include: { workspace: true },
  });

  if (!apiKey) {
    // Log suspicious activity
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      metadata: {
        activity: 'invalid_api_key_attempt',
        prefix,
      },
      severity: 'WARNING',
    });
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if revoked
  if (apiKey.isRevoked) {
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      workspaceId: apiKey.workspaceId,
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
  const isValid = await verify(apiKey.hashedKey, key);
  if (!isValid) {
    await logAuditEvent({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      workspaceId: apiKey.workspaceId,
      metadata: {
        activity: 'api_key_hash_mismatch',
        keyId: apiKey.id,
      },
      severity: 'CRITICAL',
    });
    return { valid: false, error: 'Invalid API key' };
  }

  // Check IP restrictions
  const scopes = apiKey.scopes as { allowedIps?: string[] } | null;
  if (scopes?.allowedIps?.length && options?.ipAddress) {
    if (!scopes.allowedIps.includes(options.ipAddress)) {
      await logAuditEvent({
        event: AuditEvent.SUSPICIOUS_ACTIVITY,
        workspaceId: apiKey.workspaceId,
        metadata: {
          activity: 'api_key_ip_rejected',
          keyId: apiKey.id,
          attemptedIp: options.ipAddress,
          allowedIps: scopes.allowedIps,
        },
        severity: 'WARNING',
      });
      return { valid: false, error: 'IP address not allowed' };
    }
  }

  // Check endpoint restrictions
  const endpointScopes = apiKey.scopes as { allowedEndpoints?: string[] } | null;
  if (endpointScopes?.allowedEndpoints?.length && options?.endpoint) {
    const allowed = endpointScopes.allowedEndpoints.some((pattern) => {
      // Support wildcards
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(options.endpoint!);
      }
      return pattern === options.endpoint;
    });

    if (!allowed) {
      return { valid: false, error: 'Endpoint not allowed for this API key' };
    }
  }

  // Check required permissions
  const keyPermissions = apiKey.permissions as Permission[];
  if (options?.requiredPermissions) {
    const hasPermissions = options.requiredPermissions.every((perm) =>
      keyPermissions.includes(perm)
    );

    if (!hasPermissions) {
      return { valid: false, error: 'Insufficient permissions' };
    }
  }

  // Update usage stats
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });

  // Log API key usage
  await logAuditEvent({
    event: AuditEvent.API_KEY_USED,
    workspaceId: apiKey.workspaceId,
    metadata: {
      keyId: apiKey.id,
      endpoint: options?.endpoint,
      ipAddress: options?.ipAddress,
    },
  });

  return {
    valid: true,
    keyId: apiKey.id,
    workspaceId: apiKey.workspaceId,
    permissions: keyPermissions,
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
    if (apiKey.isRevoked) {
      return { success: false, error: 'API key is already revoked' };
    }

    // Revoke the key
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: revokedByUserId,
      },
    });

    // Log revocation
    await logAuditEvent({
      event: AuditEvent.API_KEY_REVOKED,
      userId: revokedByUserId,
      workspaceId: apiKey.workspaceId,
      metadata: { keyId, name: apiKey.name },
    });

    return { success: true };
  } catch (error) {
    console.error('Revoke API key error:', error);
    return { success: false, error: 'Failed to revoke API key' };
  }
}

/**
 * Get API keys for a workspace
 */
export async function getWorkspaceApiKeys(
  workspaceId: string
): Promise<ApiKeyWithWorkspace[]> {
  const keys = await prisma.apiKey.findMany({
    where: {
      workspaceId,
      isRevoked: false,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return keys as ApiKeyWithWorkspace[];
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(
  keyId: string
): Promise<ApiKeyWithWorkspace | null> {
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
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return key as ApiKeyWithWorkspace | null;
}

/**
 * Update API key
 */
export async function updateApiKey(
  keyId: string,
  data: {
    name?: string;
    permissions?: Permission[];
    scopes?: {
      allowedIps?: string[];
      allowedEndpoints?: string[];
    };
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.permissions && { permissions: data.permissions }),
        ...(data.scopes && { scopes: data.scopes }),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Update API key error:', error);
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
        { isRevoked: true, revokedAt: { lt: thirtyDaysAgo } },
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
