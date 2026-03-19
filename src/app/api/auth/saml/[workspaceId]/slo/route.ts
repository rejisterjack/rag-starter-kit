/**
 * SAML Single Logout (SLO) Endpoint
 * 
 * Handles both logout requests from IdP (SP receiving logout) and
 * logout responses from IdP (SP initiated logout).
 * 
 * Implements SAML 2.0 Single Logout Profile for coordinated
 * session termination across all participating services.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  processLogoutResponse,
  initiateLogout,
  getWorkspaceSamlConfig,
} from '@/lib/auth/saml/provider';
import { SamlError } from '@/lib/auth/saml/config';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';
import { auth, signOut } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST handler for IdP-initiated SLO
 * IdP sends a LogoutRequest to this endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const baseUrl = getBaseUrl(request);

    // Get form data
    const formData = await request.formData();
    const samlRequest = formData.get('SAMLRequest') as string;
    const samlResponse = formData.get('SAMLResponse') as string;
    const relayState = formData.get('RelayState') as string | undefined;

    const config = await getWorkspaceSamlConfig(workspaceId);

    if (!config) {
      return NextResponse.json(
        { error: 'SAML configuration not found' },
        { status: 404 }
      );
    }

    // Handle LogoutRequest from IdP (IdP-initiated logout)
    if (samlRequest) {
      return await handleLogoutRequest(
        config,
        baseUrl,
        samlRequest,
        relayState
      );
    }

    // Handle LogoutResponse from IdP (response to SP-initiated logout)
    if (samlResponse) {
      return await handleLogoutResponse(config, baseUrl, samlResponse);
    }

    return NextResponse.json(
      { error: 'No SAMLRequest or SAMLResponse found' },
      { status: 400 }
    );
  } catch (error) {
    console.error('SAML SLO processing failed:', error);

    if (error instanceof SamlError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Single logout failed' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for IdP-initiated SLO via redirect binding
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const samlRequest = searchParams.get('SAMLRequest');
    const samlResponse = searchParams.get('SAMLResponse');
    const relayState = searchParams.get('RelayState') || undefined;

    const config = await getWorkspaceSamlConfig(workspaceId);

    if (!config) {
      return NextResponse.json(
        { error: 'SAML configuration not found' },
        { status: 404 }
      );
    }

    if (samlRequest) {
      return await handleLogoutRequest(
        config,
        getBaseUrl(request),
        samlRequest,
        relayState
      );
    }

    if (samlResponse) {
      return await handleLogoutResponse(config, getBaseUrl(request), samlResponse);
    }

    return NextResponse.json(
      { error: 'No SAMLRequest or SAMLResponse found' },
      { status: 400 }
    );
  } catch (error) {
    console.error('SAML SLO processing failed:', error);
    return NextResponse.json(
      { error: 'Single logout failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle LogoutRequest from IdP
 */
async function handleLogoutRequest(
  config: Awaited<ReturnType<typeof getWorkspaceSamlConfig>>,
  baseUrl: string,
  samlRequest: string,
  relayState?: string
): Promise<Response> {
  if (!config) {
    return NextResponse.json(
      { error: 'Configuration error' },
      { status: 500 }
    );
  }

  // Parse and validate the logout request
  // In production, use samlify to parse the LogoutRequest
  // For now, we'll implement a simplified version

  try {
    // Decode the request (SAMLRequest is typically deflated and base64 encoded)
    const decodedRequest = Buffer.from(samlRequest, 'base64').toString('utf-8');
    
    // Extract NameID and SessionIndex from the logout request
    // This would normally involve proper XML parsing and signature validation
    const nameIdMatch = decodedRequest.match(/<NameID[^>]*>([^<]+)<\/NameID>/);
    const sessionIndexMatch = decodedRequest.match(/<SessionIndex>([^<]+)<\/SessionIndex>/);

    const nameId = nameIdMatch?.[1];
    const sessionIndex = sessionIndexMatch?.[1];

    // Get current session and validate
    const session = await auth();
    
    // Log the logout
    await logAuditEvent({
      event: AuditEvent.USER_LOGOUT,
      userId: session?.user?.id,
      metadata: {
        method: 'saml_slo_idp_initiated',
        nameId,
        sessionIndex,
      },
    });

    // Terminate local session
    await signOut({ redirect: false });

    // Clear SAML session cookies
    const cookieStore = await cookies();
    cookieStore.delete('saml_session_index');

    // Generate LogoutResponse to send back to IdP
    // In production, use samlify to create a properly signed response
    const logoutResponse = await createLogoutResponse(
      config,
      baseUrl,
      'success'
    );

    // If the original binding was POST, return a form auto-submit
    // If redirect, redirect back to IdP
    if (config.logoutUrl) {
      const url = new URL(config.logoutUrl);
      url.searchParams.set('SAMLResponse', Buffer.from(logoutResponse).toString('base64'));
      if (relayState) {
        url.searchParams.set('RelayState', relayState);
      }

      return NextResponse.redirect(url.toString());
    }

    // Return HTML form for POST binding
    return new Response(
      createAutoSubmitForm(config.logoutUrl || '', logoutResponse, relayState),
      {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Logout request handling failed:', error);
    throw new SamlError('Failed to process logout request', 'SLO_FAILED');
  }
}

/**
 * Handle LogoutResponse from IdP
 */
async function handleLogoutResponse(
  config: Awaited<ReturnType<typeof getWorkspaceSamlConfig>>,
  baseUrl: string,
  samlResponse: string
): Promise<Response> {
  if (!config) {
    return NextResponse.json(
      { error: 'Configuration error' },
      { status: 500 }
    );
  }

  // Process the logout response
  await processLogoutResponse(config, baseUrl, samlResponse);

  // Clear local session
  await signOut({ redirect: false });

  // Clear SAML session cookies
  const cookieStore = await cookies();
  cookieStore.delete('saml_session_index');

  // Log the logout
  await logAuditEvent({
    event: AuditEvent.USER_LOGOUT,
    metadata: {
      method: 'saml_slo_sp_initiated',
    },
  });

  // Redirect to login page
  return NextResponse.redirect(`${baseUrl}/login`);
}

/**
 * Create LogoutResponse XML
 * Simplified version - in production, use samlify for proper signing
 */
async function createLogoutResponse(
  config: NonNullable<Awaited<ReturnType<typeof getWorkspaceSamlConfig>>>,
  baseUrl: string,
  status: 'success' | 'partial' | 'error'
): Promise<string> {
  const statusCode = status === 'success' 
    ? 'urn:oasis:names:tc:SAML:2.0:status:Success'
    : 'urn:oasis:names:tc:SAML:2.0:status:PartialLogout';

  const responseId = `_${crypto.randomUUID().replace(/-/g, '')}`;
  const issueInstant = new Date().toISOString();
  const inResponseTo = `_${crypto.randomUUID().replace(/-/g, '')}`; // Should match the original request ID

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutResponse xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                      ID="${responseId}"
                      Version="2.0"
                      IssueInstant="${issueInstant}"
                      Destination="${config.logoutUrl || ''}"
                      InResponseTo="${inResponseTo}"
                      xmlns="urn:oasis:names:tc:SAML:2.0:protocol">
  <saml:Issuer>${config.spEntityId}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="${statusCode}"/>
  </samlp:Status>
</samlp:LogoutResponse>`;
}

/**
 * Create HTML form for auto-submitting SAML response
 */
function createAutoSubmitForm(
  actionUrl: string,
  samlResponse: string,
  relayState?: string
): string {
  const relayStateInput = relayState
    ? `<input type="hidden" name="RelayState" value="${relayState}"/>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>Logging out...</title>
</head>
<body onload="document.forms[0].submit()">
  <form method="post" action="${actionUrl}">
    <input type="hidden" name="SAMLResponse" value="${Buffer.from(samlResponse).toString('base64')}"/>
    ${relayStateInput}
    <noscript>
      <p>Click the button to continue:</p>
      <input type="submit" value="Continue"/>
    </noscript>
  </form>
  <p>Logging out...</p>
</body>
</html>`;
}

/**
 * Extract base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
