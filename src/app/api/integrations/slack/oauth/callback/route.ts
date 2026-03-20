/**
 * Slack OAuth Callback Handler
 *
 * GET /api/integrations/slack/oauth/callback
 * Handles OAuth callback from Slack and stores tokens
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    access_token?: string;
    scope?: string;
  };
  error?: string;
}

/**
 * GET /api/integrations/slack/oauth/callback
 * Handle OAuth callback from Slack
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors from Slack
    if (error) {
      logger.warn('Slack OAuth error', { error });
      return redirectWithError(request, `Slack authorization failed: ${error}`);
    }

    if (!code) {
      return redirectWithError(request, 'Missing authorization code');
    }

    // Validate state parameter from cookie
    const cookieStore = request.cookies;
    const storedState = cookieStore.get('slack_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      logger.warn('Invalid or missing state parameter', {
        hasStoredState: !!storedState,
        hasState: !!state,
        match: storedState === state,
      });
      return redirectWithError(request, 'Invalid or expired state parameter');
    }

    // Extract userId from state
    const userId = extractUserIdFromState(state);
    if (!userId) {
      return redirectWithError(request, 'Invalid state parameter');
    }

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(request, code);

    if (!tokenData.ok || !tokenData.access_token) {
      logger.error('Failed to exchange code for token', {
        error: tokenData.error,
      });
      return redirectWithError(request, tokenData.error || 'Failed to complete OAuth flow');
    }

    // Store the integration account
    const teamId = tokenData.team?.id;
    const teamName = tokenData.team?.name;
    const botUserId = tokenData.bot_user_id;
    const scope = tokenData.scope;

    if (!teamId) {
      return redirectWithError(request, 'Missing team information from Slack');
    }

    // Check if integration already exists
    const existingIntegration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        userId: userId,
      },
    });

    if (existingIntegration) {
      // Update existing integration
      await prisma.integrationAccount.update({
        where: { id: existingIntegration.id },
        data: {
          accessToken: tokenData.access_token,
          providerAccountId: teamId,
          scope: scope ?? null,
        },
      });

      logger.info('Slack integration updated', {
        userId,
        teamId,
        teamName,
      });
    } else {
      // Create new integration
      await prisma.integrationAccount.create({
        data: {
          provider: 'slack',
          providerAccountId: teamId,
          accessToken: tokenData.access_token,
          scope: scope ?? null,
          userId: userId,
        },
      });

      logger.info('Slack integration created', {
        userId,
        teamId,
        teamName,
        botUserId,
      });
    }

    // Redirect to success page
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(`${baseUrl}/settings/integrations?success=slack_connected`);
  } catch (error) {
    logger.error('Error handling Slack OAuth callback', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return redirectWithError(request, 'Internal server error');
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  request: NextRequest,
  code: string
): Promise<SlackOAuthResponse> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Slack OAuth credentials not configured');
  }

  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/integrations/slack/oauth/callback`;

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.statusText}`);
  }

  return (await response.json()) as SlackOAuthResponse;
}

/**
 * Extract userId from state parameter
 */
function extractUserIdFromState(state: string): string | null {
  try {
    const parts = state.split(':');
    if (parts.length >= 2) {
      return parts[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Redirect to settings page with error
 */
function redirectWithError(request: NextRequest, error: string): Response {
  const baseUrl = getBaseUrl(request);
  const params = new URLSearchParams({
    error: encodeURIComponent(error),
  });
  return NextResponse.redirect(`${baseUrl}/settings/integrations?${params.toString()}`);
}

/**
 * Extract base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
