/**
 * SAML Service Provider Metadata Endpoint
 *
 * Returns the SP metadata XML that can be provided to Identity Providers
 * for configuration. This metadata contains the ACS URL, entity ID,
 * and supported bindings.
 *
 * @see SAML 2.0 Metadata Specification
 */

import { type NextRequest, NextResponse } from 'next/server';

import { generateSPMetadata, getSamlUrls, type SPMetadataConfig } from '@/lib/auth/saml/config';
import { getWorkspaceSamlConfig } from '@/lib/auth/saml/provider';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET handler for SP metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const baseUrl = getBaseUrl(request);

    // Get SAML configuration for this workspace
    const config = await getWorkspaceSamlConfig(workspaceId);

    if (!config) {
      return NextResponse.json({ error: 'SAML configuration not found' }, { status: 404 });
    }

    const urls = getSamlUrls(workspaceId, baseUrl);

    // Build SP metadata configuration
    const metadataConfig: SPMetadataConfig = {
      entityId: config.spEntityId,
      assertionConsumerService: {
        url: urls.acs,
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      },
      singleLogoutService: config.logoutUrl
        ? {
            url: urls.slo,
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          }
        : undefined,
      nameIdFormat: config.nameIdFormat,
      wantAssertionsSigned: config.wantAssertionsSigned,
      wantResponseSigned: config.wantResponseSigned,
      x509Certificate: config.certificate,
      organization: {
        name: 'RAG Starter Kit',
        displayName: 'RAG Starter Kit',
        url: baseUrl,
      },
      contactPerson: {
        technical: {
          email: 'admin@example.com',
        },
        support: {
          email: 'support@example.com',
        },
      },
    };

    // Generate metadata XML
    const metadataXml = generateSPMetadata(metadataConfig);

    // Return as XML with appropriate headers
    return new Response(metadataXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to generate SAML SP metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate metadata' }, { status: 500 });
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
