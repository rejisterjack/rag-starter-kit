import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

// =============================================================================
// GET /api/admin/sso/connections
// Get all SAML connections with workspace info
// =============================================================================

export async function GET(): Promise<Response> {
  try {
    // Verify admin access
    await requireAdmin();

    const connections = await prisma.samlConnection.findMany({
      include: {
        workspace: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Failed to fetch SSO connections:', error);

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch SSO connections' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/admin/sso/connections
// Create a new SAML connection
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
    // Verify admin access
    await requireAdmin();

    const body = await req.json();
    const {
      workspaceId,
      idpMetadata,
      idpEntityId,
      idpSsoUrl,
      idpCertificate,
      allowIdpInitiated,
      defaultRole,
    } = body;

    // Validate required fields
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Check if workspace already has a SAML connection
    const existing = await prisma.samlConnection.findUnique({
      where: { workspaceId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Workspace already has a SAML connection' },
        { status: 409 }
      );
    }

    // Parse IdP metadata if provided
    let parsedMetadata: {
      entityId?: string;
      ssoUrl?: string;
      certificate?: string;
    } = {};

    if (idpMetadata) {
      // Simple metadata parsing - in production, use a proper SAML library
      const entityIdMatch = idpMetadata.match(/entityID="([^"]+)"/);
      const ssoUrlMatch = idpMetadata.match(/Location="([^"]+)"/);
      const certMatch = idpMetadata.match(/<X509Certificate>([^<]+)<\/X509Certificate>/);

      parsedMetadata = {
        entityId: entityIdMatch?.[1],
        ssoUrl: ssoUrlMatch?.[1],
        certificate: certMatch?.[1]?.replace(/\s+/g, ''),
      };
    }

    // Build the ACS URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const spAcsUrl = `${baseUrl}/api/auth/saml/${workspaceId}/acs`;

    // Create the connection
    const connection = await prisma.samlConnection.create({
      data: {
        workspaceId,
        idpMetadata: idpMetadata || null,
        idpEntityId: idpEntityId || parsedMetadata.entityId || null,
        idpSsoUrl: idpSsoUrl || parsedMetadata.ssoUrl || null,
        idpCertificate: idpCertificate || parsedMetadata.certificate || null,
        spAcsUrl,
        allowIdpInitiated: allowIdpInitiated ?? false,
        defaultRole: defaultRole || 'MEMBER',
        enabled: true,
      },
    });

    // Update workspace SSO settings
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ssoEnabled: true,
      },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error('Failed to create SSO connection:', error);

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create SSO connection' },
      { status: 500 }
    );
  }
}
