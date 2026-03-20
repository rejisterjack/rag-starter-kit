/**
 * Domain-based Auto-routing for SSO
 *
 * Automatically detects workspace from email domain and routes to appropriate
 * SSO provider. Falls back to password login for unknown domains.
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of domain lookup
 */
export interface DomainLookupResult {
  /** Whether a workspace was found for this domain */
  found: boolean;
  /** Workspace ID if found */
  workspaceId?: string;
  /** Workspace name for display */
  workspaceName?: string;
  /** Workspace logo URL */
  workspaceLogo?: string;
  /** Available SSO methods */
  ssoMethods: SSOMethod[];
  /** Whether SSO is required (force SSO) */
  forceSSO: boolean;
  /** Whether JIT provisioning is enabled */
  jitProvisioning: boolean;
  /** Default role for new SSO users */
  defaultRole: 'MEMBER' | 'ADMIN' | 'VIEWER';
}

/**
 * SSO method available for a workspace
 */
export interface SSOMethod {
  type: 'saml' | 'oauth';
  provider?: 'google_workspace' | 'azure_ad' | 'okta' | 'onelogin' | 'auth0' | 'generic_oidc';
  name: string;
  id: string;
}

// =============================================================================
// Domain Detection
// =============================================================================

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string | null {
  try {
    const parts = email.toLowerCase().trim().split('@');
    if (parts.length !== 2) return null;

    const domain = parts[1];
    // Basic domain validation
    if (!domain.includes('.') || domain.length < 4) return null;

    return domain;
  } catch {
    return null;
  }
}

/**
 * Lookup workspace by email domain
 */
export async function lookupDomain(email: string): Promise<DomainLookupResult> {
  const domain = extractDomain(email);

  if (!domain) {
    return {
      found: false,
      ssoMethods: [],
      forceSSO: false,
      jitProvisioning: false,
      defaultRole: 'MEMBER',
    };
  }

  // Find workspace with matching SSO domain
  const workspace = await prisma.workspace.findFirst({
    where: {
      ssoDomain: {
        equals: domain,
        mode: 'insensitive',
      },
    },
    include: {
      samlConnection: true,
    },
  });

  if (!workspace) {
    return {
      found: false,
      ssoMethods: [],
      forceSSO: false,
      jitProvisioning: false,
      defaultRole: 'MEMBER',
    };
  }

  // Build SSO methods list
  const ssoMethods: SSOMethod[] = [];

  // Check SAML
  if (workspace.samlConnection?.enabled) {
    ssoMethods.push({
      type: 'saml',
      name: 'SSO',
      id: workspace.samlConnection.id,
    });
  }

  // Note: oauthConnections not in schema - skipping OAuth providers

  // Parse workspace settings
  const settings = (workspace.settings as Record<string, unknown>) || {};

  return {
    found: true,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceLogo: (workspace.logoUrl as string | undefined) || undefined,
    ssoMethods,
    forceSSO: settings.forceSSO === true,
    jitProvisioning: settings.jitProvisioning !== false, // Default true
    defaultRole: (settings.defaultSSORole as 'MEMBER' | 'ADMIN' | 'VIEWER') || 'MEMBER',
  };
}

/**
 * Check if email domain matches any configured SSO domain
 */
export async function isSSODomain(email: string): Promise<boolean> {
  const result = await lookupDomain(email);
  return result.found && result.ssoMethods.length > 0;
}

/**
 * Get SSO redirect URL for email domain
 */
export function getSSORedirectUrl(
  method: SSOMethod,
  workspaceId: string,
  baseUrl: string,
  email?: string
): string {
  const params = new URLSearchParams();

  if (email) {
    params.set('email', email);
  }
  params.set('workspace', workspaceId);
  params.set('method', method.id);

  if (method.type === 'saml') {
    return `${baseUrl}/api/auth/saml/${workspaceId}/login?${params.toString()}`;
  } else {
    return `${baseUrl}/api/auth/oauth/${method.id}?${params.toString()}`;
  }
}

// =============================================================================
// Auto-routing Logic
// =============================================================================

/**
 * Determine authentication route for a user
 */
export async function getAuthRoute(
  email: string,
  baseUrl: string,
  returnUrl?: string
): Promise<{
  type: 'sso' | 'password';
  redirectUrl?: string;
  workspace?: DomainLookupResult;
}> {
  const lookup = await lookupDomain(email);

  if (!lookup.found || lookup.ssoMethods.length === 0) {
    return { type: 'password' };
  }

  // If SSO is forced, redirect to first available SSO method
  if (lookup.forceSSO) {
    const primaryMethod = lookup.ssoMethods[0];
    const params = new URLSearchParams();

    if (returnUrl) {
      params.set('returnUrl', returnUrl);
    }

    return {
      type: 'sso',
      redirectUrl: getSSORedirectUrl(primaryMethod, lookup.workspaceId!, baseUrl, email),
      workspace: lookup,
    };
  }

  // SSO available but not forced - return options
  return {
    type: 'password', // User can still choose password
    workspace: lookup,
  };
}

// =============================================================================
// Domain Management
// =============================================================================

/**
 * Validate a domain format
 */
export function isValidDomain(domain: string): boolean {
  // Simple domain validation regex
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain.toLowerCase());
}

/**
 * Check if domain is already claimed by another workspace
 */
export async function isDomainAvailable(
  domain: string,
  excludeWorkspaceId?: string
): Promise<boolean> {
  const existing = await prisma.workspace.findFirst({
    where: {
      ssoDomain: {
        equals: domain,
        mode: 'insensitive',
      },
      ...(excludeWorkspaceId && {
        id: { not: excludeWorkspaceId },
      }),
    },
  });

  return !existing;
}

/**
 * Set SSO domain for workspace
 */
export async function setWorkspaceSSODomain(
  workspaceId: string,
  domain: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate domain if provided
    if (domain && !isValidDomain(domain)) {
      return { success: false, error: 'Invalid domain format' };
    }

    // Check if domain is available
    if (domain && !(await isDomainAvailable(domain, workspaceId))) {
      return { success: false, error: 'Domain is already claimed by another workspace' };
    }

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ssoDomain: domain,
      },
    });

    // Log the change
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      workspaceId,
      metadata: {
        setting: 'ssoDomain',
        value: domain,
      },
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to set SSO domain', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to update domain' };
  }
}

// =============================================================================
// Cached Domain Lookup
// =============================================================================

// Simple in-memory cache for domain lookups
// In production, use Redis with appropriate TTL
const domainCache = new Map<string, { result: DomainLookupResult; expires: number }>();
const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cached domain lookup
 */
export async function lookupDomainCached(email: string): Promise<DomainLookupResult> {
  const domain = extractDomain(email);
  if (!domain) {
    return {
      found: false,
      ssoMethods: [],
      forceSSO: false,
      jitProvisioning: false,
      defaultRole: 'MEMBER',
    };
  }

  // Check cache
  const cached = domainCache.get(domain);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  // Perform lookup
  const result = await lookupDomain(email);

  // Cache result
  domainCache.set(domain, {
    result,
    expires: Date.now() + DOMAIN_CACHE_TTL_MS,
  });

  return result;
}

/**
 * Invalidate domain cache
 */
export function invalidateDomainCache(domain?: string): void {
  if (domain) {
    domainCache.delete(domain.toLowerCase());
  } else {
    domainCache.clear();
  }
}

// =============================================================================
// Email Normalization
// =============================================================================

/**
 * Normalize email for comparison
 * Handles common variations like Gmail dots and plus addressing
 */
export function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().trim().split('@');

  if (!domain) return email.toLowerCase().trim();

  // Handle Gmail-specific normalization
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Remove dots and plus addressing
    const normalizedLocal = localPart.replace(/\./g, '').split('+')[0];
    return `${normalizedLocal}@gmail.com`;
  }

  return `${localPart}@${domain}`;
}

/**
 * Check if two emails are equivalent after normalization
 */
export function emailsEqual(email1: string, email2: string): boolean {
  return normalizeEmail(email1) === normalizeEmail(email2);
}
