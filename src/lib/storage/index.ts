/**
 * Storage Module
 *
 * Unified interface for file storage operations.
 * Supports local filesystem (development) and S3/MinIO (production).
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Storage Backend Selection
// =============================================================================

const USE_S3 = process.env.S3_ENDPOINT !== undefined && process.env.S3_ENDPOINT !== '';

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
// Bucket Names
// =============================================================================

export const BUCKETS = {
  DOCUMENTS: process.env.S3_BUCKET_DOCUMENTS || 'documents',
  EXPORTS: process.env.S3_BUCKET_EXPORTS || 'exports',
  ATTACHMENTS: process.env.S3_BUCKET_ATTACHMENTS || 'attachments',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// =============================================================================
// Dynamic Import (to avoid loading AWS SDK when not needed)
// =============================================================================

async function getStorageBackend() {
  if (USE_S3) {
    const s3 = await import('./s3-storage');
    return {
      upload: s3.uploadFile,
      download: s3.getFile,
      delete: s3.deleteFile,
      getUrl: s3.getPresignedUrl,
      deletePrefix: s3.deleteDocumentFiles,
      healthCheck: s3.checkS3Health,
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

/**
 * Upload a document file
 */
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

/**
 * Upload an export file
 */
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

/**
 * Upload a chat attachment
 */
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

/**
 * Get file content
 */
export async function getFile(key: string): Promise<Buffer> {
  const backend = await getStorageBackend();
  return backend.download(key);
}

/**
 * Delete a file
 */
export async function deleteFile(key: string): Promise<void> {
  const backend = await getStorageBackend();
  await backend.delete(key);
  logger.info('File deleted', { key });
}

/**
 * Delete all files for a document
 */
export async function deleteDocumentFiles(documentId: string): Promise<void> {
  const prefix = `documents/${documentId}/`;
  const backend = await getStorageBackend();
  await backend.deletePrefix(prefix);
  logger.info('Document files deleted', { documentId });
}

/**
 * Get presigned URL for temporary access
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const backend = await getStorageBackend();
  return backend.getUrl(key, expiresIn);
}

/**
 * Check storage health
 */
export async function checkStorageHealth(): Promise<{
  healthy: boolean;
  backend: 's3' | 'local';
  error?: string;
}> {
  const backend = await getStorageBackend();
  const result = await backend.healthCheck();

  return {
    healthy: result.healthy,
    backend: USE_S3 ? 's3' : 'local',
    error: result.error,
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export * from './s3-storage';
