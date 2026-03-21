/**
 * Export Storage Management
 * Handles temporary file storage with auto-cleanup
 * Supports local filesystem and S3-compatible storage
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

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
      case 's3':
        return this.storeS3(key, filename, buffer, options.mimeType, expiresAt);
      case 'r2':
        return this.storeR2(key, filename, buffer, options.mimeType, expiresAt);
      default:
        return this.storeLocal(key, filename, buffer, options.mimeType, expiresAt);
    }
  }

  /**
   * Retrieve a file
   */
  async retrieveFile(key: string): Promise<Buffer> {
    switch (this.config.type) {
      case 's3':
        return this.retrieveS3(key);
      case 'r2':
        return this.retrieveR2(key);
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
        case 's3':
          return this.getS3FileInfo(key);
        case 'r2':
          return this.getR2FileInfo(key);
        default:
          return this.getLocalFileInfo(key);
      }
    } catch {
      return null;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      switch (this.config.type) {
        case 's3':
          return this.deleteS3(key);
        case 'r2':
          return this.deleteR2(key);
        default:
          return this.deleteLocal(key);
      }
    } catch {
      return false;
    }
  }

  /**
   * Generate a download URL
   */
  async getDownloadUrl(key: string, expiryMinutes = 60): Promise<string | null> {
    const fileInfo = await this.getFileInfo(key);
    if (!fileInfo) return null;

    switch (this.config.type) {
      case 's3':
        return this.getS3DownloadUrl(key, expiryMinutes);
      case 'r2':
        return this.getR2DownloadUrl(key, expiryMinutes);
      default:
        // For local storage, return a relative path that can be served
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
        case 's3':
          return this.cleanupS3Expired();
        case 'r2':
          return this.cleanupR2Expired();
        default:
          return this.cleanupLocalExpired();
      }
    } catch (_error) {
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
    } catch {
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
      } catch (_error) {
        result.errors++;
      }
    }

    return result;
  }

  // =============================================================================
  // S3 Storage Implementation (Placeholder)
  // =============================================================================

  private async storeS3(
    key: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    expiresAt: Date
  ): Promise<StoredFile> {
    return this.storeLocal(key, filename, buffer, mimeType, expiresAt);
  }

  private async retrieveS3(key: string): Promise<Buffer> {
    return this.retrieveLocal(key);
  }

  private async getS3FileInfo(key: string): Promise<StoredFile | null> {
    return this.getLocalFileInfo(key);
  }

  private async deleteS3(key: string): Promise<boolean> {
    return this.deleteLocal(key);
  }

  private async getS3DownloadUrl(_key: string, _expiryMinutes: number): Promise<string | null> {
    return null;
  }

  private async cleanupS3Expired(): Promise<{ deleted: number; errors: number }> {
    return { deleted: 0, errors: 0 };
  }

  // =============================================================================
  // R2 Storage Implementation (Placeholder)
  // =============================================================================

  private async storeR2(
    key: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    expiresAt: Date
  ): Promise<StoredFile> {
    return this.storeLocal(key, filename, buffer, mimeType, expiresAt);
  }

  private async retrieveR2(key: string): Promise<Buffer> {
    return this.retrieveLocal(key);
  }

  private async getR2FileInfo(key: string): Promise<StoredFile | null> {
    return this.getLocalFileInfo(key);
  }

  private async deleteR2(key: string): Promise<boolean> {
    return this.deleteLocal(key);
  }

  private async getR2DownloadUrl(_key: string, _expiryMinutes: number): Promise<string | null> {
    return null;
  }

  private async cleanupR2Expired(): Promise<{ deleted: number; errors: number }> {
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
