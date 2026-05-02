/**
 * Google Drive OAuth Callback Endpoint
 *
 * GET /api/integrations/google-drive/oauth/callback - Handle OAuth callback
 *
 * Receives the authorization code from Google, exchanges it for tokens,
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

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/google-drive/oauth/callback`,
  };
}

// =============================================================================
// GET /api/integrations/google-drive/oauth/callback - OAuth callback
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Handle OAuth errors from Google
    if (error) {
      logger.error('Google OAuth error from provider', { error });
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing code or state in Google OAuth callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Validate state parameter from cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get('google_drive_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      logger.error('Invalid state parameter in Google OAuth callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    // Clear the state cookie
    cookieStore.delete('google_drive_oauth_state');

    // Parse state to get user and workspace info
    let stateData: { userId: string; workspaceId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (error: unknown) {
      logger.error('Failed to parse Google Drive state parameter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Invalid state format')}`
      );
    }

    const { userId, workspaceId } = stateData;

    // Check if OAuth is configured
    const config = getGoogleOAuthConfig();
    if (!config) {
      logger.error('Google OAuth not configured during callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('OAuth not configured')}`
      );
    }

    // Exchange code for tokens
    logger.info('Exchanging code for Google access token', { userId, workspaceId });

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${errorBody}`);
    }

    const tokenData = await tokenResponse.json();

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Get the Google user profile for providerAccountId
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let googleUserId = 'unknown';
    let googleEmail = '';
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      googleUserId = profile.id || 'unknown';
      googleEmail = profile.email || '';
    }

    // Save integration to database (upsert to handle reconnections)
    await prisma.integrationAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google-drive',
          providerAccountId: googleUserId,
        },
      },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        scope: tokenData.scope || 'https://www.googleapis.com/auth/drive.readonly',
        updatedAt: new Date(),
      },
      create: {
        provider: 'google-drive',
        providerAccountId: googleUserId,
        accessToken,
        refreshToken,
        expiresAt,
        scope: tokenData.scope || 'https://www.googleapis.com/auth/drive.readonly',
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
        action: 'google_drive_connected',
        googleUserId,
        googleEmail,
      },
    });

    logger.info('Google Drive integration connected successfully', {
      userId,
      workspaceId,
      googleUserId,
    });

    return NextResponse.redirect(
      `${appUrl}/settings/integrations?success=google_drive_connected&email=${encodeURIComponent(googleEmail)}`
    );
  } catch (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    logger.error('Failed to complete Google Drive OAuth flow', { error: errorMessage });

    return NextResponse.redirect(
      `${appUrl}/settings/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
