/**
 * Cloudinary Storage Backend
 *
 * Uses Cloudinary for file storage (documents, exports, attachments, images).
 * Permanent URLs eliminate presigned URL complexity.
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function getConfig(): { cloudName: string; apiKey: string; apiSecret: string } {
  if (CLOUDINARY_URL) {
    const match = CLOUDINARY_URL.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
    if (match) {
      return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
    }
  }
  if (CLOUD_NAME && API_KEY && API_SECRET) {
    return { cloudName: CLOUD_NAME, apiKey: API_KEY, apiSecret: API_SECRET };
  }
  throw new Error(
    'Cloudinary not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.'
  );
}

// =============================================================================
// Upload Operations
// =============================================================================

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  resourceType?: 'raw' | 'image' | 'video' | 'auto';
}

export async function uploadFile(
  key: string,
  data: Buffer,
  options: UploadOptions = {}
): Promise<{ url: string; etag: string }> {
  const { v2: cloudinary } = await import('cloudinary');
  const config = getConfig();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const resourceType = options.resourceType || inferResourceType(key, options.contentType);
  const publicId = keyToPublicId(key);

  const uploadStream = (data: Buffer): Promise<{ secure_url: string; etag?: string }> =>
    new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
          tags: options.metadata?.tags,
          context: options.metadata
            ? Object.fromEntries(
                Object.entries(options.metadata).map(([k, v]) => [`custom.${k}`, v])
              )
            : undefined,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve({ secure_url: result?.secure_url ?? '', etag: result?.etag });
        }
      );
      uploadStream.end(data);
    });

  try {
    const result = await uploadStream(data);
    logger.info('File uploaded to Cloudinary', { key, publicId, resourceType });
    return { url: result.secure_url, etag: result.etag || '' };
  } catch (error) {
    logger.error('Cloudinary upload failed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// =============================================================================
// Download Operations
// =============================================================================

export async function getFile(key: string): Promise<Buffer> {
  const url = await getPresignedUrl(key);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error('Cloudinary download failed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

export async function getPresignedUrl(key: string, _expiresIn = 3600): Promise<string> {
  const { v2: cloudinary } = await import('cloudinary');
  const config = getConfig();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const resourceType = inferResourceType(key);
  const publicId = keyToPublicId(key);

  return (
    cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      sign_url: false,
      secure: true,
    }) || `https://res.cloudinary.com/${config.cloudName}/${resourceType}/upload/${publicId}`
  );
}

// =============================================================================
// Delete Operations
// =============================================================================

export async function deleteFile(key: string): Promise<void> {
  const { v2: cloudinary } = await import('cloudinary');
  const config = getConfig();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const resourceType = inferResourceType(key);
  const publicId = keyToPublicId(key);

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info('File deleted from Cloudinary', { key, publicId });
  } catch (error) {
    logger.error('Cloudinary delete failed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

export async function deleteDocumentFiles(documentId: string): Promise<void> {
  const { v2: cloudinary } = await import('cloudinary');
  const config = getConfig();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const prefix = `rag/documents/${documentId}`;

  try {
    await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'raw' });
    await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'image' });
    logger.info('Document files deleted from Cloudinary', { documentId });
  } catch (error) {
    logger.error('Cloudinary prefix delete failed', {
      documentId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

export async function deleteFilesByPrefix(prefix: string): Promise<void> {
  const { v2: cloudinary } = await import('cloudinary');
  const config = getConfig();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const publicIdPrefix = keyToPublicId(prefix);

  try {
    await cloudinary.api.delete_resources_by_prefix(publicIdPrefix, { resource_type: 'raw' });
    await cloudinary.api.delete_resources_by_prefix(publicIdPrefix, { resource_type: 'image' });
    logger.info('Files deleted by prefix from Cloudinary', { prefix });
  } catch (error) {
    logger.error('Cloudinary prefix delete failed', {
      prefix,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkCloudinaryHealth(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    const { v2: cloudinary } = await import('cloudinary');
    const config = getConfig();

    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });

    await cloudinary.api.ping();
    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function keyToPublicId(key: string): string {
  const normalized = key.replace(/^\/+/, '').replace(/\.{2,}/g, '');
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot > 0) {
    return `rag/${normalized.slice(0, lastDot)}`;
  }
  return `rag/${normalized}`;
}

function inferResourceType(key: string, contentType?: string): 'raw' | 'image' | 'video' {
  if (contentType?.startsWith('image/')) return 'image';
  if (contentType?.startsWith('video/')) return 'video';

  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];

  const lower = key.toLowerCase();
  if (imageExtensions.some((ext) => lower.endsWith(ext))) return 'image';
  if (videoExtensions.some((ext) => lower.endsWith(ext))) return 'video';

  return 'raw';
}
