/**
 * Export Storage Management
 * Handles temporary file storage with auto-cleanup
 * Supports local filesystem and S3-compatible storage
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '@/lib/logger';

import type { StorageConfig, StoredFile } from './types';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_LOCAL_PATH = process.env.EXPORT_STORAGE_PATH ?? './tmp/exports';
const DEFAULT_EXPIRY_HOURS = 24;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Storage Manager
// =============================================================================

export class ExportStorage {
  private config: StorageConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      type: 'local',
      localPath: DEFAULT_LOCAL_PATH,
      ...config,
    };

    // Start cleanup scheduler
    this.startCleanupScheduler();
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    if (this.config.type === 'local') {
      const path = this.config.localPath ?? DEFAULT_LOCAL_PATH;
      if (!existsSync(path)) {
        await mkdir(path, { recursive: true });
      }
    }
  }

  /**
   * Store a file from buffer
   */
  async storeFile(
    buffer: Buffer,
    options: {
      filename?: string;
      mimeType: string;
      expiresInHours?: number;
    }
  ): Promise<StoredFile> {
    const key = uuidv4();
    const filename = options.filename ?? `${key}.${this.getExtension(options.mimeType)}`;
    const expiresAt = new Date(
      Date.now() + (options.expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000
    );

    switch (this.config.type) {
      case 'cloudinary':
        return this.storeCloudinary(key, filename, buffer, options.mimeType, expiresAt);
      default:
        return this.storeLocal(key, filename, buffer, options.mimeType, expiresAt);
    }
  }

  /**
   * Retrieve a file
   */
  async retrieveFile(key: string): Promise<Buffer> {
    switch (this.config.type) {
      case 'cloudinary':
        return this.retrieveCloudinary(key);
      default:
        return this.retrieveLocal(key);
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(key: string): Promise<StoredFile | null> {
    try {
      switch (this.config.type) {
        case 'cloudinary':
          return this.getCloudinaryFileInfo(key);
        default:
          return this.getLocalFileInfo(key);
      }
    } catch (error: unknown) {
      logger.error('Failed to get file info', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      switch (this.config.type) {
        case 'cloudinary':
          return this.deleteCloudinary(key);
        default:
          return this.deleteLocal(key);
      }
    } catch (error: unknown) {
      logger.error('Failed to delete file', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generate a download URL
   */
  async getDownloadUrl(key: string, _expiryMinutes = 60): Promise<string | null> {
    const fileInfo = await this.getFileInfo(key);
    if (!fileInfo) return null;

    switch (this.config.type) {
      case 'cloudinary':
        return this.getCloudinaryDownloadUrl(key);
      default:
        return `/api/export/download/${key}`;
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpired(): Promise<{ deleted: number; errors: number }> {
    const result = { deleted: 0, errors: 0 };

    try {
      switch (this.config.type) {
        case 'cloudinary':
          return this.cleanupCloudinaryExpired();
        default:
          return this.cleanupLocalExpired();
      }
    } catch (error: unknown) {
      logger.error('Failed to cleanup expired files', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.errors++;
      return result;
    }
  }

  /**
   * Dispose of the storage manager
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // =============================================================================
  // Local Storage Implementation
  // =============================================================================

  private async storeLocal(
    key: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    expiresAt: Date
  ): Promise<StoredFile> {
    const basePath = this.config.localPath ?? DEFAULT_LOCAL_PATH;
    const filePath = join(basePath, key);

    await mkdir(basePath, { recursive: true });
    await writeFile(filePath, buffer);

    // Store metadata
    const metadataPath = `${filePath}.meta.json`;
    const metadata = {
      key,
      filename,
      mimeType,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };
    await writeFile(metadataPath, JSON.stringify(metadata));

    return {
      key,
      path: filePath,
      size: buffer.length,
      mimeType,
      createdAt: new Date(),
      expiresAt,
    };
  }

  private async retrieveLocal(key: string): Promise<Buffer> {
    const basePath = this.config.localPath ?? DEFAULT_LOCAL_PATH;
    const filePath = join(basePath, key);
    return readFile(filePath);
  }

  private async getLocalFileInfo(key: string): Promise<StoredFile> {
    const basePath = this.config.localPath ?? DEFAULT_LOCAL_PATH;
    const filePath = join(basePath, key);
    const metadataPath = `${filePath}.meta.json`;

    const [stats, metadataRaw] = await Promise.all([
      stat(filePath),
      readFile(metadataPath, 'utf-8'),
    ]);

    const metadata = JSON.parse(metadataRaw);

    return {
      key,
      path: filePath,
      size: stats.size,
      mimeType: metadata.mimeType,
      createdAt: new Date(metadata.createdAt),
      expiresAt: new Date(metadata.expiresAt),
    };
  }

  private async deleteLocal(key: string): Promise<boolean> {
    const basePath = this.config.localPath ?? DEFAULT_LOCAL_PATH;
    const filePath = join(basePath, key);
    const metadataPath = `${filePath}.meta.json`;

    try {
      await unlink(filePath);
      await unlink(metadataPath).catch(() => {}); // Ignore metadata delete errors
      return true;
    } catch (error: unknown) {
      logger.error('Failed to delete local file', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private async cleanupLocalExpired(): Promise<{ deleted: number; errors: number }> {
    const basePath = this.config.localPath ?? DEFAULT_LOCAL_PATH;
    const result = { deleted: 0, errors: 0 };

    if (!existsSync(basePath)) {
      return result;
    }

    const files = await readdir(basePath);
    const now = new Date();

    for (const file of files) {
      if (!file.endsWith('.meta.json')) continue;

      try {
        const metadataPath = join(basePath, file);
        const metadataRaw = await readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataRaw);

        if (new Date(metadata.expiresAt) < now) {
          const key = metadata.key;
          await this.deleteLocal(key);
          result.deleted++;
        }
      } catch (error: unknown) {
        logger.error('Failed to process expired file during cleanup', {
          file,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.errors++;
      }
    }

    return result;
  }

  // =============================================================================
  // Cloudinary Storage Implementation
  // =============================================================================

  private async storeCloudinary(
    key: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    expiresAt: Date
  ): Promise<StoredFile> {
    const { uploadFile } = await import('@/lib/storage/cloudinary-storage');
    const storageKey = `exports/${key}/${filename}`;
    const result = await uploadFile(storageKey, buffer, {
      contentType: mimeType,
      metadata: { exportKey: key, expiresAt: expiresAt.toISOString() },
    });

    return {
      key,
      path: result.url,
      size: buffer.length,
      mimeType,
      createdAt: new Date(),
      expiresAt,
      url: result.url,
    };
  }

  private async retrieveCloudinary(key: string): Promise<Buffer> {
    const { getFile } = await import('@/lib/storage/cloudinary-storage');
    return getFile(`exports/${key}`);
  }

  private async getCloudinaryFileInfo(_key: string): Promise<StoredFile | null> {
    return null;
  }

  private async deleteCloudinary(key: string): Promise<boolean> {
    try {
      const { deleteFile } = await import('@/lib/storage/cloudinary-storage');
      await deleteFile(`exports/${key}`);
      return true;
    } catch {
      return false;
    }
  }

  private async getCloudinaryDownloadUrl(key: string): Promise<string | null> {
    const { getPresignedUrl } = await import('@/lib/storage/cloudinary-storage');
    return getPresignedUrl(`exports/${key}`);
  }

  private async cleanupCloudinaryExpired(): Promise<{ deleted: number; errors: number }> {
    return { deleted: 0, errors: 0 };
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/markdown': 'md',
      'text/html': 'html',
      'application/json': 'json',
      'application/zip': 'zip',
      'text/plain': 'txt',
    };
    return extensions[mimeType] ?? 'bin';
  }

  private startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      const result = await this.cleanupExpired();
      if (result.deleted > 0) {
      }
    }, CLEANUP_INTERVAL_MS);

    // Initial cleanup
    // biome-ignore lint/suspicious/noConsole: Error handling for background cleanup
    this.cleanupExpired().catch(console.error);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let storageInstance: ExportStorage | null = null;

export function getExportStorage(config?: Partial<StorageConfig>): ExportStorage {
  if (!storageInstance) {
    storageInstance = new ExportStorage(config);
  }
  return storageInstance;
}

export function resetExportStorage(): void {
  if (storageInstance) {
    storageInstance.dispose();
    storageInstance = null;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a filename for export
 */
export function generateExportFilename(
  format: string,
  conversationTitle?: string,
  timestamp?: Date
): string {
  const date = timestamp ?? new Date();
  const dateStr = date.toISOString().split('T')[0];
  const sanitizedTitle =
    conversationTitle
      ?.replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30) ?? 'export';

  const extensions: Record<string, string> = {
    pdf: 'pdf',
    word: 'docx',
    markdown: 'md',
    html: 'html',
    json: 'json',
  };

  const ext = extensions[format] ?? 'bin';
  return `${sanitizedTitle}-${dateStr}.${ext}`;
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    markdown: 'text/markdown',
    html: 'text/html',
    json: 'application/json',
    zip: 'application/zip',
  };
  return mimeTypes[format] ?? 'application/octet-stream';
}

/**
 * Calculate file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
