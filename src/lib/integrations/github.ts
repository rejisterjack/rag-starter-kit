/**
 * GitHub Integration
 * Import repository content (README, docs, markdown files) for RAG ingestion
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  updated_at: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  content: string;
  encoding: string;
  size: number;
  type: 'file' | 'dir';
}

export interface GitHubContentEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
  encoding?: string;
  content?: string;
}

// =============================================================================
// GitHub API Client
// =============================================================================

const GITHUB_API_BASE = 'https://api.github.com';

class GitHubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options?: { method?: string }): Promise<T> {
    const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * List repositories for the authenticated user
   */
  async listRepos(params?: { per_page?: number; sort?: string }): Promise<GitHubRepo[]> {
    const perPage = params?.per_page ?? 100;
    const sort = params?.sort ?? 'updated';

    const repos = await this.request<GitHubRepo[]>(`/user/repos?per_page=${perPage}&sort=${sort}`);

    return repos;
  }

  /**
   * Get repository README content
   */
  async getReadme(owner: string, repo: string): Promise<string> {
    const data = await this.request<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/readme`
    );

    return decodeBase64Content(data.content);
  }

  /**
   * List contents of a directory in a repository
   */
  async listContents(
    owner: string,
    repo: string,
    path: string = ''
  ): Promise<GitHubContentEntry[]> {
    const endpoint = path
      ? `/repos/${owner}/${repo}/contents/${path}`
      : `/repos/${owner}/${repo}/contents`;

    return this.request<GitHubContentEntry[]>(endpoint);
  }

  /**
   * Get file content from a repository
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const data = await this.request<{ content: string; encoding: string; type: string }>(
      `/repos/${owner}/${repo}/contents/${path}`
    );

    if (data.type !== 'file' || !data.content) {
      throw new Error(`Path is not a file: ${path}`);
    }

    return decodeBase64Content(data.content);
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * List all repositories accessible to the authenticated user
 */
export async function listUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const client = new GitHubClient(accessToken);
  return client.listRepos();
}

/**
 * Get the README content of a repository as text/markdown
 */
export async function getRepoReadme(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string> {
  const client = new GitHubClient(accessToken);

  try {
    return await client.getReadme(owner, repo);
  } catch (error) {
    // README might not exist
    if (error instanceof Error && error.message.includes('404')) {
      logger.info('No README found for repository', { owner, repo });
      return '';
    }
    throw error;
  }
}

/**
 * List documentation files in a repository (from docs/, doc/, or documentation/ directories)
 */
export async function getRepoDocs(
  accessToken: string,
  owner: string,
  repo: string,
  path?: string
): Promise<GitHubFile[]> {
  const client = new GitHubClient(accessToken);

  // Default paths to check for documentation
  const docPaths = path ? [path] : ['docs', 'doc', 'documentation'];
  const files: GitHubFile[] = [];

  for (const docPath of docPaths) {
    try {
      const entries = await client.listContents(owner, repo, docPath);

      for (const entry of entries) {
        if (entry.type === 'file' && isMarkdownOrTextFile(entry.name)) {
          try {
            const content = await client.getFileContent(owner, repo, entry.path);
            files.push({
              name: entry.name,
              path: entry.path,
              content,
              encoding: 'utf-8',
              size: entry.size,
              type: 'file',
            });
          } catch (fileError) {
            logger.warn('Failed to fetch file content', {
              owner,
              repo,
              path: entry.path,
              error: fileError instanceof Error ? fileError.message : 'Unknown error',
            });
          }
        }
      }
    } catch (error) {
      // Directory might not exist — that is fine, skip it
      if (error instanceof Error && error.message.includes('404')) {
        continue;
      }
      logger.warn('Failed to list docs directory', {
        owner,
        repo,
        docPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return files;
}

/**
 * Get the content of a specific file in a repository
 */
export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const client = new GitHubClient(accessToken);
  return client.getFileContent(owner, repo, path);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Decode base64-encoded file content from the GitHub API
 */
function decodeBase64Content(content: string): string {
  // GitHub API returns base64-encoded content with newlines
  const cleaned = content.replace(/\n/g, '');
  return Buffer.from(cleaned, 'base64').toString('utf-8');
}

/**
 * Check if a filename is a markdown or text file
 */
function isMarkdownOrTextFile(filename: string): boolean {
  const extensions = ['.md', '.mdx', '.txt', '.markdown', '.rst', '.adoc'];
  const lower = filename.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export default { listUserRepos, getRepoReadme, getRepoDocs, getFileContent };
