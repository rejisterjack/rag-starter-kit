/**
 * Google Drive Integration
 * Import documents from Google Drive for RAG ingestion
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink?: string;
  size?: string;
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
  incompleteSearch?: boolean;
}

// =============================================================================
// Google Drive API Client
// =============================================================================

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DOCS_MIME = 'application/vnd.google-apps.document';
const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';
const SLIDES_MIME = 'application/vnd.google-apps.presentation';

class GoogleDriveClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options?: { method?: string; responseType?: 'json' | 'text' }
  ): Promise<T> {
    const response = await fetch(`${DRIVE_API_BASE}${endpoint}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Google Drive API error (${response.status}): ${errorText}`);
    }

    if (
      options?.responseType === 'text' ||
      response.headers.get('content-type')?.includes('text/')
    ) {
      return response.text() as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * List files in Google Drive
   */
  async listFiles(query?: string, pageToken?: string): Promise<DriveListResponse> {
    const params = new URLSearchParams({
      pageSize: '100',
      fields:
        'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size),nextPageToken,incompleteSearch',
      orderBy: 'modifiedByMeTime desc',
    });

    if (query) {
      params.set('q', query);
    }

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    return this.request<DriveListResponse>(`/files?${params.toString()}`);
  }

  /**
   * Export a Google Workspace file as plain text
   */
  async exportFile(fileId: string, mimeType: string): Promise<string> {
    const params = new URLSearchParams({ mimeType });
    return this.request<string>(`/files/${fileId}/export?${params.toString()}`, {
      responseType: 'text',
    });
  }

  /**
   * Download a regular file's content
   */
  async downloadFile(fileId: string): Promise<string> {
    return this.request<string>(`/files/${fileId}?alt=media`, {
      responseType: 'text',
    });
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * List files from Google Drive
 */
export async function listFiles(accessToken: string, query?: string): Promise<DriveFile[]> {
  const client = new GoogleDriveClient(accessToken);
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await client.listFiles(query, pageToken);
    allFiles.push(...response.files);
    pageToken = response.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Export a Google Workspace document as plain text
 */
export async function exportFile(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  const client = new GoogleDriveClient(accessToken);
  return client.exportFile(fileId, mimeType);
}

/**
 * Get file content — handles Google Workspace docs, plain text, markdown, and PDFs
 */
export async function getFileContent(accessToken: string, file: DriveFile): Promise<string> {
  const client = new GoogleDriveClient(accessToken);

  // Google Docs — export as plain text
  if (file.mimeType === DOCS_MIME) {
    return client.exportFile(file.id, 'text/plain');
  }

  // Google Sheets — export as CSV (best text representation)
  if (file.mimeType === SHEETS_MIME) {
    const csv = await client.exportFile(file.id, 'text/csv');
    return csvToPlainText(csv, file.name);
  }

  // Google Slides — export as plain text
  if (file.mimeType === SLIDES_MIME) {
    return client.exportFile(file.id, 'text/plain');
  }

  // Plain text / markdown files — download directly
  if (
    file.mimeType === 'text/plain' ||
    file.mimeType === 'text/markdown' ||
    file.mimeType === 'text/x-markdown'
  ) {
    return client.downloadFile(file.id);
  }

  // PDF — export as plain text (best effort via Drive API)
  if (file.mimeType === 'application/pdf') {
    try {
      return client.exportFile(file.id, 'text/plain');
    } catch (error: unknown) {
      logger.warn('Could not extract text from PDF via Drive API', {
        fileId: file.id,
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return `[PDF file: ${file.name} — text extraction not available via API]`;
    }
  }

  // Other types — attempt download, skip binary
  if (isTextMimeType(file.mimeType)) {
    return client.downloadFile(file.id);
  }

  logger.info('Skipping unsupported file type', {
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
  });

  return `[Unsupported file type: ${file.mimeType} — file: ${file.name}]`;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert CSV content to a readable plain-text representation
 */
function csvToPlainText(csv: string, fileName: string): string {
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  let output = `# ${fileName}\n\n`;

  if (lines.length === 0) return output;

  // First row is typically the header
  const headers = parseCsvRow(lines[0]);
  output += `Columns: ${headers.join(', ')}\n\n`;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    for (let j = 0; j < headers.length && j < values.length; j++) {
      output += `${headers[j]}: ${values[j]}\n`;
    }
    output += '\n';
  }

  return output;
}

/**
 * Parse a single CSV row (simple implementation)
 */
function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of row) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Check if a MIME type represents a text-based file
 */
function isTextMimeType(mimeType: string): boolean {
  const textTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-yaml',
  ];
  return textTypes.some((type) => mimeType.startsWith(type));
}

export default { listFiles, exportFile, getFileContent };
