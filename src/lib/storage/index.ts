/**
 * Storage Module
 *
 * Unified interface for file storage operations.
 * Supports Cloudinary (production) and local filesystem (development).
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Storage Backend Selection
// =============================================================================

const USE_CLOUDINARY =
  !!process.env.CLOUDINARY_URL ||
  !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

// =============================================================================
// Types
// =============================================================================

export interface StorageConfig {
  bucket?: string;
  prefix?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  key: string;
  etag?: string;
  size: number;
}

export interface StorageFile {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

// =============================================================================
// Bucket Names (kept for backwards compatibility)
// =============================================================================

export const BUCKETS = {
  DOCUMENTS: 'documents',
  EXPORTS: 'exports',
  ATTACHMENTS: 'attachments',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// =============================================================================
// Dynamic Import
// =============================================================================

async function getStorageBackend() {
  if (USE_CLOUDINARY) {
    const cloudinary = await import('./cloudinary-storage');
    return {
      upload: cloudinary.uploadFile,
      download: cloudinary.getFile,
      delete: cloudinary.deleteFile,
      getUrl: cloudinary.getPresignedUrl,
      deletePrefix: cloudinary.deleteFilesByPrefix,
      healthCheck: cloudinary.checkCloudinaryHealth,
    };
  }

  // Local filesystem fallback
  const local = await import('./local-storage');
  return {
    upload: local.uploadFile,
    download: local.getFile,
    delete: local.deleteFile,
    getUrl: local.getFileUrl,
    deletePrefix: local.deleteFilesByPrefix,
    healthCheck: local.checkLocalStorageHealth,
  };
}

// =============================================================================
// High-Level Storage Operations
// =============================================================================

export async function uploadDocument(
  documentId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const key = `documents/${documentId}/${fileName}`;
  const backend = await getStorageBackend();

  const result = await backend.upload(key, buffer, {
    contentType,
    metadata: {
      ...metadata,
      documentId,
      uploadedAt: new Date().toISOString(),
    },
  });

  logger.info('Document uploaded', { documentId, fileName, size: buffer.length });

  return {
    url: result.url,
    key,
    etag: result.etag,
    size: buffer.length,
  };
}

export async function uploadExport(
  exportId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  const key = `exports/${exportId}/${fileName}`;
  const backend = await getStorageBackend();

  const result = await backend.upload(key, buffer, {
    contentType,
    metadata: {
      exportId,
      exportedAt: new Date().toISOString(),
    },
  });

  logger.info('Export uploaded', { exportId, fileName, size: buffer.length });

  return {
    url: result.url,
    key,
    etag: result.etag,
    size: buffer.length,
  };
}

export async function uploadAttachment(
  messageId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  userId: string
): Promise<UploadResult> {
  const key = `attachments/${messageId}/${fileName}`;
  const backend = await getStorageBackend();

  const result = await backend.upload(key, buffer, {
    contentType,
    metadata: {
      messageId,
      userId,
      uploadedAt: new Date().toISOString(),
    },
  });

  logger.info('Attachment uploaded', { messageId, fileName, size: buffer.length });

  return {
    url: result.url,
    key,
    etag: result.etag,
    size: buffer.length,
  };
}

export async function getFile(key: string): Promise<Buffer> {
  const backend = await getStorageBackend();
  return backend.download(key);
}

export async function deleteFile(key: string): Promise<void> {
  const backend = await getStorageBackend();
  await backend.delete(key);
  logger.info('File deleted', { key });
}

export async function deleteDocumentFiles(documentId: string): Promise<void> {
  const prefix = `documents/${documentId}/`;
  const backend = await getStorageBackend();
  await backend.deletePrefix(prefix);
  logger.info('Document files deleted', { documentId });
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const backend = await getStorageBackend();
  return backend.getUrl(key, expiresIn);
}

export async function checkStorageHealth(): Promise<{
  healthy: boolean;
  backend: 'cloudinary' | 'local';
  error?: string;
}> {
  const backend = await getStorageBackend();
  const result = await backend.healthCheck();

  return {
    healthy: result.healthy,
    backend: USE_CLOUDINARY ? 'cloudinary' : 'local',
    error: result.error,
  };
}
