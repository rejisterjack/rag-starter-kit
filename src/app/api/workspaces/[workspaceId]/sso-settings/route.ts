/**
 * Workspace SSO Settings API
 * 
 * Manage workspace-level SSO settings like domain, force SSO,
 * JIT provisioning, and default roles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';
import { WorkspaceSSOSettingsSchema } from '@/lib/auth/saml/config';
import { invalidateDomainCache } from '@/lib/auth/domain-routing';

// =============================================================================
// GET - Retrieve SSO settings
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Get workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Parse settings
    const settings = (workspace.settings as Record<string, unknown>) || {};

    return NextResponse.json({
      ssoEnabled: workspace.ssoEnabled,
      ssoDomains: workspace.ssoDomain ? [workspace.ssoDomain] : [],
      forceSSO: settings.forceSSO === true,
      defaultRole: (settings.defaultSSORole as string) || 'MEMBER',
      jitProvisioning: settings.jitProvisioning !== false,
      requireEmailVerification: settings.requireEmailVerification === true,
      allowAccountLinking: settings.allowAccountLinking !== false,
      sessionDuration: (settings.sessionDuration as number) || 8,
    });
  } catch (error) {
    console.error('Failed to get SSO settings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve SSO settings' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = WorkspaceSSOSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get current workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
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
        return NextResponse.json(
          { error: 'Domain is already claimed by another workspace' },
          { status: 409 }
        );
      }
    }

    // Merge settings
    const currentSettings = (workspace.settings as Record<string, unknown>) || {};
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

    return NextResponse.json({
      success: true,
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
    console.error('Failed to update SSO settings:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update SSO settings' },
      { status: 500 }
    );
  }
}
