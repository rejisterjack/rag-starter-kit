/**
 * GitHub Connector
 *
 * Ingests Markdown (.md, .mdx) and plain-text files from a public or private
 * GitHub repository using the GitHub REST API.
 *
 * Requires GITHUB_TOKEN in environment variables for private repos and higher
 * rate limits (5000 req/hr vs 60 req/hr unauthenticated).
 *
 * Usage:
 *   const parser = new GitHubParser(token);
 *   const docs = await parser.parseRepo("owner/repo", { branch: "main", extensions: [".md"] });
 *   // or a single file:
 *   const doc = await parser.parseFile("owner/repo", "docs/README.md");
 */

import { logger } from '@/lib/logger';

export interface GitHubFile {
  path: string;
  content: string;
  title: string;
  url: string;
  sha: string;
  size: number;
}

export interface GitHubParseOptions {
  /** Branch or ref to read from. Defaults to the repo's default branch. */
  branch?: string;
  /** File extensions to include. Defaults to ['.md', '.mdx', '.txt']. */
  extensions?: string[];
  /** Maximum number of files to fetch (safety limit). Defaults to 200. */
  maxFiles?: number;
  /** Sub-directory path to restrict to, e.g. "docs" */
  directory?: string;
}

const GITHUB_API = 'https://api.github.com';
const DEFAULT_EXTENSIONS = ['.md', '.mdx', '.txt', '.rst'];
const DEFAULT_MAX_FILES = 200;

type GitHubTreeItem = {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
};

export class GitHubParser {
  private readonly token: string | undefined;

  constructor(token?: string) {
    this.token = token;
  }

  private async get<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GitHub API error ${res.status} for ${url}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch a single file's decoded content */
  async parseFile(ownerRepo: string, filePath: string, branch?: string): Promise<GitHubFile> {
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) throw new Error(`Invalid owner/repo: ${ownerRepo}`);

    const ref = branch ? `?ref=${branch}` : '';
    const data = await this.get<{
      content: string;
      encoding: string;
      sha: string;
      size: number;
      html_url: string;
      name: string;
    }>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}${ref}`);

    if (data.encoding !== 'base64') {
      throw new Error(`Unexpected encoding: ${data.encoding}`);
    }

    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    const title = data.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

    return {
      path: filePath,
      content,
      title,
      url: data.html_url,
      sha: data.sha,
      size: data.size,
    };
  }

  /** Fetch all matching files from a repository using the Git tree API */
  async parseRepo(ownerRepo: string, options: GitHubParseOptions = {}): Promise<GitHubFile[]> {
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) throw new Error(`Invalid owner/repo: ${ownerRepo}`);

    const {
      branch,
      extensions = DEFAULT_EXTENSIONS,
      maxFiles = DEFAULT_MAX_FILES,
      directory,
    } = options;

    logger.info('Fetching GitHub repo tree', { ownerRepo, branch, extensions, directory });

    // Resolve the branch / SHA to use
    let ref = branch;
    if (!ref) {
      const repoData = await this.get<{ default_branch: string }>(
        `${GITHUB_API}/repos/${owner}/${repo}`
      );
      ref = repoData.default_branch;
    }

    // Fetch the full recursive tree
    const treeData = await this.get<{ tree: GitHubTreeItem[]; truncated: boolean }>(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`
    );

    if (treeData.truncated) {
      logger.warn('GitHub tree response was truncated — some files may be missing', { ownerRepo });
    }

    // Filter to matching blobs
    const matching = treeData.tree.filter((item) => {
      if (item.type !== 'blob') return false;
      if (directory && !item.path.startsWith(`${directory}/`)) return false;
      const hasMatchingExt = extensions.some((ext) =>
        item.path.toLowerCase().endsWith(ext.toLowerCase())
      );
      return hasMatchingExt;
    });

    const limited = matching.slice(0, maxFiles);
    logger.info(`Found ${limited.length} matching files in ${ownerRepo}`, {
      total: matching.length,
    });

    // Fetch each file in parallel (batches of 10 to avoid rate limiting)
    const results: GitHubFile[] = [];
    const batchSize = 10;

    for (let i = 0; i < limited.length; i += batchSize) {
      const batch = limited.slice(i, i + batchSize);
      const fetched = await Promise.allSettled(
        batch.map((item) => this.parseFile(ownerRepo, item.path, ref))
      );
      for (const result of fetched) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.warn('Failed to fetch GitHub file', { reason: result.reason });
        }
      }
    }

    return results;
  }
}
