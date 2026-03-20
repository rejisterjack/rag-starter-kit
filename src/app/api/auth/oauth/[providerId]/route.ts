/**
 * OAuth Provider Initiation Endpoint
 *
 * Initiates OAuth 2.0 / OIDC authentication flow.
 * Generates state parameter and redirects to the IdP authorization endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { generateAuthUrl, generateState, getOAuthProviderById } from '@/lib/auth/oauth/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
): Promise<Response> {
  try {
    const { providerId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace');
    const returnUrl = searchParams.get('returnUrl') || '/chat';

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const baseUrl = getBaseUrl(request);

    // Get OAuth provider configuration
    const provider = await getOAuthProviderById(providerId);

    if (!provider) {
      return NextResponse.json({ error: 'OAuth provider not found' }, { status: 404 });
    }

    if (!provider.active) {
      return NextResponse.json({ error: 'OAuth provider is disabled' }, { status: 403 });
    }

    // Validate workspace matches provider
    if (provider.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Provider does not belong to this workspace' },
        { status: 403 }
      );
    }

    // Generate state for CSRF protection
    const state = generateState(workspaceId, providerId);

    // Generate authorization URL
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`;
    const authUrl = generateAuthUrl(provider, redirectUri, state);

    // Add return URL to state (stored separately)
    // const cookieStore = request.cookies; // Available if needed
    const response = NextResponse.redirect(authUrl, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    // Set a cookie with the return URL
    response.cookies.set('oauth_return_url', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 });
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
