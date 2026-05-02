/**
 * Local Filesystem Storage Backend
 *
 * Used for development when S3 is not configured.
 */

import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || './storage';

// =============================================================================
// Path Helpers
// =============================================================================

function getFilePath(key: string): string {
  // Sanitize key to prevent directory traversal
  const sanitized = key.replace(/\.{2,}/g, '').replace(/^\/+/, '');
  return join(STORAGE_DIR, sanitized);
}

// =============================================================================
// Upload Operations
// =============================================================================

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export async function uploadFile(
  key: string,
  data: Buffer | Readable,
  options: UploadOptions = {}
): Promise<{ url: string; etag: string; size: number }> {
  const filePath = getFilePath(key);
  const dir = dirname(filePath);

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Write metadata file alongside
  const metadataPath = `${filePath}.meta.json`;
  const metadata = {
    contentType: options.contentType || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    ...options.metadata,
  };

  // Handle Buffer vs Stream
  let buffer: Buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  }

  // Write file and metadata
  await Promise.all([
    writeFile(filePath, buffer),
    writeFile(metadataPath, JSON.stringify(metadata, null, 2)),
  ]);

  const etag = Buffer.from(buffer).toString('base64').slice(0, 16);

  logger.debug('File saved locally', { key, path: filePath, size: buffer.length });

  return {
    url: `/api/storage/${key}`,
    etag,
    size: buffer.length,
  };
}

// =============================================================================
// Download Operations
// =============================================================================

export async function getFile(key: string): Promise<Buffer> {
  const filePath = getFilePath(key);

  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${key}`);
    }
    throw error;
  }
}

export async function getFileStream(key: string): Promise<Readable> {
  const filePath = getFilePath(key);
  return createReadStream(filePath);
}

export async function getFileUrl(key: string): Promise<string> {
  return `/api/storage/${key}`;
}

// =============================================================================
// Metadata Operations
// =============================================================================

export async function getMetadata(key: string): Promise<Record<string, string> | null> {
  const metadataPath = `${getFilePath(key)}.meta.json`;

  try {
    const content = await readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: unknown) {
    logger.debug('Failed to read local storage metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// =============================================================================
// Delete Operations
// =============================================================================

export async function deleteFile(key: string): Promise<void> {
  const filePath = getFilePath(key);
  const metadataPath = `${filePath}.meta.json`;

  try {
    await Promise.all([rm(filePath, { force: true }), rm(metadataPath, { force: true })]);
    logger.debug('Local file deleted', { key });
  } catch (error) {
    logger.error('Failed to delete local file', { key, error });
    throw error;
  }
}

export async function deleteFilesByPrefix(prefix: string): Promise<void> {
  const dirPath = getFilePath(prefix);

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(prefix, entry.name));

    await Promise.all(files.map((file) => deleteFile(file)));

    // Try to remove the directory
    try {
      await rm(dirPath, { recursive: true, force: true });
    } catch (error: unknown) {
      logger.debug('Failed to remove directory during prefix cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.debug('Local files deleted by prefix', { prefix, count: files.length });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Directory doesn't exist, nothing to delete
      return;
    }
    throw error;
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkLocalStorageHealth(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    await mkdir(STORAGE_DIR, { recursive: true });

    // Test write
    const testFile = join(STORAGE_DIR, '.health-check');
    await writeFile(testFile, 'ok');
    await readFile(testFile);
    await rm(testFile);

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
