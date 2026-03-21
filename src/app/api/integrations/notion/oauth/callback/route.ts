/**
 * Notion OAuth Callback Endpoint
 *
 * GET /api/integrations/notion/oauth/callback - Handle OAuth callback
 *
 * Receives the authorization code from Notion, exchanges it for an access token,
 * and stores the integration in the database.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import {
  exchangeCodeForToken,
  type NotionOAuthConfig,
  saveNotionIntegration,
} from '@/lib/integrations/notion-oauth';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

function getOAuthConfig(): NotionOAuthConfig | null {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/notion/oauth/callback`,
  };
}

// =============================================================================
// GET /api/integrations/notion/oauth/callback - OAuth callback
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Get app URL for redirects
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Handle OAuth errors from Notion
    if (error) {
      logger.error('Notion OAuth error from provider', { error });
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing code or state in OAuth callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Validate state parameter from cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get('notion_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      logger.error('Invalid state parameter in OAuth callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    // Clear the state cookie
    cookieStore.delete('notion_oauth_state');

    // Parse state to get user and workspace info
    let stateData: { userId: string; workspaceId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      logger.error('Failed to parse state parameter');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('Invalid state format')}`
      );
    }

    const { userId, workspaceId } = stateData;

    // Check if OAuth is configured
    const config = getOAuthConfig();
    if (!config) {
      logger.error('Notion OAuth not configured during callback');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent('OAuth not configured')}`
      );
    }

    // Exchange code for access token
    logger.info('Exchanging code for Notion access token', { userId, workspaceId });
    const tokenData = await exchangeCodeForToken(code, config);

    // Save integration to database
    await saveNotionIntegration(userId, workspaceId, tokenData);

    // Log successful connection
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId,
      workspaceId,
      metadata: {
        action: 'notion_connected',
        notionWorkspaceId: tokenData.workspace_id,
        notionWorkspaceName: tokenData.workspace_name,
      },
    });

    logger.info('Notion integration connected successfully', {
      userId,
      workspaceId,
      notionWorkspaceId: tokenData.workspace_id,
    });

    // Redirect to integrations settings page with success
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?success=notion_connected&workspace=${encodeURIComponent(tokenData.workspace_name)}`
    );
  } catch (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    logger.error('Failed to complete Notion OAuth flow', {
      error: errorMessage,
    });

    return NextResponse.redirect(
      `${appUrl}/settings/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
