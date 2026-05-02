/**
 * Integrations Index
 *
 * Central registry for all integration connectors
 */

export {
  type GitHubFile,
  type GitHubRepo,
  getFileContent as getGitHubFileContent,
  getRepoDocs,
  getRepoReadme,
  listUserRepos,
} from './github';
export {
  type DriveFile,
  exportFile as exportDriveFile,
  getFileContent as getDriveFileContent,
  listFiles as listDriveFiles,
} from './google-drive';
export { NotionIntegration } from './notion';
export {
  deleteNotionIntegration,
  exchangeCodeForToken as exchangeNotionCode,
  getAuthorizationUrl as getNotionAuthorizationUrl,
  getNotionIntegration,
  type NotionIntegrationRecord,
  type NotionOAuthConfig,
  type NotionTokenResponse,
  saveNotionIntegration,
} from './notion-oauth';

export { SlackIntegration } from './slack';

// =============================================================================
// Integration Registry
// =============================================================================

export interface IntegrationConnector {
  id: string;
  name: string;
  description: string;
  icon?: string;
  oauthProvider?: string;
  scopes?: string[];
  features: string[];
}

export const INTEGRATION_REGISTRY: IntegrationConnector[] = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'Import pages and databases from Notion workspaces',
    oauthProvider: 'notion',
    scopes: ['read_content', 'read_page_content'],
    features: ['page-import', 'database-import', 'auto-sync'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Import repository README, documentation, and markdown files',
    oauthProvider: 'github',
    scopes: ['repo', 'read:org'],
    features: ['repo-import', 'docs-import', 'readme-import'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Import documents, spreadsheets, and presentations from Google Drive',
    oauthProvider: 'google',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    features: ['doc-import', 'sheet-import', 'slide-import', 'pdf-import'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack workspace for chat-based RAG queries',
    oauthProvider: 'slack',
    scopes: ['commands', 'chat:write', 'users:read'],
    features: ['chat-query', 'slash-commands'],
  },
];

/**
 * Get a connector by its ID
 */
export function getConnector(id: string): IntegrationConnector | undefined {
  return INTEGRATION_REGISTRY.find((connector) => connector.id === id);
}

/**
 * List all available connectors
 */
export function listConnectors(): IntegrationConnector[] {
  return INTEGRATION_REGISTRY;
}
