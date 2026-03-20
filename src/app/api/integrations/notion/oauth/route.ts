/**
 * Notion OAuth Start Endpoint
 *
 * GET /api/integrations/notion/oauth - Start OAuth flow
 *
 * Initiates the OAuth 2.0 flow with Notion by generating an authorization URL
 * and redirecting the user to Notion's consent page.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAuthorizationUrl, type NotionOAuthConfig } from '@/lib/integrations/notion-oauth';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { cookies } from 'next/headers';

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
// GET /api/integrations/notion/oauth - Start OAuth flow
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get workspace ID from query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || session.user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Workspace ID is required' } },
        { status: 400 }
      );
    }

    // Check workspace permission
    const hasAccess = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_WORKSPACE
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if OAuth is configured
    const config = getOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message:
              'Notion OAuth is not configured. Please set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.',
          },
        },
        { status: 503 }
      );
    }

    // Generate state parameter for CSRF protection
    // Include user ID and workspace ID in state to retrieve them in callback
    const stateData = {
      userId: session.user.id,
      workspaceId,
      nonce: crypto.randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Store state in cookie for validation in callback
    const cookieStore = await cookies();
    cookieStore.set('notion_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(config, state);

    logger.info('Starting Notion OAuth flow', {
      userId: session.user.id,
      workspaceId,
    });

    // Redirect to Notion authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error('Failed to start Notion OAuth flow', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}
