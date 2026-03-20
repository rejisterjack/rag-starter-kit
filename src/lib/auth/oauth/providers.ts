/**
 * OAuth2/OIDC Provider Configuration
 * 
 * Supports enterprise SSO via:
 * - Google Workspace
 * - Microsoft/Azure AD
 * - Okta
 * - Generic OIDC providers
 */

import { z } from 'zod';

// =============================================================================
// OAuth Provider Types
// =============================================================================

/**
 * OAuth provider configuration interface
 */
export interface OAuthProviderConfig {
  id: string;
  workspaceId: string;
  /** Provider type */
  provider: OAuthProviderType;
  /** Human-readable name for this configuration */
  name: string;
  /** Client ID from the OAuth provider */
  clientId: string;
  /** Client secret from the OAuth provider */
  clientSecret: string;
  /** Authorization endpoint URL */
  authorizationUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** User info endpoint URL (for OIDC) */
  userInfoUrl?: string;
  /** JWKS endpoint URL (for OIDC) */
  jwksUrl?: string;
  /** Issuer URL (for OIDC validation) */
  issuer?: string;
  /** Scopes to request */
  scopes: string[];
  /** Attribute mapping for user profile */
  attributeMapping: OAuthAttributeMapping;
  /** Whether the configuration is active */
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supported OAuth provider types
 */
export type OAuthProviderType =
  | 'google_workspace'
  | 'azure_ad'
  | 'okta'
  | 'onelogin'
  | 'auth0'
  | 'generic_oidc';

/**
 * OAuth attribute mapping
 */
export interface OAuthAttributeMapping {
  /** Field containing the user's email */
  email: string;
  /** Field containing the user's display name */
  name?: string;
  /** Field containing the user's given name */
  givenName?: string;
  /** Field containing the user's family name */
  familyName?: string;
  /** Field containing user's groups/roles */
  groups?: string;
  /** Field containing user's picture/avatar */
  picture?: string;
  /** Whether email is verified */
  emailVerified?: string;
}

/**
 * OAuth user profile
 */
export interface OAuthProfile {
  /** Unique identifier from the provider */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name?: string;
  /** User's given name */
  givenName?: string;
  /** User's family name */
  familyName?: string;
  /** User's groups/roles */
  groups?: string[];
  /** User's profile picture URL */
  picture?: string;
  /** Whether email is verified */
  emailVerified: boolean;
  /** Provider type */
  provider: OAuthProviderType;
  /** Raw profile data */
  raw: Record<string, unknown>;
}

// =============================================================================
// Provider Presets
// =============================================================================

/**
 * Preset configurations for common OAuth providers
 */
export const OAuthProviderPresets: Record<
  OAuthProviderType,
  Omit<OAuthProviderConfig, 'id' | 'workspaceId' | 'clientId' | 'clientSecret' | 'name' | 'createdAt' | 'updatedAt'>
> = {
  google_workspace: {
    provider: 'google_workspace',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    scopes: ['openid', 'email', 'profile'],
    attributeMapping: {
      email: 'email',
      name: 'name',
      givenName: 'given_name',
      familyName: 'family_name',
      picture: 'picture',
      emailVerified: 'email_verified',
    },
    active: true,
  },
  azure_ad: {
    provider: 'azure_ad',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    issuer: 'https://login.microsoftonline.com/{tenant}/v2.0',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    attributeMapping: {
      email: 'email',
      name: 'name',
      givenName: 'given_name',
      familyName: 'family_name',
      groups: 'groups',
      picture: 'picture',
      emailVerified: 'email_verified',
    },
    active: true,
  },
  okta: {
    provider: 'okta',
    authorizationUrl: 'https://{domain}.okta.com/oauth2/default/v1/authorize',
    tokenUrl: 'https://{domain}.okta.com/oauth2/default/v1/token',
    userInfoUrl: 'https://{domain}.okta.com/oauth2/default/v1/userinfo',
    jwksUrl: 'https://{domain}.okta.com/oauth2/default/v1/keys',
    issuer: 'https://{domain}.okta.com/oauth2/default',
    scopes: ['openid', 'email', 'profile', 'groups'],
    attributeMapping: {
      email: 'email',
      name: 'name',
      givenName: 'given_name',
      familyName: 'family_name',
      groups: 'groups',
      picture: 'picture',
      emailVerified: 'email_verified',
    },
    active: true,
  },
  onelogin: {
    provider: 'onelogin',
    authorizationUrl: 'https://{domain}.onelogin.com/oidc/2/auth',
    tokenUrl: 'https://{domain}.onelogin.com/oidc/2/token',
    userInfoUrl: 'https://{domain}.onelogin.com/oidc/2/me',
    jwksUrl: 'https://{domain}.onelogin.com/oidc/2/certs',
    issuer: 'https://{domain}.onelogin.com',
    scopes: ['openid', 'email', 'profile', 'groups'],
    attributeMapping: {
      email: 'email',
      name: 'name',
      givenName: 'given_name',
      familyName: 'family_name',
      groups: 'groups',
      picture: 'picture',
      emailVerified: 'email_verified',
    },
    active: true,
  },
  auth0: {
    provider: 'auth0',
    authorizationUrl: 'https://{domain}.auth0.com/authorize',
    tokenUrl: 'https://{domain}.auth0.com/oauth/token',
    userInfoUrl: 'https://{domain}.auth0.com/userinfo',
    jwksUrl: 'https://{domain}.auth0.com/.well-known/jwks.json',
    issuer: 'https://{domain}.auth0.com/',
    scopes: ['openid', 'email', 'profile'],
    attributeMapping: {
      email: 'email',
      name: 'name',
      givenName: 'given_name',
      familyName: 'family_name',
      groups: 'groups',
      picture: 'picture',
      emailVerified: 'email_verified',
    },
    active: true,
  },
  generic_oidc: {
    provider: 'generic_oidc',
    authorizationUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    jwksUrl: '',
    scopes: ['openid', 'email', 'profile'],
    attributeMapping: {
      email: 'email',
      name: 'name',
      givenName: 'given_name',
      familyName: 'family_name',
      picture: 'picture',
      emailVerified: 'email_verified',
    },
    active: true,
  },
};

// =============================================================================
// Validation Schemas
// =============================================================================

export const OAuthAttributeMappingSchema = z.object({
  email: z.string().default('email'),
  name: z.string().optional(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  groups: z.string().optional(),
  picture: z.string().optional(),
  emailVerified: z.string().optional(),
});

export const OAuthProviderConfigSchema = z.object({
  workspaceId: z.string().cuid(),
  provider: z.enum(['google_workspace', 'azure_ad', 'okta', 'onelogin', 'auth0', 'generic_oidc']),
  name: z.string().min(1, 'Name is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  authorizationUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  userInfoUrl: z.string().url().optional(),
  jwksUrl: z.string().url().optional(),
  issuer: z.string().optional(),
  scopes: z.array(z.string()).default(['openid', 'email', 'profile']),
  attributeMapping: OAuthAttributeMappingSchema.default({ email: 'email' }),
  active: z.boolean().default(true),
}).refine((data) => {
  // For generic_oidc, require all OIDC endpoints
  if (data.provider === 'generic_oidc') {
    return !!(data.authorizationUrl && data.tokenUrl && data.userInfoUrl);
  }
  return true;
}, {
  message: 'Generic OIDC requires authorizationUrl, tokenUrl, and userInfoUrl',
  path: ['provider'],
});

// =============================================================================
// Provider URL Builders
// =============================================================================

interface ProviderUrlParams {
  tenantId?: string;
  domain?: string;
}

/**
 * Build provider URLs with domain/tenant placeholders replaced
 */
export function buildProviderUrls(
  type: OAuthProviderType,
  config: Partial<OAuthProviderConfig>,
  params: ProviderUrlParams = {}
): Pick<OAuthProviderConfig, 'authorizationUrl' | 'tokenUrl' | 'userInfoUrl' | 'jwksUrl' | 'issuer'> {
  const preset = OAuthProviderPresets[type];
  const replaceParams = (url: string): string => {
    let result = url;
    if (params.tenantId) {
      result = result.replace(/{tenant}/g, params.tenantId);
    }
    if (params.domain) {
      result = result.replace(/{domain}/g, params.domain);
    }
    return result;
  };

  return {
    authorizationUrl: config.authorizationUrl || replaceParams(preset.authorizationUrl),
    tokenUrl: config.tokenUrl || replaceParams(preset.tokenUrl),
    userInfoUrl: config.userInfoUrl || (preset.userInfoUrl ? replaceParams(preset.userInfoUrl) : undefined),
    jwksUrl: config.jwksUrl || (preset.jwksUrl ? replaceParams(preset.jwksUrl) : undefined),
    issuer: config.issuer || (preset.issuer ? replaceParams(preset.issuer) : undefined),
  };
}

// =============================================================================
// OAuth Flow
// =============================================================================

/**
 * Generate authorization URL for OAuth login
 */
export function generateAuthUrl(
  config: OAuthProviderConfig,
  redirectUri: string,
  state: string,
  nonce?: string
): string {
  const url = new URL(config.authorizationUrl);
  
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  
  if (nonce) {
    url.searchParams.set('nonce', nonce);
  }

  return url.toString();
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(
  config: OAuthProviderConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new OAuthError(`Token exchange failed: ${error}`, 'TOKEN_EXCHANGE_FAILED');
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Fetch user profile from userinfo endpoint
 */
export async function fetchUserProfile(
  config: OAuthProviderConfig,
  accessToken: string
): Promise<OAuthProfile> {
  if (!config.userInfoUrl) {
    throw new OAuthError('User info URL not configured', 'CONFIG_ERROR');
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new OAuthError(`Failed to fetch user profile: ${error}`, 'PROFILE_FETCH_FAILED');
  }

  const raw = await response.json() as Record<string, unknown>;

  // Map attributes according to configuration
  const mapping = config.attributeMapping;
  
  const email = getNestedValue(raw, mapping.email) as string;
  if (!email) {
    throw new OAuthError('Email not found in user profile', 'EMAIL_NOT_FOUND');
  }

  const emailVerified = mapping.emailVerified
    ? Boolean(getNestedValue(raw, mapping.emailVerified))
    : true;

  let groups: string[] | undefined;
  if (mapping.groups) {
    const groupsValue = getNestedValue(raw, mapping.groups);
    groups = Array.isArray(groupsValue) 
      ? groupsValue as string[]
      : groupsValue ? [String(groupsValue)] : undefined;
  }

  return {
    id: String(raw.sub || raw.id || raw.user_id || email),
    email: email.toLowerCase().trim(),
    name: mapping.name ? String(getNestedValue(raw, mapping.name) || '') : undefined,
    givenName: mapping.givenName ? String(getNestedValue(raw, mapping.givenName) || '') : undefined,
    familyName: mapping.familyName ? String(getNestedValue(raw, mapping.familyName) || '') : undefined,
    groups,
    picture: mapping.picture ? String(getNestedValue(raw, mapping.picture) || '') : undefined,
    emailVerified,
    provider: config.provider,
    raw,
  };
}

/**
 * Token response from OAuth provider
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * OAuth error class
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

/**
 * State store for CSRF protection
 * In production, use Redis or database with TTL
 */
const stateStore = new Map<string, { workspaceId: string; providerId: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate and store state parameter
 */
export function generateState(workspaceId: string, providerId: string): string {
  const state = crypto.randomUUID();
  stateStore.set(state, {
    workspaceId,
    providerId,
    createdAt: Date.now(),
  });

  // Auto-cleanup after TTL
  setTimeout(() => {
    stateStore.delete(state);
  }, STATE_TTL_MS);

  return state;
}

/**
 * Validate and consume state parameter
 */
export function consumeState(state: string): { workspaceId: string; providerId: string } | null {
  const data = stateStore.get(state);
  if (!data) return null;

  // Check expiration
  if (Date.now() - data.createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    return null;
  }

  stateStore.delete(state);
  return {
    workspaceId: data.workspaceId,
    providerId: data.providerId,
  };
}

// =============================================================================
// Database Integration
// =============================================================================

import { prisma } from '@/lib/db';

/**
 * Get OAuth providers for a workspace
 */
export async function getWorkspaceOAuthProviders(
  workspaceId: string,
  onlyActive = true
): Promise<OAuthProviderConfig[]> {
  // Note: oAuthConnection model not in schema - returning empty array
  void workspaceId;
  void onlyActive;
  const providers: Array<{
    id: string;
    workspaceId: string;
    provider: string;
    name: string;
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string | null;
    jwksUrl: string | null;
    issuer: string | null;
    scopes: unknown;
    attributeMapping: unknown;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  return providers.map((p: typeof providers[0]) => ({
    id: p.id,
    workspaceId: p.workspaceId,
    provider: p.provider as OAuthProviderType,
    name: p.name,
    clientId: p.clientId,
    clientSecret: p.clientSecret,
    authorizationUrl: p.authorizationUrl,
    tokenUrl: p.tokenUrl,
    userInfoUrl: p.userInfoUrl || undefined,
    jwksUrl: p.jwksUrl || undefined,
    issuer: p.issuer || undefined,
    scopes: p.scopes as string[],
    attributeMapping: p.attributeMapping as OAuthAttributeMapping,
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/**
 * Get OAuth provider by ID
 */
export async function getOAuthProviderById(
  _providerId: string
): Promise<OAuthProviderConfig | null> {
  // Note: oAuthConnection model not in schema - returning null
  void _providerId;
  return null;
}

/**
 * Create or update OAuth provider configuration
 */
export async function upsertOAuthProvider(
  _workspaceId: string,
  config: Omit<OAuthProviderConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Promise<OAuthProviderConfig> {
  // Note: oAuthConnection model not in schema - returning mock data
  const now = new Date();
  const provider = {
    id: 'mock-id',
    workspaceId: _workspaceId,
    provider: config.provider,
    name: config.name,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: config.authorizationUrl,
    tokenUrl: config.tokenUrl,
    userInfoUrl: config.userInfoUrl ?? null,
    jwksUrl: config.jwksUrl ?? null,
    issuer: config.issuer ?? null,
    scopes: config.scopes,
    attributeMapping: config.attributeMapping,
    active: config.active,
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: provider.id,
    workspaceId: provider.workspaceId,
    provider: provider.provider as OAuthProviderType,
    name: provider.name,
    clientId: provider.clientId,
    clientSecret: provider.clientSecret,
    authorizationUrl: provider.authorizationUrl,
    tokenUrl: provider.tokenUrl,
    userInfoUrl: provider.userInfoUrl || undefined,
    jwksUrl: provider.jwksUrl || undefined,
    issuer: provider.issuer || undefined,
    scopes: provider.scopes as string[],
    attributeMapping: provider.attributeMapping as OAuthAttributeMapping,
    active: provider.active,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

/**
 * Delete OAuth provider
 */
export async function deleteOAuthProvider(_providerId: string): Promise<void> {
  // Note: oAuthConnection model not in schema - no-op
  void _providerId;
}

/**
 * Get all SSO methods for a workspace (SAML + OAuth)
 */
export async function getWorkspaceSSOMethods(workspaceId: string): Promise<{
  saml: boolean;
  oauth: OAuthProviderConfig[];
}> {
  const samlConfig = await prisma.samlConnection.findUnique({
    where: { workspaceId },
  });
  const oauthProviders = await getWorkspaceOAuthProviders(workspaceId);

  return {
    saml: samlConfig?.enabled ?? false,
    oauth: oauthProviders,
  };
}
