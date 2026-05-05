/**
 * Google Drive Connector
 *
 * Ingests documents from Google Drive using the Google Drive REST API v3.
 * Supports:
 *   - Google Docs (exported as plain text)
 *   - Google Sheets (exported as CSV)
 *   - Google Slides (exported as plain text)
 *   - Uploaded files: PDF, plain text, Markdown
 *
 * Requires a Google OAuth2 access token (user-specific) OR a service account
 * access token. Pass as `accessToken` to the constructor.
 *
 * Usage:
 *   const parser = new GoogleDriveParser(accessToken);
 *   // Single file by Drive file ID:
 *   const doc = await parser.parseFile("1BxiMVs0XRA5nFMdKvBdBZjgmUUqpt0MbL2Mh11CiCW8");
 *   // All matching files in a folder:
 *   const docs = await parser.parseFolder("folderIdHere", { mimeTypes: ['application/vnd.google-apps.document'] });
 */

import { logger } from '@/lib/logger';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  content: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: number;
}

export interface DriveFolderOptions {
  /** MIME types to include. Defaults to Google Docs + plain text + PDF + Markdown. */
  mimeTypes?: string[];
  /** Maximum files to fetch per folder. Defaults to 100. */
  maxFiles?: number;
  /** Include files in sub-folders recursively. Defaults to false. */
  recursive?: boolean;
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const EXPORT_API = 'https://www.googleapis.com/drive/v3/files';

// Supported MIME types and their export format
const EXPORT_MAP: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

const DEFAULT_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'text/plain',
  'text/markdown',
  'application/pdf',
];

export class GoogleDriveParser {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken) throw new Error('Google Drive access token is required');
    this.accessToken = accessToken;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google Drive API error ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  private async getText(url: string): Promise<string> {
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google Drive download error ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.text();
  }

  /** Export or download the content of a file */
  private async fetchContent(fileId: string, mimeType: string): Promise<string> {
    const exportMime = EXPORT_MAP[mimeType];

    if (exportMime) {
      // Google Workspace files must be exported
      const url = `${EXPORT_API}/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
      return this.getText(url);
    }

    if (mimeType === 'application/pdf') {
      // For PDFs we return a placeholder — full PDF parsing requires the PDF parser
      // Callers can pipe the Drive file ID through the existing PDF parser separately
      return `[PDF file — use the PDF parser with Drive file download URL for full text extraction]`;
    }

    // Plain binary download for text/plain, text/markdown, etc.
    const url = `${EXPORT_API}/${fileId}?alt=media`;
    return this.getText(url);
  }

  /** Fetch metadata + content for a single Drive file */
  async parseFile(fileId: string): Promise<DriveFile> {
    type FileMeta = {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      modifiedTime?: string;
      size?: string;
    };

    const meta = await this.get<FileMeta>(
      `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,webViewLink,modifiedTime,size`
    );

    logger.info('Fetching Google Drive file', { fileId, name: meta.name, mimeType: meta.mimeType });

    const content = await this.fetchContent(meta.id, meta.mimeType);

    return {
      id: meta.id,
      name: meta.name,
      mimeType: meta.mimeType,
      content,
      webViewLink: meta.webViewLink,
      modifiedTime: meta.modifiedTime,
      size: meta.size ? parseInt(meta.size, 10) : content.length,
    };
  }

  /** List + fetch all matching files in a Drive folder */
  async parseFolder(folderId: string, options: DriveFolderOptions = {}): Promise<DriveFile[]> {
    const { mimeTypes = DEFAULT_MIME_TYPES, maxFiles = 100, recursive = false } = options;

    logger.info('Scanning Google Drive folder', { folderId, mimeTypes, recursive });

    const mimeQuery = mimeTypes.map((m) => `mimeType='${m}'`).join(' or ');
    const q = `'${folderId}' in parents and (${mimeQuery}) and trashed=false`;

    type FileListResponse = {
      files: Array<{ id: string; name: string; mimeType: string }>;
      nextPageToken?: string;
    };

    const allFiles: Array<{ id: string; name: string; mimeType: string }> = [];
    let pageToken: string | undefined;

    do {
      const url =
        `${DRIVE_API}/files?` +
        `q=${encodeURIComponent(q)}` +
        `&fields=nextPageToken,files(id,name,mimeType)` +
        `&pageSize=${Math.min(maxFiles - allFiles.length, 100)}` +
        (pageToken ? `&pageToken=${pageToken}` : '');

      const data = await this.get<FileListResponse>(url);
      allFiles.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken && allFiles.length < maxFiles);

    // Optionally recurse into sub-folders
    if (recursive) {
      const subFolderQ = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const subUrl = `${DRIVE_API}/files?q=${encodeURIComponent(subFolderQ)}&fields=files(id,name)`;
      type FolderList = { files: Array<{ id: string; name: string }> };
      const subFolders = await this.get<FolderList>(subUrl);
      for (const sub of subFolders.files ?? []) {
        if (allFiles.length >= maxFiles) break;
        const subFiles = await this.parseFolder(sub.id, {
          ...options,
          maxFiles: maxFiles - allFiles.length,
          recursive: false, // one level of recursion to avoid deep traversal
        });
        for (const f of subFiles) allFiles.push({ id: f.id, name: f.name, mimeType: f.mimeType });
      }
    }

    const limited = allFiles.slice(0, maxFiles);
    logger.info(`Fetching ${limited.length} files from Google Drive folder`, { folderId });

    // Fetch content in batches of 5
    const results: DriveFile[] = [];
    const batchSize = 5;
    for (let i = 0; i < limited.length; i += batchSize) {
      const batch = limited.slice(i, i + batchSize);
      const fetched = await Promise.allSettled(batch.map((f) => this.parseFile(f.id)));
      for (const r of fetched) {
        if (r.status === 'fulfilled') results.push(r.value);
        else logger.warn('Failed to fetch Drive file', { reason: r.reason });
      }
    }

    return results;
  }
}
