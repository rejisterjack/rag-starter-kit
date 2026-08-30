import { apiError, apiSuccess } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth';
import { APP_URL } from '@/lib/constants';
import { prisma } from '@/lib/db';

// =============================================================================
// GET /api/admin/sso/connections
// Get all SAML connections with workspace info
// =============================================================================

export async function GET(): Promise<Response> {
  try {
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

    return apiSuccess({ connections });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to fetch SSO connections', 500);
  }
}

// =============================================================================
// POST /api/admin/sso/connections
// Create a new SAML connection
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
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

    if (!workspaceId) {
      return apiError('BAD_REQUEST', 'workspaceId is required', 400);
    }

    const existing = await prisma.samlConnection.findUnique({
      where: { workspaceId },
    });

    if (existing) {
      return apiError('CONFLICT', 'Workspace already has a SAML connection', 409);
    }

    let parsedMetadata: {
      entityId?: string;
      ssoUrl?: string;
      certificate?: string;
    } = {};

    if (idpMetadata) {
      const entityIdMatch = idpMetadata.match(/entityID="([^"]+)"/);
      const ssoUrlMatch = idpMetadata.match(/Location="([^"]+)"/);
      const certMatch = idpMetadata.match(/<X509Certificate>([^<]+)<\/X509Certificate>/);

      parsedMetadata = {
        entityId: entityIdMatch?.[1],
        ssoUrl: ssoUrlMatch?.[1],
        certificate: certMatch?.[1]?.replace(/\s+/g, ''),
      };
    }

    const baseUrl = APP_URL;
    const spAcsUrl = `${baseUrl}/api/auth/saml/${workspaceId}/acs`;

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

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ssoEnabled: true,
      },
    });

    return apiSuccess({ connection }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to create SSO connection', 500);
  }
}
