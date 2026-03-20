/**
 * Slack OAuth Initiation Endpoint
 *
 * GET /api/integrations/slack/oauth
 * Initiates OAuth 2.0 flow with Slack
 */

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Slack OAuth scopes required for the integration
const SLACK_SCOPES = ['commands', 'chat:write', 'users:read'];

/**
 * GET /api/integrations/slack/oauth
 * Redirect user to Slack OAuth authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      logger.error('SLACK_CLIENT_ID not configured');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Slack integration is not configured',
          },
        },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/api/integrations/slack/oauth/callback`;

    // Generate state parameter for CSRF protection
    const state = generateState(session.user.id);

    // Build Slack OAuth URL
    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', SLACK_SCOPES.join(','));
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    // Store state in cookie for validation in callback
    const response = NextResponse.redirect(authUrl.toString(), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    response.cookies.set('slack_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('Error initiating Slack OAuth flow', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to initiate OAuth flow',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a state parameter for CSRF protection
 */
function generateState(userId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}:${userId}:${random}`;
}

/**
 * Extract base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
