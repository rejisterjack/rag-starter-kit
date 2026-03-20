import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getApiKeyById, updateApiKey, revokeApiKey } from '@/lib/security/api-keys';
import { Permission, checkPermission } from '@/lib/workspace/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/api-keys/[id]?workspaceId=xxx
 * Get a single API key by ID
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id: keyId } = await params;

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

    // Get API key
    const apiKey = await getApiKeyById(keyId);

    if (!apiKey || apiKey.workspace?.id !== workspaceId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPreview: apiKey.keyPreview,
          permissions: apiKey.permissions,
          lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
          expiresAt: apiKey.expiresAt?.toISOString() ?? null,
          status: apiKey.status,
          createdAt: apiKey.createdAt.toISOString(),
          createdBy: apiKey.createdBy,
        },
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get API key' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/api-keys/[id]
 * Update an API key (name and/or permissions)
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id: keyId } = await params;

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Validate input
    const validatedInput = validateUpdateApiKeyInput(body);

    // Get the API key first to check workspace
    const existingKey = await getApiKeyById(keyId);

    if (!existingKey) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      );
    }

    if (!existingKey.workspace) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key workspace not found' } },
        { status: 404 }
      );
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      existingKey.workspace.id,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Update API key
    const result = await updateApiKey(keyId, {
      name: validatedInput.name,
      permissions: validatedInput.permissions,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'API key updated successfully' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update API key' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys/[id]
 * Revoke an API key
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id: keyId } = await params;

    // Get the API key first to check workspace
    const existingKey = await getApiKeyById(keyId);

    if (!existingKey) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      );
    }

    if (!existingKey.workspace) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key workspace not found' } },
        { status: 404 }
      );
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      existingKey.workspace.id,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Revoke API key
    const result = await revokeApiKey(keyId, session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'REVOKE_FAILED', message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'API key revoked successfully' },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke API key' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// Validation
// =============================================================================

interface UpdateApiKeyInput {
  name?: string;
  permissions?: Permission[];
}

/**
 * Validate update API key input
 */
function validateUpdateApiKeyInput(body: unknown): UpdateApiKeyInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const { name, permissions } = body as Record<string, unknown>;
  const result: UpdateApiKeyInput = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Invalid name: must be a non-empty string');
    }
    result.name = name.trim();
  }

  if (permissions !== undefined) {
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

    result.permissions = permissions as Permission[];
  }

  if (!result.name && !result.permissions) {
    throw new Error('Invalid input: at least one of name or permissions must be provided');
  }

  return result;
}
