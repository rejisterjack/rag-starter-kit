/**
 * Batch Operations
 *
 * Efficient bulk insert operations for vector data.
 * Optimized for high-throughput scenarios.
 */

import type { DocumentChunk } from '@prisma/client';
import { Prisma, type PrismaClient } from '@prisma/client';

// Type for transaction client
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type PrismaClientOrTransaction = PrismaClient | PrismaTransactionClient;

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
  /** Use transaction per batch (default: true) */
  useTransaction?: boolean;
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

// ============================================================================
// Batch Insert Operations
// ============================================================================

/**
 * Insert document chunks in batches
 *
 * This is the recommended way to insert large numbers of chunks as it:
 * - Prevents memory issues
 * - Handles partial failures gracefully
 * - Provides progress tracking
 * - Uses transactions for consistency
 */
export async function batchInsertChunks(
  prisma: PrismaClient,
  chunks: ChunkInsertData[],
  options: BatchInsertOptions = {}
): Promise<BatchInsertResult> {
  const {
    batchSize = 100,
    batchDelayMs = 0,
    continueOnError = true,
    useTransaction = true,
    onProgress,
  } = options;

  const startTime = Date.now();
  const errors: Array<{ batchIndex: number; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  // Process in batches
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    try {
      if (useTransaction) {
        await prisma.$transaction(async (tx) => {
          await insertBatch(tx, batch);
        });
      } else {
        await insertBatch(prisma, batch);
      }

      successCount += batch.length;
    } catch (error) {
      failureCount += batch.length;
      errors.push({
        batchIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (!continueOnError) {
        break;
      }
    }

    // Report progress
    onProgress?.(Math.min(i + batchSize, chunks.length), chunks.length);

    // Delay between batches if specified
    if (batchDelayMs > 0 && i + batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  return {
    successCount,
    failureCount,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Insert a single batch of chunks
 */
async function insertBatch(
  client: PrismaClientOrTransaction,
  chunks: ChunkInsertData[]
): Promise<void> {
  // Build values for bulk insert
  const values = chunks.map((chunk) => {
    const id = chunk.id ?? crypto.randomUUID();
    return {
      id,
      document_id: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      index: chunk.index,
      start: chunk.start ?? 0,
      end: chunk.end ?? chunk.content.length,
      page: chunk.page ?? null,
      section: chunk.section ?? null,
    };
  });

  // Use unnest for efficient bulk insert
  const query = Prisma.sql`
    INSERT INTO document_chunks (
      id, document_id, content, embedding, "index", 
      start, "end", page, section, created_at
    )
    SELECT 
      v.id, v.document_id, v.content, v.embedding::vector, v.index,
      v.start, v.end, v.page, v.section, NOW()
    FROM UNNEST(
      ${Prisma.raw(`ARRAY[${values.map((v) => `'${v.id}'`).join(',')}]::uuid[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => `'${v.document_id}'`).join(',')}]::text[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => `'${v.content.replace(/'/g, "''")}'`).join(',')}]::text[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => `'[${v.embedding.join(',')}]'`).join(',')}]::vector[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => v.index).join(',')}]::int[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => v.start).join(',')}]::int[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => v.end).join(',')}]::int[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => v.page ?? 'NULL').join(',')}]::int[]`)},
      ${Prisma.raw(`ARRAY[${values.map((v) => (v.section ? `'${v.section.replace(/'/g, "''")}'` : 'NULL')).join(',')}]::text[]`)}
    ) AS v(id, document_id, content, embedding, index, start, "end", page, section)
  `;

  // Fallback to individual inserts if unnest fails
  try {
    await client.$executeRaw(query);
  } catch {
    // Fallback: insert one by one
    for (const chunk of values) {
      await client.$executeRaw`
        INSERT INTO document_chunks (
          id, document_id, content, embedding, "index", 
          start, "end", page, section, created_at
        )
        VALUES (
          ${chunk.id},
          ${chunk.document_id},
          ${chunk.content},
          ${chunk.embedding}::vector,
          ${chunk.index},
          ${chunk.start},
          ${chunk.end},
          ${chunk.page},
          ${chunk.section},
          NOW()
        )
      `;
    }
  }
}

// ============================================================================
// Batch Update Operations
// ============================================================================

/**
 * Update embeddings for existing chunks in batches
 */
export async function batchUpdateEmbeddings(
  prisma: PrismaClient,
  updates: Array<{ chunkId: string; embedding: number[] }>,
  options: BatchInsertOptions = {}
): Promise<BulkUpdateResult> {
  const { batchSize = 100, batchDelayMs = 0, continueOnError = true } = options;

  const errors: Array<{ chunkId: string; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const update of batch) {
        try {
          await tx.$executeRaw`
            UPDATE document_chunks
            SET embedding = ${update.embedding}::vector
            WHERE id = ${update.chunkId}
          `;
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push({
            chunkId: update.chunkId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (!continueOnError) {
            throw error;
          }
        }
      }
    });

    if (batchDelayMs > 0 && i + batchSize < updates.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  return { successCount, failureCount, errors };
}

/**
 * Update chunk content and embeddings in batches
 */
export async function batchUpdateChunks(
  prisma: PrismaClient,
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

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const update of batch) {
        try {
          const sets: string[] = [];

          if (update.content !== undefined) {
            sets.push(`content = '${update.content.replace(/'/g, "''")}'`);
          }
          if (update.embedding !== undefined) {
            sets.push(`embedding = '[${update.embedding.join(',')}]'::vector`);
          }
          if (update.page !== undefined) {
            sets.push(`page = ${update.page}`);
          }
          if (update.section !== undefined) {
            sets.push(`section = '${update.section.replace(/'/g, "''")}'`);
          }

          if (sets.length > 0) {
            await tx.$executeRawUnsafe(`
              UPDATE document_chunks
              SET ${sets.join(', ')}
              WHERE id = '${update.chunkId}'
            `);
          }

          successCount++;
        } catch (error) {
          failureCount++;
          errors.push({
            chunkId: update.chunkId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (!continueOnError) {
            throw error;
          }
        }
      }
    });
  }

  return { successCount, failureCount, errors };
}

// ============================================================================
// Batch Delete Operations
// ============================================================================

/**
 * Delete chunks in batches
 */
export async function batchDeleteChunks(
  prisma: PrismaClient,
  chunkIds: string[],
  options: BatchInsertOptions = {}
): Promise<{ successCount: number; failureCount: number }> {
  const { batchSize = 500 } = options;

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < chunkIds.length; i += batchSize) {
    const batch = chunkIds.slice(i, i + batchSize);

    try {
      const result = await prisma.documentChunk.deleteMany({
        where: { id: { in: batch } },
      });
      successCount += result.count;
    } catch {
      failureCount += batch.length;
    }
  }

  return { successCount, failureCount };
}

/**
 * Delete all chunks for multiple documents
 */
export async function batchDeleteDocumentChunks(
  prisma: PrismaClient,
  documentIds: string[]
): Promise<{ successCount: number; deletedChunks: number }> {
  const result = await prisma.documentChunk.deleteMany({
    where: { documentId: { in: documentIds } },
  });

  return {
    successCount: documentIds.length,
    deletedChunks: result.count,
  };
}

// ============================================================================
// Streaming Operations
// ============================================================================

/**
 * Process chunks in a streaming fashion
 * Useful for very large datasets that don't fit in memory
 */
export async function streamProcessChunks<T>(
  prisma: PrismaClient,
  documentId: string,
  processor: (chunks: Array<Pick<DocumentChunk, 'id' | 'content' | 'index'>>) => Promise<T[]>,
  options: { batchSize?: number; onProgress?: (processed: number) => void } = {}
): Promise<T[]> {
  const { batchSize = 100, onProgress } = options;
  const results: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      select: { id: true, content: true, index: true },
      orderBy: { index: 'asc' },
      skip: offset,
      take: batchSize,
    });

    if (chunks.length === 0) {
      hasMore = false;
      break;
    }

    const batchResults = await processor(chunks);
    results.push(...batchResults);

    offset += chunks.length;
    onProgress?.(offset);

    if (chunks.length < batchSize) {
      hasMore = false;
    }
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
