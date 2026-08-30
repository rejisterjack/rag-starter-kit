import { apiError, apiSuccess } from '@/lib/api-response';

import { withApiAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { type CreateApiKeyInput, createApiKey, getWorkspaceApiKeys } from '@/lib/security/api-keys';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

/**
 * GET /api/api-keys?workspaceId=xxx
 * Get all API keys for a workspace
 */
export const GET = withApiAuth(async (req, session) => {
  try {
    // Get workspaceId from query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return apiError('BAD_REQUEST', 'workspaceId query parameter is required', 400);
    }

    // Check if user has permission to manage API keys
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Get API keys for workspace
    const apiKeys = await getWorkspaceApiKeys(workspaceId);

    return apiSuccess({
      apiKeys: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPreview: key.keyPreview,
        permissions: key.permissions,
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        status: key.status,
        createdAt: key.createdAt.toISOString(),
        createdBy: key.createdBy,
      })),
    });
  } catch (error: unknown) {
    logger.error('Failed to get API keys', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to get API keys', 500);
  }
});

/**
 * POST /api/api-keys
 * Create a new API key
 */
export const POST = withApiAuth(async (req, session) => {
  try {
    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for API key creation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    // Validate input
    const validatedInput = validateCreateApiKeyInput(body);

    // Check if user has permission to manage API keys
    const hasPermission = await checkPermission(
      session.user.id,
      validatedInput.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Create API key
    const { key, apiKey } = await createApiKey(validatedInput.workspaceId, session.user.id, {
      name: validatedInput.name,
      permissions: validatedInput.permissions,
      expiresInDays: validatedInput.expiresInDays,
    });

    return apiSuccess(
      {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key, // The full key is only returned once on creation
          createdAt: apiKey.createdAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return apiError('VALIDATION_ERROR', isDev ? error.message : 'Validation failed', 400);
    }

    logger.error('Failed to create API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to create API key', 500);
  }
});

// =============================================================================
// Validation
// =============================================================================

interface CreateApiKeyRequest extends CreateApiKeyInput {
  workspaceId: string;
}

/**
 * Validate create API key input
 */
function validateCreateApiKeyInput(body: unknown): CreateApiKeyRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const { workspaceId, name, permissions, expiresInDays } = body as Record<string, unknown>;

  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Invalid workspaceId: must be a string');
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid name: must be a non-empty string');
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('Invalid permissions: must be a non-empty array');
  }

  // Validate that all permissions are valid
  const validPermissions = Object.values(Permission);
  const invalidPermissions = permissions.filter(
    (p) => typeof p !== 'string' || !validPermissions.includes(p as Permission)
  );

  if (invalidPermissions.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
  }

  if (expiresInDays !== undefined) {
    if (typeof expiresInDays !== 'number' || expiresInDays < 1 || expiresInDays > 365) {
      throw new Error('Invalid expiresInDays: must be a number between 1 and 365');
    }
  }

  return {
    workspaceId,
    name: name.trim(),
    permissions: permissions as Permission[],
    ...(expiresInDays !== undefined && { expiresInDays }),
  };
}
