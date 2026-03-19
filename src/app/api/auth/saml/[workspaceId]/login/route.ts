/**
 * SAML Login Initiation Endpoint
 * 
 * Initiates the SAML authentication flow by generating a SAML request
 * and redirecting the user to the Identity Provider's login page.
 * 
 * Supports SP-initiated SSO with optional relay state for deep linking.
 */

import { NextRequest, NextResponse } from 'next/server';

import { initiateLogin, getWorkspaceSamlConfig } from '@/lib/auth/saml/provider';
import { SamlError } from '@/lib/auth/saml/config';

export const dynamic = 'force-dynamic';

/**
 * GET handler for SAML login initiation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Get optional parameters
    const email = searchParams.get('email');
    const returnUrl = searchParams.get('returnUrl') || '/chat';
    const relayState = encodeURIComponent(
      JSON.stringify({
        returnUrl,
        email,
        timestamp: Date.now(),
      })
    );

    const baseUrl = getBaseUrl(request);

    // Get and validate SAML configuration
    const config = await getWorkspaceSamlConfig(workspaceId);

    if (!config) {
      return NextResponse.json(
        { error: 'SAML SSO not configured for this workspace' },
        { status: 404 }
      );
    }

    if (!config.active) {
      return NextResponse.json(
        { error: 'SAML SSO is currently disabled' },
        { status: 403 }
      );
    }

    // Validate email domain if provided
    if (email) {
      const domain = email.split('@')[1]?.toLowerCase();
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ssoDomain: true },
      });

      if (workspace?.ssoDomain && domain !== workspace.ssoDomain.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email domain does not match workspace SSO domain' },
          { status: 403 }
        );
      }
    }

    // Initiate SAML login
    const { redirectUrl, requestId } = await initiateLogin(
      config,
      baseUrl,
      relayState
    );

    // Store request ID for validation (in production, use Redis with TTL)
    // This prevents replay attacks
    await storeSamlRequest(requestId, workspaceId);

    // Redirect to IdP
    return NextResponse.redirect(redirectUrl, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('SAML login initiation failed:', error);

    if (error instanceof SamlError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initiate SAML login' },
      { status: 500 }
    );
  }
}

/**
 * Extract base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

/**
 * Store SAML request ID for later validation
 * In production, use Redis with TTL
 */
async function storeSamlRequest(requestId: string, workspaceId: string): Promise<void> {
  // Simple in-memory store - replace with Redis in production
  const store = globalThis as unknown as {
    samlRequests?: Map<string, { workspaceId: string; createdAt: number }>;
  };
  
  if (!store.samlRequests) {
    store.samlRequests = new Map();
  }

  store.samlRequests.set(requestId, {
    workspaceId,
    createdAt: Date.now(),
  });

  // Auto-cleanup after 10 minutes
  setTimeout(() => {
    store.samlRequests?.delete(requestId);
  }, 10 * 60 * 1000);
}

// Import prisma for workspace lookup
import { prisma } from '@/lib/db';
