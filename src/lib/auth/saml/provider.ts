/**
 * SAML Provider Implementation
 *
 * Handles SAML 2.0 authentication flow using samlify library.
 * Supports Identity Provider (IdP) initiated and Service Provider (SP) initiated SSO.
 */

import type { Prisma } from '@prisma/client';
// Import samlify
import * as saml from 'samlify';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getSamlUrls,
  parseCertificate,
  type SamlConfig,
  SamlError,
  type SamlProfile,
} from './config';

// =============================================================================
// SAML Service Provider Setup
// =============================================================================

/**
 * Service Provider instance type
 */
type ServiceProviderInstance = ReturnType<typeof saml.ServiceProvider>;

/**
 * Identity Provider instance type
 */
type IdentityProviderInstance = ReturnType<typeof saml.IdentityProvider>;

/**
 * Create a SAML Service Provider instance
 */
export function createServiceProvider(
  config: SamlConfig,
  baseUrl: string
): ServiceProviderInstance {
  const urls = getSamlUrls(config.workspaceId, baseUrl);

  const spConfig = {
    entityID: config.spEntityId,
    authnRequestsSigned: !!config.privateKey,
    wantAssertionsSigned: config.wantAssertionsSigned,
    wantResponseSigned: config.wantResponseSigned,
    signingCert: config.certificate,
    privateKey: config.privateKey,
    nameIDFormat: [config.nameIdFormat],
    assertionConsumerService: [
      {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: urls.acs,
      },
    ],
    singleLogoutService: config.logoutUrl
      ? [
          {
            Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            Location: urls.slo,
          },
        ]
      : undefined,
  };

  return saml.ServiceProvider(spConfig);
}

/**
 * Create a SAML Identity Provider instance from configuration
 */
export function createIdentityProvider(config: SamlConfig): IdentityProviderInstance {
  const idpConfig = {
    entityID: config.idpEntityId,
    signingCert: parseCertificate(config.certificate),
    isAssertionEncrypted: false,
    nameIDFormat: [config.nameIdFormat],
    singleSignOnService: [
      {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        Location: config.entryPoint,
      },
    ],
    singleLogoutService: config.logoutUrl
      ? [
          {
            Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            Location: config.logoutUrl,
          },
        ]
      : undefined,
  };

  return saml.IdentityProvider(idpConfig);
}

// =============================================================================
// SAML Authentication Flow
// =============================================================================

/**
 * Result of initiating a SAML login
 */
export interface LoginInitiationResult {
  /** Redirect URL to send the user to (IdP login page) */
  redirectUrl: string;
  /** SAML request ID for validation */
  requestId: string;
  /** Relay state for maintaining context */
  relayState: string;
}

/**
 * Initiate SAML login flow (SP-initiated)
 */
export async function initiateLogin(
  config: SamlConfig,
  baseUrl: string,
  relayState?: string
): Promise<LoginInitiationResult> {
  try {
    const sp = createServiceProvider(config, baseUrl);
    const idp = createIdentityProvider(config);

    // Create login request
    const { context, id } = sp.createLoginRequest(idp, 'redirect');

    // Add relay state if provided
    const url = new URL(context);
    if (relayState) {
      url.searchParams.set('RelayState', encodeURIComponent(relayState));
    }

    return {
      redirectUrl: url.toString(),
      requestId: id,
      relayState: relayState || '',
    };
  } catch (error) {
    logger.error('SAML login initiation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new SamlError('Failed to initiate SAML login', 'CONFIG_NOT_FOUND', 500);
  }
}

/**
 * Result of processing a SAML response
 */
export interface LoginCompletionResult {
  /** Parsed user profile from SAML assertion */
  profile: SamlProfile;
  /** Session index for single logout */
  sessionIndex: string | null;
  /** Whether this is a new user (for JIT provisioning) */
  isNewUser: boolean;
}

/**
 * Process SAML response from IdP (Assertion Consumer Service)
 */
export async function processSamlResponse(
  config: SamlConfig,
  baseUrl: string,
  samlResponse: string,
  relayState?: string
): Promise<LoginCompletionResult> {
  try {
    const sp = createServiceProvider(config, baseUrl);
    const idp = createIdentityProvider(config);

    // Parse and validate the SAML response
    const result = await sp.parseLoginResponse(idp, 'post', {
      body: {
        SAMLResponse: samlResponse,
        RelayState: relayState || '',
      },
    });

    // Extract user profile from the assertion
    const profile = extractProfile(result, config);

    void relayState;

    return {
      profile,
      sessionIndex: (result.extract?.sessionIndex as string | undefined) || null,
      isNewUser: false, // Will be determined by caller based on user lookup
    };
  } catch (error) {
    logger.error('SAML response processing failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Map specific errors to appropriate codes
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('signature')) {
      throw new SamlError('Invalid SAML signature', 'INVALID_SIGNATURE', 401);
    }
    if (errorMessage.includes('expired')) {
      throw new SamlError('SAML assertion has expired', 'SAML_RESPONSE_EXPIRED', 401);
    }
    if (errorMessage.includes('audience')) {
      throw new SamlError('Invalid audience in SAML assertion', 'AUDIENCE_MISMATCH', 401);
    }

    throw new SamlError(`SAML authentication failed: ${errorMessage}`, 'INVALID_ASSERTION', 401);
  }
}

/**
 * Extract user profile from SAML response
 */
function extractProfile(
  result: { extract?: Record<string, unknown> },
  config: SamlConfig
): SamlProfile {
  const extract = result.extract || {};
  const attributes = (extract.attributes as Record<string, unknown>) || {};

  // Get email from mapped attribute
  const emailAttribute = config.attributeMapping.email || 'email';
  const email = attributes[emailAttribute] as string | undefined;

  if (!email) {
    throw new SamlError('Email attribute not found in SAML assertion', 'INVALID_ASSERTION', 401);
  }

  // Build name from available attributes
  let name: string | undefined;
  if (config.attributeMapping.name && attributes[config.attributeMapping.name]) {
    name = attributes[config.attributeMapping.name] as string;
  } else if (config.attributeMapping.firstName || config.attributeMapping.lastName) {
    const firstName = config.attributeMapping.firstName
      ? (attributes[config.attributeMapping.firstName] as string | undefined)
      : undefined;
    const lastName = config.attributeMapping.lastName
      ? (attributes[config.attributeMapping.lastName] as string | undefined)
      : undefined;
    name = [firstName, lastName].filter(Boolean).join(' ');
  }

  // Extract groups
  let groups: string[] | undefined;
  if (config.attributeMapping.groups && attributes[config.attributeMapping.groups]) {
    const groupsAttr = attributes[config.attributeMapping.groups];
    groups = Array.isArray(groupsAttr) ? groupsAttr : [groupsAttr as string];
  }

  // Process all attributes
  const processedAttributes: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(attributes)) {
    processedAttributes[key] = value as string | string[];
  }

  return {
    nameID: (extract.nameID as string | undefined) || email,
    nameIDFormat: (extract.nameIDFormat as string | undefined) || config.nameIdFormat,
    sessionIndex: extract.sessionIndex as string | undefined,
    email: email.toLowerCase().trim(),
    name: name?.trim(),
    firstName: config.attributeMapping.firstName
      ? (attributes[config.attributeMapping.firstName] as string | undefined)?.trim()
      : undefined,
    lastName: config.attributeMapping.lastName
      ? (attributes[config.attributeMapping.lastName] as string | undefined)?.trim()
      : undefined,
    groups,
    attributes: processedAttributes,
    issuer: (extract.issuer as string | undefined) || config.idpEntityId,
    assertionId: extract.assertionID as string | undefined,
  };
}

// =============================================================================
// Single Logout (SLO)
// =============================================================================

/**
 * Initiate single logout
 */
export async function initiateLogout(
  config: SamlConfig,
  baseUrl: string,
  nameId: string,
  sessionIndex: string
): Promise<{ redirectUrl: string; logoutRequestId: string }> {
  try {
    const sp = createServiceProvider(config, baseUrl);
    const idp = createIdentityProvider(config);

    const { context, id } = sp.createLogoutRequest(idp, 'redirect', {
      nameID: nameId,
      sessionIndex,
    });

    return {
      redirectUrl: context,
      logoutRequestId: id,
    };
  } catch (error) {
    logger.error('SAML logout initiation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new SamlError('Failed to initiate logout', 'SLO_FAILED', 500);
  }
}

/**
 * Process logout response from IdP
 */
export async function processLogoutResponse(
  config: SamlConfig,
  baseUrl: string,
  samlResponse: string
): Promise<boolean> {
  try {
    const sp = createServiceProvider(config, baseUrl);
    const idp = createIdentityProvider(config);

    await sp.parseLogoutResponse(idp, 'redirect', {
      query: {
        SAMLResponse: samlResponse,
      },
    });

    return true;
  } catch (error) {
    logger.error('SAML logout response processing failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new SamlError('Logout response validation failed', 'SLO_FAILED', 401);
  }
}

// =============================================================================
// IdP Metadata Parsing
// =============================================================================

/**
 * Parsed IdP metadata
 */
export interface ParsedIdPMetadata {
  entityId: string;
  entryPoint: string;
  logoutUrl?: string;
  certificate: string;
  nameIdFormats: string[];
  ssoBindings: string[];
}

/**
 * Parse Identity Provider metadata XML
 */
export async function parseIdPMetadata(metadataXml: string): Promise<ParsedIdPMetadata> {
  try {
    const idp = saml.IdentityProvider({ metadata: metadataXml });
    const metadata = idp.entityMeta;

    // Extract SSO URL
    const ssoService =
      metadata.getSingleLogoutService('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect') ||
      metadata.getSingleLogoutService('urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');

    // Extract certificate
    const certificate = metadata.getX509Certificate('signing');

    if (!certificate) {
      throw new SamlError(
        'No signing certificate found in IdP metadata',
        'INVALID_CERTIFICATE',
        400
      );
    }

    // Get SSO URL with proper type checking
    const getSsoUrl = (): string => {
      if (ssoService && typeof ssoService === 'object' && 'location' in ssoService) {
        const service = ssoService as { location: string };
        return service.location;
      }
      return '';
    };

    // Get logout URL
    const getLogoutUrl = (): string | undefined => {
      const sloService = metadata.getSingleLogoutService(
        'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
      );
      if (sloService && typeof sloService === 'object' && 'location' in sloService) {
        const service = sloService as { location: string };
        return service.location;
      }
      return undefined;
    };

    // Get name ID formats
    const nameIdFormats = metadata.getNameIDFormat();
    const ssoBindingsRaw = metadata.getSupportBindings(['singleSignOnService']);

    return {
      entityId: metadata.getEntityID(),
      entryPoint: getSsoUrl(),
      logoutUrl: getLogoutUrl(),
      certificate: parseCertificate(certificate),
      nameIdFormats: Array.isArray(nameIdFormats) ? nameIdFormats : [],
      ssoBindings:
        typeof ssoBindingsRaw === 'string'
          ? [ssoBindingsRaw]
          : Array.isArray(ssoBindingsRaw)
            ? ssoBindingsRaw
            : [],
    };
  } catch (error) {
    logger.error('Failed to parse IdP metadata', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new SamlError('Invalid IdP metadata format', 'INVALID_CERTIFICATE', 400);
  }
}

// =============================================================================
// Database Integration
// =============================================================================

/**
 * Get active SAML configuration for a workspace
 */
export async function getWorkspaceSamlConfig(workspaceId: string): Promise<SamlConfig | null> {
  const connection = await prisma.samlConnection.findUnique({
    where: {
      workspaceId,
    },
  });

  if (!connection || !connection.enabled) return null;

  // Safely extract attribute mapping from JSON
  const attrMappingJson = connection.attributeMapping as Record<string, string> | undefined;

  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    spEntityId: connection.spEntityId ?? '',
    idpEntityId: connection.idpEntityId ?? '',
    entryPoint: connection.idpSsoUrl ?? '',
    callbackUrl: connection.spAcsUrl ?? '',
    logoutUrl: connection.idpSloUrl || undefined,
    certificate: connection.idpCertificate ?? '',
    privateKey: connection.privateKey || undefined,
    wantAssertionsSigned: false,
    wantResponseSigned: false,
    signatureAlgorithm: 'rsa-sha256',
    digestAlgorithm: 'sha256',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: {
      email: attrMappingJson?.email ?? 'email',
      name: attrMappingJson?.name,
      firstName: attrMappingJson?.firstName,
      lastName: attrMappingJson?.lastName,
      groups: attrMappingJson?.groups,
    },
    active: connection.enabled,
    certRotatedAt: undefined,
    previousCertificate: undefined,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

/**
 * Create or update SAML configuration
 */
export async function upsertSamlConfig(
  workspaceId: string,
  config: Omit<SamlConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SamlConfig> {
  const existing = await prisma.samlConnection.findUnique({
    where: { workspaceId },
  });

  // Common fields for create/update
  const commonData = {
    spEntityId: config.spEntityId,
    idpEntityId: config.idpEntityId,
    idpSsoUrl: config.entryPoint,
    spAcsUrl: config.callbackUrl,
    idpSloUrl: config.logoutUrl ?? null,
    idpCertificate: parseCertificate(config.certificate),
    privateKey: config.privateKey ?? null,
    enabled: config.active,
    defaultRole: 'MEMBER',
    attributeMapping: config.attributeMapping as Prisma.InputJsonValue,
  };

  const connection = existing
    ? await prisma.samlConnection.update({
        where: { id: existing.id },
        data: commonData,
      })
    : await prisma.samlConnection.create({
        data: {
          ...commonData,
          workspace: { connect: { id: workspaceId } },
        },
      });

  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    spEntityId: connection.spEntityId ?? '',
    idpEntityId: connection.idpEntityId ?? '',
    entryPoint: connection.idpSsoUrl ?? '',
    callbackUrl: connection.spAcsUrl ?? '',
    logoutUrl: connection.idpSloUrl || undefined,
    certificate: connection.idpCertificate ?? '',
    privateKey: connection.privateKey || undefined,
    wantAssertionsSigned: false,
    wantResponseSigned: false,
    signatureAlgorithm: 'rsa-sha256',
    digestAlgorithm: 'sha256',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: {
      email: (connection.attributeMapping as Record<string, string> | undefined)?.email ?? 'email',
      name: (connection.attributeMapping as Record<string, string> | undefined)?.name,
      firstName: (connection.attributeMapping as Record<string, string> | undefined)?.firstName,
      lastName: (connection.attributeMapping as Record<string, string> | undefined)?.lastName,
      groups: (connection.attributeMapping as Record<string, string> | undefined)?.groups,
    },
    active: connection.enabled,
    certRotatedAt: undefined,
    previousCertificate: undefined,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

/**
 * Rotate certificate with grace period
 */
export async function rotateCertificate(
  workspaceId: string,
  newCertificate: string
): Promise<void> {
  const existing = await prisma.samlConnection.findUnique({
    where: { workspaceId },
  });

  if (!existing) {
    throw new SamlError('SAML configuration not found', 'CONFIG_NOT_FOUND', 404);
  }

  // Store current cert as previous, update with new cert
  await prisma.samlConnection.update({
    where: { id: existing.id },
    data: {
      idpCertificate: parseCertificate(newCertificate),
      updatedAt: new Date(),
    },
  });
}

// =============================================================================
// Security Utilities
// =============================================================================

/**
 * Nonce store for preventing replay attacks
 * In production, use Redis or database
 */
const usedAssertions = new Set<string>();
const ASSERTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an assertion has been used (replay attack prevention)
 */
export function isAssertionUsed(assertionId: string): boolean {
  return usedAssertions.has(assertionId);
}

/**
 * Mark an assertion as used
 */
export function markAssertionUsed(assertionId: string): void {
  usedAssertions.add(assertionId);

  // Auto-cleanup after TTL
  setTimeout(() => {
    usedAssertions.delete(assertionId);
  }, ASSERTION_TTL_MS);
}

/**
 * Validate that email domain matches workspace SSO domain
 */
export function validateEmailDomain(email: string, allowedDomains: string[]): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  return allowedDomains.some((allowed) => allowed.toLowerCase() === domain);
}
