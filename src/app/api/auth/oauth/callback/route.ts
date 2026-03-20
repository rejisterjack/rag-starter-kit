/**
 * OAuth Callback Handler
 * 
 * Handles OAuth 2.0 / OIDC callbacks from identity providers.
 * Exchanges authorization code for tokens and provisions/authenticates users.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeCode,
  fetchUserProfile,
  consumeState,
  getOAuthProviderById,
  type OAuthProfile,
} from '@/lib/auth/oauth/providers';
import { prisma } from '@/lib/db';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';
import { createDefaultWorkspace } from '@/lib/workspace/workspace';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return redirectWithError(
        request,
        `OAuth error: ${errorDescription || error}`
      );
    }

    if (!code || !state) {
      return redirectWithError(request, 'Missing authorization code or state');
    }

    // Validate and consume state
    const stateData = consumeState(state);
    if (!stateData) {
      return redirectWithError(request, 'Invalid or expired state');
    }

    const { workspaceId, providerId } = stateData;
    const baseUrl = getBaseUrl(request);

    // Get OAuth provider configuration
    const provider = await getOAuthProviderById(providerId);

    if (!provider) {
      return redirectWithError(request, 'OAuth provider not found');
    }

    if (!provider.active) {
      return redirectWithError(request, 'OAuth provider is disabled');
    }

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`;
    const tokens = await exchangeCode(provider, code, redirectUri);

    // Fetch user profile
    const profile = await fetchUserProfile(provider, tokens.access_token);

    // Validate email domain if workspace has SSO domain configured
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    // Extract SSO domain from workspace settings
    const workspaceSettings = workspace?.settings as { ssoDomain?: string } | null;
    const ssoDomain = workspaceSettings?.ssoDomain;

    if (ssoDomain) {
      const userDomain = profile.email.split('@')[1]?.toLowerCase();
      if (userDomain !== ssoDomain.toLowerCase()) {
        await logAuditEvent({
          event: AuditEvent.USER_LOGIN,
          workspaceId,
          metadata: {
            email: profile.email,
            method: 'oauth',
            provider: provider.provider,
            error: 'Email domain does not match workspace SSO domain',
          },
          severity: 'WARNING',
        });

        return redirectWithError(
          request,
          'Email domain not authorized for this workspace'
        );
      }
    }

    // Find or create user
    const userResult = await findOrCreateUser(profile, workspaceId, provider.provider);

    if (!userResult.success) {
      return redirectWithError(request, userResult.error || 'User provisioning failed');
    }

    // Log successful login
    await logAuditEvent({
      event: AuditEvent.USER_LOGIN,
      userId: userResult.userId,
      workspaceId,
      metadata: {
        method: 'oauth',
        provider: provider.provider,
        isNewUser: userResult.isNewUser,
      },
    });

    // Create session
    await createSession(userResult.userId!, workspaceId);

    // Redirect to app
    return NextResponse.redirect(`${baseUrl}/chat`);
  } catch (error) {
    console.error('OAuth callback failed:', error);
    return redirectWithError(
      request,
      error instanceof Error ? error.message : 'OAuth authentication failed'
    );
  }
}

/**
 * Find existing user or create new one via JIT provisioning
 */
async function findOrCreateUser(
  profile: OAuthProfile,
  workspaceId: string,
  providerType: string
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
          name: profile.name || profile.givenName || profile.email.split('@')[0],
          emailVerified: profile.emailVerified ? new Date() : null,
          role: 'USER',
          image: profile.picture,
        },
      });

      // Create default workspace for new user
      await createDefaultWorkspace(user.id, {
        name: profile.name 
          ? `${profile.name}'s Workspace` 
          : `${profile.email.split('@')[0]}'s Workspace`,
      });
    } else {
      // Update user info if changed
      const updateData: Partial<{
        name: string;
        image: string;
        emailVerified: Date | null;
      }> = {};

      if (profile.name && user.name !== profile.name) {
        updateData.name = profile.name;
      }
      if (profile.picture && user.image !== profile.picture) {
        updateData.image = profile.picture;
      }
      if (profile.emailVerified && !user.emailVerified) {
        updateData.emailVerified = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
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
          method: 'oauth_jit_provisioning',
          provider: providerType,
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
}

/**
 * Redirect to login page with error
 */
function redirectWithError(request: NextRequest, error: string): Response {
  const baseUrl = getBaseUrl(request);
  const params = new URLSearchParams({
    error: encodeURIComponent(error),
  });
  return NextResponse.redirect(`${baseUrl}/login?${params.toString()}`);
}

/**
 * Extract base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
