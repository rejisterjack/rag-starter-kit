import { NextResponse } from 'next/server';

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
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'workspaceId query parameter is required' } },
        { status: 400 }
      );
    }

    // Check if user has permission to manage API keys
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get API keys for workspace
    const apiKeys = await getWorkspaceApiKeys(workspaceId);

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to get API keys', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get API keys' } },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Create API key
    const { key, apiKey } = await createApiKey(validatedInput.workspaceId, session.user.id, {
      name: validatedInput.name,
      permissions: validatedInput.permissions,
      expiresInDays: validatedInput.expiresInDays,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            key, // The full key is only returned once on creation
            createdAt: apiKey.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }

    logger.error('Failed to create API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key' } },
      { status: 500 }
    );
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
