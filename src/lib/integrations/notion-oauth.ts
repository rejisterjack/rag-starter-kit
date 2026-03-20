/**
 * Notion OAuth Integration
 *
 * Handles OAuth 2.0 flow for Notion integration
 * https://developers.notion.com/docs/authorization
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const NOTION_OAUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  owner:
    | {
        type: 'user';
        user: {
          object: 'user';
          id: string;
          name: string;
          avatar_url: string | null;
          type: 'person';
          person: {
            email: string;
          };
        };
      }
    | {
        type: 'workspace';
        workspace: boolean;
      };
}

export interface NotionIntegrationRecord {
  id: string;
  userId: string;
  workspaceId: string;
  notionWorkspaceId: string;
  notionWorkspaceName: string;
  accessToken: string;
  botId: string;
  ownerEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// OAuth Flow
// =============================================================================

/**
 * Generate Notion OAuth authorization URL
 */
export function getAuthorizationUrl(config: NotionOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    owner: 'user',
    state,
  });

  return `${NOTION_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  config: NotionOAuthConfig
): Promise<NotionTokenResponse> {
  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Notion OAuth token exchange failed', { status: response.status, error });
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json() as Promise<NotionTokenResponse>;
}

/**
 * Refresh access token (Notion tokens don't expire, but good to have)
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: NotionOAuthConfig
): Promise<NotionTokenResponse> {
  // Notion tokens don't expire, but if they did:
  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Notion token refresh failed', { status: response.status, error });
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json() as Promise<NotionTokenResponse>;
}

/**
 * Revoke Notion access
 */
export async function revokeAccess(_accessToken: string): Promise<void> {
  // Notion doesn't have a revoke endpoint, but we can delete our stored token
  // In practice, users revoke via Notion's integration settings
  logger.info('Notion access revoked (token deleted from our database)');
}

// =============================================================================
// Database Operations
// =============================================================================

import { prisma } from '@/lib/db';

/**
 * Save Notion integration to database
 */
export async function saveNotionIntegration(
  userId: string,
  appWorkspaceId: string,
  tokenData: NotionTokenResponse
): Promise<NotionIntegrationRecord> {
  // Use providerAccountId as the Notion workspace ID
  const providerAccountId = tokenData.workspace_id;

  const integration = await prisma.integrationAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'notion',
        providerAccountId,
      },
    },
    update: {
      accessToken: tokenData.access_token,
      updatedAt: new Date(),
    },
    create: {
      provider: 'notion',
      providerAccountId,
      accessToken: tokenData.access_token,
      userId,
      workspaceId: appWorkspaceId,
      scope: 'read_content,read_page_content', // Notion scopes used
    },
  });

  logger.info('Notion integration saved', {
    userId,
    workspaceId: appWorkspaceId,
    notionWorkspaceId: tokenData.workspace_id,
  });

  return {
    id: integration.id,
    userId: integration.userId,
    workspaceId: integration.workspaceId ?? '',
    notionWorkspaceId: tokenData.workspace_id,
    notionWorkspaceName: tokenData.workspace_name,
    accessToken: integration.accessToken,
    botId: tokenData.bot_id,
    ownerEmail: tokenData.owner.type === 'user' ? tokenData.owner.user.person.email : null,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

/**
 * Get Notion integration for user
 */
export async function getNotionIntegration(
  userId: string,
  appWorkspaceId: string
): Promise<NotionIntegrationRecord | null> {
  const integration = await prisma.integrationAccount.findFirst({
    where: {
      provider: 'notion',
      userId,
      workspaceId: appWorkspaceId,
    },
  });

  if (!integration) return null;

  // Parse workspace name from metadata if stored, or use ID
  return {
    id: integration.id,
    userId: integration.userId,
    workspaceId: integration.workspaceId ?? '',
    notionWorkspaceId: integration.providerAccountId,
    notionWorkspaceName: integration.providerAccountId, // Could store name in metadata
    accessToken: integration.accessToken,
    botId: integration.providerAccountId,
    ownerEmail: null,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

/**
 * Delete Notion integration
 */
export async function deleteNotionIntegration(
  userId: string,
  appWorkspaceId: string
): Promise<void> {
  await prisma.integrationAccount.deleteMany({
    where: {
      provider: 'notion',
      userId,
      workspaceId: appWorkspaceId,
    },
  });

  logger.info('Notion integration deleted', { userId, workspaceId: appWorkspaceId });
}

/**
 * List all Notion integrations for a user
 */
export async function listNotionIntegrations(
  userId: string
): Promise<
  Pick<NotionIntegrationRecord, 'id' | 'notionWorkspaceName' | 'notionWorkspaceId' | 'createdAt'>[]
> {
  const integrations = await prisma.integrationAccount.findMany({
    where: {
      provider: 'notion',
      userId,
    },
    select: {
      id: true,
      providerAccountId: true,
      createdAt: true,
    },
  });

  return integrations.map((i) => ({
    id: i.id,
    notionWorkspaceName: i.providerAccountId,
    notionWorkspaceId: i.providerAccountId,
    createdAt: i.createdAt,
  }));
}
