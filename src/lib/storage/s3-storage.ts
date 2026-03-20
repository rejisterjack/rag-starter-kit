/**
 * S3/R2 Object Storage Backend
 *
 * Supports AWS S3, Cloudflare R2, and MinIO for file storage.
 * Handles uploads, downloads, presigned URLs, and lifecycle management.
 */

import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'rag-documents';

// =============================================================================
// S3 Client
// =============================================================================

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY || '',
        secretAccessKey: S3_SECRET_KEY || '',
      },
      forcePathStyle: true, // Required for R2/MinIO
    });
  }
  return s3Client;
}

// =============================================================================
// Upload Operations
// =============================================================================

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  expiresIn?: number; // Seconds for presigned URL
}

/**
 * Upload file to S3/R2
 */
export async function uploadFile(
  key: string,
  data: Buffer | ReadableStream | Readable,
  options: UploadOptions = {}
): Promise<{ url: string; etag: string }> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: data,
    ContentType: options.contentType || 'application/octet-stream',
    Metadata: options.metadata,
  });

  try {
    const response = (await client.send(command)) as { ETag?: string };

    const url = S3_ENDPOINT
      ? `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
      : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

    logger.info('File uploaded to S3', { key, bucket: S3_BUCKET });

    return {
      url,
      etag: response.ETag || '',
    };
  } catch (error) {
    logger.error('S3 upload failed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Upload document from buffer
 */
export async function uploadDocument(
  documentId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ url: string; storageKey: string }> {
  const key = `documents/${documentId}/${filename}`;

  const result = await uploadFile(key, buffer, {
    contentType,
    metadata: {
      documentId,
      filename,
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    url: result.url,
    storageKey: key,
  };
}

// =============================================================================
// Download Operations
// =============================================================================

/**
 * Get file from S3
 */
export async function getFile(key: string): Promise<Buffer> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    const response = (await client.send(command)) as {
      Body?: Readable;
      ETag?: string;
      Contents?: Array<{ Key?: string }>;
    };

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const stream = response.Body;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (error) {
    logger.error('S3 get failed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Generate presigned URL for temporary access
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    logger.error('Failed to generate presigned URL', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// =============================================================================
// Delete Operations
// =============================================================================

/**
 * Delete file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    await client.send(command);
    logger.info('File deleted from S3', { key });
  } catch (error) {
    logger.error('S3 delete failed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Delete all files for a document
 */
export async function deleteDocumentFiles(documentId: string): Promise<void> {
  const prefix = `documents/${documentId}/`;

  const client = getS3Client();

  // List objects
  const listCommand = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  });

  try {
    const response = (await client.send(listCommand)) as { Contents?: Array<{ Key?: string }> };

    if (response.Contents) {
      // Delete all objects
      await Promise.all(
        response.Contents.map((obj: { Key?: string }) =>
          obj.Key ? deleteFile(obj.Key) : Promise.resolve()
        )
      );
    }

    logger.info('Document files deleted', { documentId, count: response.Contents?.length || 0 });
  } catch (error) {
    logger.error('Failed to delete document files', {
      documentId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkS3Health(): Promise<{
  healthy: boolean;
  bucket: string;
  error?: string;
}> {
  try {
    const client = getS3Client();

    // Try to list objects (limited to 1)
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      MaxKeys: 1,
    });

    await client.send(command);

    return {
      healthy: true,
      bucket: S3_BUCKET,
    };
  } catch (error) {
    return {
      healthy: false,
      bucket: S3_BUCKET,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
