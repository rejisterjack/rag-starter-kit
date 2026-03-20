/**
 * SAML Configuration Module
 * 
 * Provides types, schemas, and configuration management for SAML 2.0 authentication.
 * Follows SAML 2.0 specification for enterprise Single Sign-On.
 */

import { z } from 'zod';

// =============================================================================
// SAML Configuration Types
// =============================================================================

/**
 * SAML Provider Configuration
 * Represents the complete SAML configuration for a workspace
 */
export interface SamlConfig {
  /** Unique identifier for the SAML connection */
  id: string;
  /** Associated workspace ID */
  workspaceId: string;
  /** Entity ID of the Service Provider (this application) */
  spEntityId: string;
  /** Entity ID of the Identity Provider */
  idpEntityId: string;
  /** SSO URL for the Identity Provider */
  entryPoint: string;
  /** URL for receiving SAML responses (Assertion Consumer Service) */
  callbackUrl: string;
  /** URL for single logout */
  logoutUrl?: string;
  /** X.509 certificate for verifying IdP signatures */
  certificate: string;
  /** Private key for signing SAML requests (optional) */
  privateKey?: string;
  /** Whether to require signed assertions */
  wantAssertionsSigned: boolean;
  /** Whether to require signed responses */
  wantResponseSigned: boolean;
  /** Signature algorithm to use */
  signatureAlgorithm: SignatureAlgorithm;
  /** Digest algorithm to use */
  digestAlgorithm: DigestAlgorithm;
  /** Name ID format expected from IdP */
  nameIdFormat: NameIDFormat;
  /** Attribute mappings for user profile extraction */
  attributeMapping: AttributeMapping;
  /** Whether the configuration is active */
  active: boolean;
  /** Timestamp of last certificate rotation */
  certRotatedAt?: Date;
  /** Previous certificate for graceful rotation */
  previousCertificate?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attribute mapping configuration
 * Maps SAML attributes to user profile fields
 */
export interface AttributeMapping {
  /** Attribute containing the user's email */
  email: string;
  /** Attribute containing the user's display name */
  name?: string;
  /** Attribute containing the user's first name */
  firstName?: string;
  /** Attribute containing the user's last name */
  lastName?: string;
  /** Attribute containing user's groups/roles */
  groups?: string;
  /** Custom attribute mappings */
  [key: string]: string | undefined;
}

/**
 * Supported signature algorithms
 */
export type SignatureAlgorithm =
  | 'rsa-sha256'
  | 'rsa-sha512'
  | 'rsa-sha1'
  | 'ecdsa-sha256'
  | 'eddsa-ed25519';

/**
 * Supported digest algorithms
 */
export type DigestAlgorithm = 'sha256' | 'sha512' | 'sha1';

/**
 * Supported NameID formats
 */
export type NameIDFormat =
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName';

// =============================================================================
// SAML Profile from IdP Response
// =============================================================================

/**
 * Parsed SAML profile from successful authentication
 */
export interface SamlProfile {
  /** SAML NameID (typically the user's identifier) */
  nameID: string;
  /** NameID format */
  nameIDFormat: string;
  /** Session index for single logout */
  sessionIndex?: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name?: string;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** User's groups/roles from IdP */
  groups?: string[];
  /** All raw attributes from SAML assertion */
  attributes: Record<string, string | string[]>;
  /** Issuer (IdP Entity ID) */
  issuer: string;
  /** Assertion ID */
  assertionId?: string;
  /** Not before timestamp */
  notBefore?: Date;
  /** Not after timestamp */
  notAfter?: Date;
}

// =============================================================================
// Workspace SSO Settings
// =============================================================================

/**
 * Workspace-level SSO settings
 */
export interface WorkspaceSSOSettings {
  /** Whether SSO is enabled for this workspace */
  ssoEnabled: boolean;
  /** Email domain(s) associated with this workspace for auto-routing */
  ssoDomains: string[];
  /** Force SSO - disallow password login for this workspace */
  forceSSO: boolean;
  /** Default role for new users provisioned via SSO */
  defaultRole: 'MEMBER' | 'ADMIN' | 'VIEWER';
  /** Enable Just-In-Time provisioning */
  jitProvisioning: boolean;
  /** Require email verification for SSO users */
  requireEmailVerification: boolean;
  /** Allow users to link existing accounts via SSO */
  allowAccountLinking: boolean;
  /** Session duration in hours */
  sessionDuration: number;
}

/**
 * Default SSO settings for new workspaces
 */
export const DEFAULT_SSO_SETTINGS: WorkspaceSSOSettings = {
  ssoEnabled: false,
  ssoDomains: [],
  forceSSO: false,
  defaultRole: 'MEMBER',
  jitProvisioning: true,
  requireEmailVerification: false,
  allowAccountLinking: true,
  sessionDuration: 8,
};

// =============================================================================
// Validation Schemas
// =============================================================================

export const AttributeMappingSchema = z.object({
  email: z.string().default('email'),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  groups: z.string().optional(),
}).catchall(z.string().optional());

export const SamlConfigSchema = z.object({
  workspaceId: z.string().cuid(),
  spEntityId: z.string().url().or(z.string().min(1)),
  idpEntityId: z.string().min(1),
  entryPoint: z.string().url(),
  callbackUrl: z.string().url(),
  logoutUrl: z.string().url().optional(),
  certificate: z.string().min(1, 'Certificate is required'),
  privateKey: z.string().optional(),
  wantAssertionsSigned: z.boolean().default(true),
  wantResponseSigned: z.boolean().default(true),
  signatureAlgorithm: z.enum(['rsa-sha256', 'rsa-sha512', 'rsa-sha1', 'ecdsa-sha256', 'eddsa-ed25519']).default('rsa-sha256'),
  digestAlgorithm: z.enum(['sha256', 'sha512', 'sha1']).default('sha256'),
  nameIdFormat: z.enum([
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName',
  ]).default('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
  attributeMapping: AttributeMappingSchema.default({ email: 'email' }),
  active: z.boolean().default(true),
});

export const WorkspaceSSOSettingsSchema = z.object({
  ssoEnabled: z.boolean().default(false),
  ssoDomains: z.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Invalid domain format')).default([]),
  forceSSO: z.boolean().default(false),
  defaultRole: z.enum(['MEMBER', 'ADMIN', 'VIEWER']).default('MEMBER'),
  jitProvisioning: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(false),
  allowAccountLinking: z.boolean().default(true),
  sessionDuration: z.number().min(1).max(168).default(8),
});

export const UpdateSamlConfigSchema = SamlConfigSchema.partial().omit({ workspaceId: true });

// =============================================================================
// Service Provider Metadata
// =============================================================================

/**
 * SP Metadata configuration for generating XML
 */
export interface SPMetadataConfig {
  entityId: string;
  assertionConsumerService: {
    url: string;
    binding: string;
  };
  singleLogoutService?: {
    url: string;
    binding: string;
  };
  nameIdFormat: NameIDFormat;
  wantAssertionsSigned: boolean;
  wantResponseSigned: boolean;
  x509Certificate?: string;
  organization?: {
    name: string;
    displayName: string;
    url: string;
  };
  contactPerson?: {
    technical: {
      email: string;
    };
    support?: {
      email: string;
    };
  };
}

/**
 * Generate Service Provider metadata XML
 * This is provided to the Identity Provider for configuration
 */
export function generateSPMetadata(config: SPMetadataConfig): string {
  const x509Certificate = config.x509Certificate
    ? `      <KeyDescriptor use="signing">
        <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
          <X509Data>
            <X509Certificate>${config.x509Certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '')}</X509Certificate>
          </X509Data>
        </KeyInfo>
      </KeyDescriptor>`
    : '';

  const sloService = config.singleLogoutService
    ? `    <SingleLogoutService Binding="${config.singleLogoutService.binding}" Location="${config.singleLogoutService.url}"/>`
    : '';

  const organization = config.organization
    ? `  <Organization>
    <OrganizationName xml:lang="en">${config.organization.name}</OrganizationName>
    <OrganizationDisplayName xml:lang="en">${config.organization.displayName}</OrganizationDisplayName>
    <OrganizationURL xml:lang="en">${config.organization.url}</OrganizationURL>
  </Organization>`
    : '';

  const contactPerson = config.contactPerson
    ? `  <ContactPerson contactType="technical">
    <EmailAddress>${config.contactPerson.technical.email}</EmailAddress>
  </ContactPerson>${config.contactPerson.support ? `
  <ContactPerson contactType="support">
    <EmailAddress>${config.contactPerson.support.email}</EmailAddress>
  </ContactPerson>` : ''}`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  entityID="${config.entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                   WantAssertionsSigned="${config.wantAssertionsSigned}"
                   AuthnRequestsSigned="${!!config.x509Certificate}">
${x509Certificate}
    <NameIDFormat>${config.nameIdFormat}</NameIDFormat>
    <AssertionConsumerService Binding="${config.assertionConsumerService.binding}"
                              Location="${config.assertionConsumerService.url}"
                              index="0"
                              isDefault="true"/>
${sloService}
  </SPSSODescriptor>
${organization}
${contactPerson}
</EntityDescriptor>`;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse a certificate from various formats to a standard PEM format
 */
export function parseCertificate(cert: string): string {
  // Remove any existing headers/footers and whitespace
  const cleanCert = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  // Add PEM headers/footers with proper line wrapping (64 chars per line)
  const chunks = cleanCert.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${chunks.join('\n')}\n-----END CERTIFICATE-----`;
}

/**
 * Validate certificate format
 */
export function isValidCertificate(_cert: string): boolean {
  try {
    // Check if it's valid base64
    // const decoded = Buffer.from(cleanCert, 'base64');
    // return decoded.length > 0 && cleanCert.length > 100;
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract certificate expiry date
 */
export function getCertificateExpiry(_cert: string): Date | null {
  // This is a simplified check - in production, use proper X.509 parsing
  try {
    // const cleanCert = cert
    //   .replace(/-----BEGIN CERTIFICATE-----/g, '')
    //   .replace(/-----END CERTIFICATE-----/g, '')
    //   .replace(/\s/g, '');
    
    // Parse the certificate to find the notAfter date
    // In a real implementation, you'd use a library like @peculiar/x509 or node-forge
    // For now, return null to indicate we need proper parsing
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if certificate is about to expire (within 30 days)
 */
export function isCertificateExpiringSoon(cert: string): boolean {
  const expiry = getCertificateExpiry(cert);
  if (!expiry) return false;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return expiry <= thirtyDaysFromNow;
}

/**
 * Get SAML binding URLs
 */
export function getSamlUrls(workspaceId: string, baseUrl: string) {
  const basePath = `${baseUrl}/api/auth/saml/${workspaceId}`;
  return {
    metadata: `${basePath}/metadata`,
    login: `${basePath}/login`,
    acs: `${basePath}/acs`,
    slo: `${basePath}/slo`,
  };
}

// =============================================================================
// Error Types
// =============================================================================

export class SamlError extends Error {
  constructor(
    message: string,
    public readonly code: SamlErrorCode,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'SamlError';
  }
}

export type SamlErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INACTIVE'
  | 'INVALID_CERTIFICATE'
  | 'INVALID_SIGNATURE'
  | 'INVALID_ASSERTION'
  | 'EMAIL_MISMATCH'
  | 'WORKSPACE_NOT_FOUND'
  | 'SAML_RESPONSE_EXPIRED'
  | 'SAML_RESPONSE_REPLAY'
  | 'AUDIENCE_MISMATCH'
  | 'DESTINATION_MISMATCH'
  | 'IDP_NOT_FOUND'
  | 'SLO_FAILED';

// =============================================================================
// IdP Metadata Parser
// =============================================================================

export interface ParsedIdPMetadata {
  entityId: string;
  entryPoint: string;
  logoutUrl?: string;
  certificate: string;
}

/**
 * Parse Identity Provider metadata XML
 * Extracts entityId, entryPoint (SSO URL), logoutUrl (SLO URL), and certificate
 */
export async function parseIdPMetadata(metadataXml: string): Promise<ParsedIdPMetadata> {
  // Extract entity ID from EntityDescriptor
  const entityIdMatch = metadataXml.match(/<md:EntityDescriptor[^>]*entityID="([^"]*)"/);
  const entityId = entityIdMatch?.[1] ?? metadataXml.match(/entityID="([^"]*)"/)?.[1];
  
  if (!entityId) {
    throw new SamlError('Failed to extract entityId from IdP metadata', 'CONFIG_NOT_FOUND', 400);
  }

  // Extract SSO URL (entryPoint)
  const ssoUrlMatch = metadataXml.match(/<md:SingleSignOnService[^>]*Binding="[^"]*HTTP-Redirect[^"]*"[^>]*Location="([^"]*)"/);
  const entryPoint = ssoUrlMatch?.[1] ?? 
    metadataXml.match(/<md:SingleSignOnService[^>]*Location="([^"]*)"[^>]*Binding="[^"]*HTTP-Redirect/)?.[1] ??
    metadataXml.match(/SingleSignOnService[^>]*Location="([^"]*)"/)?.[1];

  if (!entryPoint) {
    throw new SamlError('Failed to extract SSO URL from IdP metadata', 'CONFIG_NOT_FOUND', 400);
  }

  // Extract SLO URL (logoutUrl) - optional
  const sloUrlMatch = metadataXml.match(/<md:SingleLogoutService[^>]*Binding="[^"]*HTTP-Redirect[^"]*"[^>]*Location="([^"]*)"/);
  const logoutUrl = sloUrlMatch?.[1] ?? 
    metadataXml.match(/<md:SingleLogoutService[^>]*Location="([^"]*)"[^>]*Binding="[^"]*HTTP-Redirect/)?.[1] ??
    metadataXml.match(/SingleLogoutService[^>]*Location="([^"]*)"/)?.[1];

  // Extract X509Certificate
  const certMatch = metadataXml.match(/<ds:X509Certificate>([^<]*)<\/ds:X509Certificate>/);
  const certificate = certMatch?.[1] ?? metadataXml.match(/X509Certificate>([^<]*)<\/X509Certificate>/)?.[1];

  if (!certificate) {
    throw new SamlError('Failed to extract certificate from IdP metadata', 'INVALID_CERTIFICATE', 400);
  }

  // Format certificate with PEM headers if not present
  const formattedCert = certificate.includes('-----BEGIN CERTIFICATE-----')
    ? certificate
    : parseCertificate(certificate);

  return {
    entityId,
    entryPoint,
    logoutUrl,
    certificate: formattedCert,
  };
}
