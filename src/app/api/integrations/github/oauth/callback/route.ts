/**
 * GitHub OAuth Callback Endpoint
 *
 * GET /api/integrations/github/oauth/callback - Handle OAuth callback
 *
 * Receives the authorization code from GitHub, exchanges it for an access token,
 * and stores the integration in the database.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

function getGitHubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/github/oauth/callback`,
  };
}

// =============================================================================
// GET /api/integrations/github/oauth/callback - OAuth callback
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Handle OAuth errors from GitHub
    if (error) {
      logger.error('GitHub OAuth error from provider', { error });
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing code or state in GitHub OAuth callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Validate state parameter from cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get('github_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      logger.error('Invalid state parameter in GitHub OAuth callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    // Clear the state cookie
    cookieStore.delete('github_oauth_state');

    // Parse state to get user and workspace info
    let stateData: { userId: string; workspaceId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (error: unknown) {
      logger.error('Failed to parse GitHub state parameter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Invalid state format')}`
      );
    }

    const { userId, workspaceId } = stateData;

    // Check if OAuth is configured
    const config = getGitHubOAuthConfig();
    if (!config) {
      logger.error('GitHub OAuth not configured during callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('OAuth not configured')}`
      );
    }

    // Exchange code for access token
    logger.info('Exchanging code for GitHub access token', { userId, workspaceId });

    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error('GitHub token exchange error', { error: tokenData.error });
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      );
    }

    const accessToken = tokenData.access_token;

    // Get the authenticated GitHub user to use as providerAccountId
    const ghUserResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let ghUsername = 'unknown';
    if (ghUserResponse.ok) {
      const ghUser = await ghUserResponse.json();
      ghUsername = ghUser.login || 'unknown';
    }

    // Save integration to database (upsert to handle reconnections)
    await prisma.integrationAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: ghUsername,
        },
      },
      update: {
        accessToken,
        scope: tokenData.scope || GITHUB_SCOPES.join(','),
        updatedAt: new Date(),
      },
      create: {
        provider: 'github',
        providerAccountId: ghUsername,
        accessToken,
        scope: tokenData.scope || GITHUB_SCOPES.join(','),
        userId,
        workspaceId,
      },
    });

    // Log successful connection
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId,
      workspaceId,
      metadata: {
        action: 'github_connected',
        githubUsername: ghUsername,
      },
    });

    logger.info('GitHub integration connected successfully', {
      userId,
      workspaceId,
      githubUsername: ghUsername,
    });

    return NextResponse.redirect(
      `${appUrl}/settings/integrations?success=github_connected&username=${encodeURIComponent(ghUsername)}`
    );
  } catch (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    logger.error('Failed to complete GitHub OAuth flow', { error: errorMessage });

    return NextResponse.redirect(
      `${appUrl}/settings/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
