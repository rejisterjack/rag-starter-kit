/**
 * Batch Operations
 *
 * Efficient bulk operations for vector data stored in PostgreSQL + pgvector.
 */

import { logger } from '@/lib/logger';
import {
  type ChunkPointData,
  deleteByDocumentId,
  deleteChunksByIds,
  listChunksByDocumentId,
  type UpsertOptions,
  updateChunkEmbeddings,
  updateChunkFields,
  upsertChunks,
} from '@/lib/vector';

// ============================================================================
// Types
// ============================================================================

export interface ChunkInsertData {
  id?: string;
  documentId: string;
  content: string;
  embedding: number[];
  index: number;
  start?: number;
  end?: number;
  page?: number;
  section?: string;
}

export interface BatchInsertOptions {
  /** Batch size for inserts (default: 100) */
  batchSize?: number;
  /** Delay between batches in ms (default: 0) */
  batchDelayMs?: number;
  /** Continue on error (default: true) */
  continueOnError?: boolean;
  /** Enable progress callback */
  onProgress?: (completed: number, total: number) => void;
}

export interface BatchInsertResult {
  /** Number of successfully inserted chunks */
  successCount: number;
  /** Number of failed chunks */
  failureCount: number;
  /** Errors by batch index */
  errors: Array<{ batchIndex: number; error: string }>;
  /** Total processing time in ms */
  durationMs: number;
}

export interface BulkUpdateResult {
  /** Number of successfully updated chunks */
  successCount: number;
  /** Number of failed updates */
  failureCount: number;
  /** Errors */
  errors: Array<{ chunkId: string; error: string }>;
}

/** Metadata required for chunk upsert operations */
export interface DocumentMetadata {
  userId: string;
  workspaceId?: string;
  documentName: string;
  documentType: string;
}

// ============================================================================
// Batch Insert Operations
// ============================================================================

/**
 * Insert document chunks in batches via pgvector
 *
 * This is the recommended way to insert large numbers of chunks as it:
 * - Prevents memory issues
 * - Handles partial failures gracefully
 * - Provides progress tracking
 * - Uses batched SQL upserts for throughput
 */
export async function batchInsertChunks(
  chunks: ChunkInsertData[],
  metadata: DocumentMetadata,
  options: BatchInsertOptions = {}
): Promise<BatchInsertResult> {
  const { onProgress } = options;
  const startTime = Date.now();

  // Map ChunkInsertData[] to ChunkPointData[] expected by upsertChunks
  const pointData: ChunkPointData[] = chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    embedding: chunk.embedding,
    index: chunk.index,
    start: chunk.start,
    end: chunk.end,
    page: chunk.page,
    section: chunk.section,
  }));

  const upsertOptions: UpsertOptions = {
    userId: metadata.userId,
    workspaceId: metadata.workspaceId,
    documentName: metadata.documentName,
    documentType: metadata.documentType,
    batchSize: options.batchSize,
    onProgress,
  };

  const result = await upsertChunks(pointData, upsertOptions);

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
    errors: result.errors,
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// Batch Update Operations
// ============================================================================

/**
 * Update embeddings for existing chunks in batches
 */
export async function batchUpdateEmbeddings(
  _prisma: unknown,
  updates: Array<{ chunkId: string; embedding: number[] }>,
  options: BatchInsertOptions = {}
): Promise<BulkUpdateResult> {
  const { batchSize = 100, continueOnError = true } = options;

  const errors: Array<{ chunkId: string; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    try {
      await updateChunkEmbeddings(batch);
      successCount += batch.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      for (const update of batch) {
        failureCount++;
        errors.push({ chunkId: update.chunkId, error: msg });
      }
      if (!continueOnError) break;
    }
  }

  return { successCount, failureCount, errors };
}

/**
 * Update chunk content and embeddings in batches
 */
export async function batchUpdateChunks(
  _prisma: unknown,
  updates: Array<{
    chunkId: string;
    content?: string;
    embedding?: number[];
    page?: number;
    section?: string;
  }>,
  options: BatchInsertOptions = {}
): Promise<BulkUpdateResult> {
  const { batchSize = 100, continueOnError = true } = options;

  const errors: Array<{ chunkId: string; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    try {
      const { updated, missing } = await updateChunkFields(batch);
      successCount += updated.length;
      for (const chunkId of missing) {
        failureCount++;
        errors.push({ chunkId, error: 'Chunk not found' });
      }
      if (missing.length > 0 && !continueOnError) break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      for (const update of batch) {
        failureCount++;
        errors.push({ chunkId: update.chunkId, error: msg });
      }
      if (!continueOnError) break;
    }
  }

  return { successCount, failureCount, errors };
}

// ============================================================================
// Batch Delete Operations
// ============================================================================

/**
 * Delete chunks in batches by point IDs
 */
export async function batchDeleteChunks(
  _prisma: unknown,
  chunkIds: string[],
  options: BatchInsertOptions = {}
): Promise<{ successCount: number; failureCount: number }> {
  const { batchSize = 500 } = options;

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < chunkIds.length; i += batchSize) {
    const batch = chunkIds.slice(i, i + batchSize);

    try {
      await deleteChunksByIds(batch);
      successCount += batch.length;
    } catch (error) {
      logger.error('Failed to delete batch of chunks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failureCount += batch.length;
    }
  }

  return { successCount, failureCount };
}

/**
 * Delete all chunks for multiple documents
 */
export async function batchDeleteDocumentChunks(
  _prisma: unknown,
  documentIds: string[]
): Promise<{ successCount: number; deletedChunks: number }> {
  let totalDeleted = 0;

  for (const documentId of documentIds) {
    try {
      const deleted = await deleteByDocumentId(documentId);
      totalDeleted += deleted;
    } catch (error) {
      logger.error('Failed to delete chunks for document', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    successCount: documentIds.length,
    deletedChunks: totalDeleted,
  };
}

// ============================================================================
// Streaming Operations
// ============================================================================

/**
 * Process chunks in a streaming fashion using offset pagination.
 */
export async function streamProcessChunks<T>(
  _prisma: unknown,
  documentId: string,
  processor: (chunks: Array<{ id: string; content: string; index: number }>) => Promise<T[]>,
  options: { batchSize?: number; onProgress?: (processed: number) => void } = {}
): Promise<T[]> {
  const { batchSize = 100, onProgress } = options;
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const chunks = await listChunksByDocumentId(documentId, { limit: batchSize, offset });
    if (chunks.length === 0) break;

    const batchResults = await processor(chunks);
    results.push(...batchResults);
    onProgress?.(results.length);

    if (chunks.length < batchSize) break;
    offset += batchSize;
  }

  return results;
}

// ============================================================================
// Validation Operations
// ============================================================================

/**
 * Validate chunks before insertion
 */
export function validateChunks(chunks: ChunkInsertData[]): {
  valid: ChunkInsertData[];
  invalid: Array<{ chunk: ChunkInsertData; reason: string }>;
} {
  const valid: ChunkInsertData[] = [];
  const invalid: Array<{ chunk: ChunkInsertData; reason: string }> = [];

  for (const chunk of chunks) {
    const reasons: string[] = [];

    if (!chunk.documentId) {
      reasons.push('Missing documentId');
    }

    if (!chunk.content || chunk.content.trim().length === 0) {
      reasons.push('Empty content');
    }

    if (!chunk.embedding || chunk.embedding.length === 0) {
      reasons.push('Missing or empty embedding');
    }

    if (typeof chunk.index !== 'number' || chunk.index < 0) {
      reasons.push('Invalid index');
    }

    if (reasons.length > 0) {
      invalid.push({ chunk, reason: reasons.join(', ') });
    } else {
      valid.push(chunk);
    }
  }

  return { valid, invalid };
}

/**
 * Check for duplicate chunks
 */
export function findDuplicates(chunks: ChunkInsertData[]): {
  duplicates: Array<{ content: string; indices: number[] }>;
  unique: ChunkInsertData[];
} {
  const contentMap = new Map<string, number[]>();

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i]?.content.trim() ?? '';
    const indices = contentMap.get(content) ?? [];
    indices.push(i);
    contentMap.set(content, indices);
  }

  const duplicates: Array<{ content: string; indices: number[] }> = [];
  const uniqueIndices = new Set<number>();

  for (const [content, indices] of contentMap.entries()) {
    if (indices.length > 1) {
      duplicates.push({ content, indices });
    }
    uniqueIndices.add(indices[0] ?? 0);
  }

  const unique = Array.from(uniqueIndices)
    .sort((a, b) => a - b)
    .map((i) => chunks[i])
    .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== undefined);

  return { duplicates, unique };
}
