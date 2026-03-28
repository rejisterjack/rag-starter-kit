/**
 * Workspace SAML Configuration API
 *
 * Manage SAML SSO configuration for workspaces.
 * Requires admin or owner permissions.
 *
 * Endpoints:
 * - GET: Get SAML configuration
 * - POST: Create/update SAML configuration
 * - PUT: Update SAML configuration
 * - DELETE: Remove SAML configuration
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import {
  getSamlUrls,
  parseIdPMetadata,
  SamlConfigSchema,
  UpdateSamlConfigSchema,
} from '@/lib/auth/saml/config';
import {
  getWorkspaceSamlConfig,
  rotateCertificate,
  upsertSamlConfig,
} from '@/lib/auth/saml/provider';
import { prisma } from '@/lib/db';
import { assertSafeUrl } from '@/lib/security/ssrf-protection';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// GET - Retrieve SAML configuration
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check permission to view settings
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const config = await getWorkspaceSamlConfig(workspaceId);

    if (!config) {
      return NextResponse.json({ error: 'SAML configuration not found' }, { status: 404 });
    }

    // Return configuration without sensitive data
    return NextResponse.json({
      id: config.id,
      workspaceId: config.workspaceId,
      spEntityId: config.spEntityId,
      idpEntityId: config.idpEntityId,
      entryPoint: config.entryPoint,
      callbackUrl: config.callbackUrl,
      logoutUrl: config.logoutUrl,
      wantAssertionsSigned: config.wantAssertionsSigned,
      wantResponseSigned: config.wantResponseSigned,
      signatureAlgorithm: config.signatureAlgorithm,
      digestAlgorithm: config.digestAlgorithm,
      nameIdFormat: config.nameIdFormat,
      attributeMapping: config.attributeMapping,
      active: config.active,
      certRotatedAt: config.certRotatedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      // Include certificate fingerprint for verification
      certificateFingerprint: generateCertFingerprint(config.certificate),
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to retrieve SAML configuration' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create or update SAML configuration
// =============================================================================

const CreateSamlConfigSchema = SamlConfigSchema.extend({
  // Allow metadata URL for auto-configuration
  metadataUrl: z.string().url().optional(),
  // Allow raw metadata XML
  metadataXml: z.string().optional(),
}).refine(
  (data) => {
    // Require either metadata or manual configuration
    return !!(
      data.metadataUrl ||
      data.metadataXml ||
      (data.idpEntityId && data.entryPoint && data.certificate)
    );
  },
  {
    message:
      'Either metadata URL/XML or manual configuration (entityId, entryPoint, certificate) is required',
  }
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check admin permission
    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();

    // Parse and validate request
    const validationResult = CreateSamlConfigSchema.safeParse({
      ...body,
      workspaceId,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const baseUrl = getBaseUrl(request);
    const urls = getSamlUrls(workspaceId, baseUrl);

    let idpConfig: {
      entityId: string;
      entryPoint: string;
      logoutUrl?: string;
      certificate: string;
    };

    // Handle metadata-based configuration
    if (data.metadataUrl || data.metadataXml) {
      let metadataXml: string;

      if (data.metadataUrl) {
        // Validate URL with SSRF protection before fetching
        await assertSafeUrl(data.metadataUrl);

        // Fetch metadata from URL
        const response = await fetch(data.metadataUrl, {
          headers: { Accept: 'application/xml' },
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch IdP metadata from URL' },
            { status: 400 }
          );
        }

        metadataXml = await response.text();
      } else if (data.metadataXml) {
        metadataXml = data.metadataXml;
      } else {
        return NextResponse.json(
          { error: 'Metadata XML is required when metadata URL is not provided' },
          { status: 400 }
        );
      }

      // Parse metadata
      const parsed = await parseIdPMetadata(metadataXml);
      idpConfig = {
        entityId: parsed.entityId,
        entryPoint: parsed.entryPoint,
        logoutUrl: parsed.logoutUrl,
        certificate: parsed.certificate,
      };
    } else {
      // Manual configuration
      idpConfig = {
        entityId: data.idpEntityId,
        entryPoint: data.entryPoint,
        logoutUrl: data.logoutUrl,
        certificate: data.certificate,
      };
    }

    // Build configuration
    const config = await upsertSamlConfig(workspaceId, {
      workspaceId,
      spEntityId: data.spEntityId || `${baseUrl}/api/auth/saml/${workspaceId}`,
      idpEntityId: idpConfig.entityId,
      entryPoint: idpConfig.entryPoint,
      callbackUrl: urls.acs,
      logoutUrl: idpConfig.logoutUrl,
      certificate: idpConfig.certificate,
      privateKey: data.privateKey,
      wantAssertionsSigned: data.wantAssertionsSigned,
      wantResponseSigned: data.wantResponseSigned,
      signatureAlgorithm: data.signatureAlgorithm,
      digestAlgorithm: data.digestAlgorithm,
      nameIdFormat: data.nameIdFormat,
      attributeMapping: data.attributeMapping,
      active: data.active,
    });

    // Log the configuration change
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        setting: 'saml_configuration',
        action: 'create_or_update',
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        spEntityId: config.spEntityId,
        idpEntityId: config.idpEntityId,
        entryPoint: config.entryPoint,
        callbackUrl: config.callbackUrl,
        active: config.active,
        spMetadataUrl: urls.metadata,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create SAML configuration' }, { status: 500 });
  }
}

// =============================================================================
// PUT - Update SAML configuration
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();

    // Parse and validate request
    const validationResult = UpdateSamlConfigSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if this is a certificate rotation request
    if (data.certificate && !data.entryPoint && !data.idpEntityId) {
      await rotateCertificate(workspaceId, data.certificate);

      await logAuditEvent({
        event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
        userId: session.user.id,
        workspaceId,
        metadata: {
          setting: 'saml_certificate',
          action: 'rotate',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Certificate rotated successfully',
      });
    }

    // Get existing config
    const existing = await getWorkspaceSamlConfig(workspaceId);
    if (!existing) {
      return NextResponse.json(
        { error: 'SAML configuration not found. Use POST to create.' },
        { status: 404 }
      );
    }

    // Merge with existing and update
    const baseUrl = getBaseUrl(request);
    const urls = getSamlUrls(workspaceId, baseUrl);

    const updated = await upsertSamlConfig(workspaceId, {
      ...existing,
      ...data,
      callbackUrl: urls.acs,
      workspaceId,
    });

    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        setting: 'saml_configuration',
        action: 'update',
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: updated.id,
        spEntityId: updated.spEntityId,
        idpEntityId: updated.idpEntityId,
        entryPoint: updated.entryPoint,
        active: updated.active,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update SAML configuration' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Remove SAML configuration
// =============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<Response> {
  try {
    const { workspaceId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasPermission = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete the SAML configuration
    await prisma.samlConnection.deleteMany({
      where: { workspaceId },
    });

    // Disable SSO for workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ssoEnabled: false,
      },
    });

    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        setting: 'saml_configuration',
        action: 'delete',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'SAML configuration removed',
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete SAML configuration' }, { status: 500 });
  }
}

// =============================================================================
// Utilities
// =============================================================================

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

/**
 * Generate certificate fingerprint for display
 */
function generateCertFingerprint(cert: string): string {
  try {
    // Clean the certificate
    const cleanCert = cert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    // Decode base64
    const decoded = Buffer.from(cleanCert, 'base64');

    // Create SHA-256 fingerprint
    const crypto = require('node:crypto');
    const hash = crypto.createHash('sha256');
    hash.update(decoded);

    // Format as colon-separated hex
    return hash.digest('hex').toUpperCase().match(/.{2}/g)?.join(':') || '';
  } catch {
    return '';
  }
}
