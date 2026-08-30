/**
 * Workspace SSO Settings API
 *
 * Manage workspace-level SSO settings like domain, force SSO,
 * JIT provisioning, and default roles.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { invalidateDomainCache } from '@/lib/auth/domain-routing';
import { WorkspaceSSOSettingsSchema } from '@/lib/auth/saml/config';
import { prisma } from '@/lib/db';
import { fromJson } from '@/lib/db/json';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
// =============================================================================
// GET - Retrieve SSO settings
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Permission denied', 403);
    }

    // Get workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return apiError('NOT_FOUND', 'Workspace not found', 404);
    }

    // Parse settings
    const settings = fromJson<Record<string, unknown>>(workspace.settings, {});

    return apiSuccess({
      ssoEnabled: workspace.ssoEnabled,
      ssoDomains: workspace.ssoDomain ? [workspace.ssoDomain] : [],
      forceSSO: settings.forceSSO === true,
      defaultRole: (settings.defaultSSORole as string) || 'MEMBER',
      jitProvisioning: settings.jitProvisioning !== false,
      requireEmailVerification: settings.requireEmailVerification === true,
      allowAccountLinking: settings.allowAccountLinking !== false,
      sessionDuration: (settings.sessionDuration as number) || 8,
    });
  } catch (error: unknown) {
    logger.error('Failed to retrieve SSO settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to retrieve SSO settings', 500);
  }
}

// =============================================================================
// PUT - Update SSO settings
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Permission denied', 403);
    }

    const body = await request.json();

    // Validate request body
    const validationResult = WorkspaceSSOSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validationResult.error.format()
      );
    }

    const data = validationResult.data;

    // Get current workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return apiError('NOT_FOUND', 'Workspace not found', 404);
    }

    // Check if domain is being changed
    const currentDomain = workspace.ssoDomain;
    const newDomain = data.ssoDomains[0] || null;

    if (newDomain && newDomain !== currentDomain) {
      // Check if domain is available
      const existing = await prisma.workspace.findFirst({
        where: {
          ssoDomain: {
            equals: newDomain,
            mode: 'insensitive',
          },
          id: { not: workspaceId },
        },
      });

      if (existing) {
        return apiError('ERROR', 'Domain is already claimed by another workspace', 409);
      }
    }

    // Merge settings
    const currentSettings = fromJson<Record<string, unknown>>(workspace.settings, {});
    const newSettings = {
      ...currentSettings,
      forceSSO: data.forceSSO,
      defaultSSORole: data.defaultRole,
      jitProvisioning: data.jitProvisioning,
      requireEmailVerification: data.requireEmailVerification,
      allowAccountLinking: data.allowAccountLinking,
      sessionDuration: data.sessionDuration,
    };

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ssoEnabled: data.ssoEnabled,
        ssoDomain: newDomain,
        settings: newSettings,
      },
    });

    // Invalidate domain cache
    if (currentDomain) {
      invalidateDomainCache(currentDomain);
    }
    if (newDomain && newDomain !== currentDomain) {
      invalidateDomainCache(newDomain);
    }

    // Log the change
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        setting: 'sso_settings',
        ssoEnabled: data.ssoEnabled,
        ssoDomain: newDomain,
        forceSSO: data.forceSSO,
      },
    });

    return apiSuccess({
      settings: {
        ssoEnabled: data.ssoEnabled,
        ssoDomains: newDomain ? [newDomain] : [],
        forceSSO: data.forceSSO,
        defaultRole: data.defaultRole,
        jitProvisioning: data.jitProvisioning,
        requireEmailVerification: data.requireEmailVerification,
        allowAccountLinking: data.allowAccountLinking,
        sessionDuration: data.sessionDuration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, error.format());
    }

    return apiError('INTERNAL_ERROR', 'Failed to update SSO settings', 500);
  }
}
