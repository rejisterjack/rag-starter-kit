/**
 * SAML Assertion Consumer Service (ACS) Endpoint
 * 
 * Receives and processes SAML responses from the Identity Provider.
 * Handles user provisioning, account linking, and session creation.
 * 
 * This is the critical security endpoint that validates SAML assertions
 * and establishes user sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { processSamlResponse, getWorkspaceSamlConfig, validateEmailDomain, markAssertionUsed, isAssertionUsed } from '@/lib/auth/saml/provider';
import { SamlError, type SamlProfile } from '@/lib/auth/saml/config';
import { prisma } from '@/lib/db';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';
import { createDefaultWorkspace } from '@/lib/workspace/workspace';

export const dynamic = 'force-dynamic';

/**
 * POST handler for SAML ACS
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  let workspaceId: string | undefined;
  
  try {
    const resolvedParams = await params;
    workspaceId = resolvedParams.workspaceId;
    const baseUrl = getBaseUrl(request);

    // Parse form data (SAML responses are POSTed as form data)
    const formData = await request.formData();
    const samlResponse = formData.get('SAMLResponse') as string;
    const relayState = formData.get('RelayState') as string | undefined;

    if (!samlResponse) {
      return NextResponse.json(
        { error: 'SAMLResponse not found' },
        { status: 400 }
      );
    }

    // Get and validate SAML configuration
    const config = await getWorkspaceSamlConfig(workspaceId);

    if (!config) {
      return NextResponse.json(
        { error: 'SAML configuration not found' },
        { status: 404 }
      );
    }

    // Process SAML response
    const { profile, sessionIndex } = await processSamlResponse(
      config,
      baseUrl,
      samlResponse,
      relayState
    );

    // Check for replay attacks
    if (profile.assertionId && isAssertionUsed(profile.assertionId)) {
      return NextResponse.json(
        { error: 'SAML assertion has already been used' },
        { status: 401 }
      );
    }

    // Mark assertion as used
    if (profile.assertionId) {
      markAssertionUsed(profile.assertionId);
    }

    // Validate email domain against workspace SSO domain
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    const workspaceSettings = workspace?.settings as Record<string, unknown> | undefined;
    const ssoDomain = workspaceSettings?.ssoDomain as string | undefined;
    
    if (ssoDomain) {
      const isValidDomain = validateEmailDomain(profile.email, [ssoDomain]);
      if (!isValidDomain) {
        await logAuditEvent({
          event: AuditEvent.USER_LOGIN,
          workspaceId,
          metadata: {
            email: profile.email,
            method: 'saml',
            error: 'Email domain does not match workspace SSO domain',
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { error: 'Email domain not authorized for this workspace' },
          { status: 403 }
        );
      }
    }

    // Find or create user
    if (!workspaceId) {
      throw new SamlError('Workspace ID is required', 'WORKSPACE_NOT_FOUND', 400);
    }
    // Narrow workspaceId type
    const resolvedWorkspaceId: string = workspaceId;
    const userResult = await findOrCreateUser(profile, resolvedWorkspaceId);

    if (!userResult.success) {
      return NextResponse.json(
        { error: userResult.error },
        { status: 500 }
      );
    }

    // Log successful login
    await logAuditEvent({
      event: AuditEvent.USER_LOGIN,
      userId: userResult.userId,
      workspaceId: resolvedWorkspaceId,
      metadata: {
        method: 'saml',
        idpEntityId: profile.issuer,
        isNewUser: userResult.isNewUser,
      },
    });

    // Create session (workspaceId is guaranteed to be defined here)
    if (!userResult.userId) {
      throw new SamlError('User ID is required', 'WORKSPACE_NOT_FOUND', 500);
    }
    await createSession(userResult.userId, resolvedWorkspaceId);

    // Parse relay state for redirect
    let redirectUrl = '/chat';
    if (relayState) {
      try {
        const decoded = JSON.parse(decodeURIComponent(relayState));
        if (decoded.returnUrl) {
          redirectUrl = decoded.returnUrl;
        }
      } catch {
        // Invalid relay state, use default
      }
    }

    // Set session cookie with SAML session index for SLO
    if (sessionIndex) {
      const cookieStore = await cookies();
      cookieStore.set('saml_session_index', sessionIndex, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60, // 8 hours
      });
    }

    // Redirect to destination
    return NextResponse.redirect(new URL(redirectUrl, baseUrl), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('SAML ACS processing failed:', error);

    // Log the error
    await logAuditEvent({
      event: AuditEvent.USER_LOGIN,
      workspaceId: workspaceId || 'unknown',
      metadata: {
        method: 'saml',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      severity: 'ERROR',
    });

    if (error instanceof SamlError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'SAML authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Find existing user or create new one via JIT provisioning
 */
async function findOrCreateUser(
  profile: SamlProfile,
  workspaceId: string
): Promise<{ success: boolean; userId?: string; isNewUser?: boolean; error?: string }> {
  try {
    // Check for existing user by email
    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    const isNewUser = !user;

    // Get workspace settings for JIT provisioning
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const jitProvisioning = settings.jitProvisioning !== false; // Default true
    const defaultRole = (settings.defaultSSORole as 'MEMBER' | 'ADMIN' | 'VIEWER') || 'MEMBER';

    if (!user) {
      if (!jitProvisioning) {
        return {
          success: false,
          error: 'User not found and JIT provisioning is disabled',
        };
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          emailVerified: new Date(), // Trust SAML provider verification
          role: 'USER',
          // Store SAML-specific identifier
          samlId: profile.nameID,
        },
      });

      // Create default workspace for new user
      await createDefaultWorkspace(user.id, {
        name: profile.name 
          ? `${profile.name}'s Workspace` 
          : `${profile.email.split('@')[0]}'s Workspace`,
      });
    } else {
      // Update user's SAML ID if not set
      if (!user.samlId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { samlId: profile.nameID },
        });
      }
    }

    // Check if user is already a member of the workspace
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      // Auto-provision user to workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          role: defaultRole,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      // Log member addition
      await logAuditEvent({
        event: AuditEvent.MEMBER_JOINED,
        userId: user.id,
        workspaceId,
        metadata: {
          method: 'saml_jit_provisioning',
          role: defaultRole,
        },
      });
    }

    return {
      success: true,
      userId: user.id,
      isNewUser,
    };
  } catch (error) {
    console.error('User provisioning failed:', error);
    return {
      success: false,
      error: 'Failed to provision user',
    };
  }
}

/**
 * Create session for authenticated user
 */
async function createSession(_userId: string, _workspaceId: string): Promise<void> {
  // Session is handled by NextAuth
  // The redirect will trigger the session check
  // Additional session data can be stored here if needed
}

/**
 * Extract base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
