/**
 * Vector Store
 *
 * Core vector operations using Qdrant vector database.
 * Provides document chunk storage, similarity search, and metadata filtering.
 *
 * The Qdrant client is a singleton — no constructor arguments are needed.
 * Prisma is used only for fetching document metadata (name, type) during upserts.
 */

import type { ChunkPointData } from '@/lib/qdrant';
import {
  buildQdrantFilter,
  COLLECTION_DOCUMENT_CHUNKS,
  qdrant,
  deleteByDocumentId as qdrantDeleteByDocumentId,
  getDocumentStats as qdrantGetDocumentStats,
  searchSimilar,
  upsertChunks,
} from '@/lib/qdrant';

import { prisma } from './client';

/**
 * Derive the Qdrant scored-point type from the searchSimilar return value
 * rather than importing ScoredPoint directly (v1.17.x does not re-export it).
 */
type QdrantScoredPoint = Awaited<ReturnType<typeof searchSimilar>>[number];

// ============================================================================
// Types
// ============================================================================

export interface SearchOptions {
  /** User ID for isolation */
  userId: string;
  /** Workspace ID — search documents in this workspace in addition to user's own */
  workspaceId?: string;
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (default: 0.7) */
  minScore?: number;
  /** Optional filters */
  filter?: SearchFilter;
  /** Search type: 'cosine' | 'euclidean' | 'inner_product' (default: 'cosine')
   *  NOTE: Qdrant always uses cosine similarity; this field is kept for API
   *  compatibility but currently ignored. */
  searchType?: DistanceMetric;
}

export interface SearchFilter {
  /** Filter by specific document IDs */
  documentIds?: string[];
  /** Filter by document types */
  documentTypes?: string[];
  /** Filter by date range */
  dateRange?: {
    from: Date;
    to: Date;
  };
  /** Additional metadata filters */
  metadata?: Record<string, unknown>;
}

export type DistanceMetric = 'cosine' | 'euclidean' | 'inner_product';

export interface SearchResult {
  /** Chunk ID */
  chunkId: string;
  /** Chunk content */
  content: string;
  /** Similarity score (0-1 for cosine) */
  score: number;
  /** Result metadata */
  metadata: {
    documentId: string;
    documentName: string;
    documentType?: string;
    page?: number;
    section?: string;
    index: number;
  };
}

export interface ChunkInsertData {
  /** Chunk content */
  content: string;
  /** Embedding vector */
  embedding: number[];
  /** Document ID */
  documentId: string;
  /** Chunk position in document */
  index: number;
  /** Character start position */
  start?: number;
  /** Character end position */
  end?: number;
  /** Page number (for PDFs) */
  page?: number;
  /** Section identifier */
  section?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a Qdrant ScoredPoint into our public SearchResult shape.
 */
function scoredPointToResult(point: QdrantScoredPoint): SearchResult {
  const p = point.payload ?? ({} as Record<string, unknown>);
  return {
    chunkId: String(point.id),
    content: String(p.content ?? ''),
    score: point.score,
    metadata: {
      documentId: String(p.documentId ?? ''),
      documentName: String(p.documentName ?? ''),
      documentType: p.documentType ? String(p.documentType) : undefined,
      page: p.page != null ? Number(p.page) : undefined,
      section: p.section != null ? String(p.section) : undefined,
      index: Number(p.index ?? 0),
    },
  };
}

// ============================================================================
// Vector Store Class
// ============================================================================

export class VectorStore {
  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Add document chunks with embeddings to Qdrant.
   *
   * Fetches document metadata (name, contentType) from Prisma so that every
   * Qdrant point carries enough payload for later search results.
   */
  async addVectors(chunks: ChunkInsertData[], documentId: string, userId: string): Promise<void> {
    if (chunks.length === 0) return;

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or access denied`);
    }

    const qdrantChunks: ChunkPointData[] = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      page: chunk.page,
      section: chunk.section,
    }));

    await upsertChunks(qdrantChunks, {
      userId,
      documentName: document.name,
      documentType: document.contentType,
    });
  }

  /**
   * Similarity search with filters.
   *
   * Delegates to Qdrant's search endpoint and maps the scored points back to
   * the public SearchResult shape.
   */
  async similaritySearch(
    _query: string,
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { userId, workspaceId, topK = 5, minScore = 0.5, filter } = options;

    // Build a Qdrant-compatible filter from the SearchOptions
    const qdrantFilter = buildQdrantFilter({
      userId,
      workspaceId,
      filters: filter
        ? {
            documentIds: filter.documentIds,
            documentTypes: filter.documentTypes,
            dateRange: filter.dateRange,
            metadata: filter.metadata,
          }
        : undefined,
    });

    const scoredPoints = await searchSimilar(queryEmbedding, {
      filter: qdrantFilter,
      topK,
      minScore,
      withPayload: true,
    });

    return scoredPoints.map(scoredPointToResult);
  }

  /**
   * Delete all vectors for a document.
   *
   * Returns the number of points removed.
   */
  async deleteDocumentVectors(documentId: string): Promise<number> {
    return qdrantDeleteByDocumentId(documentId);
  }

  /**
   * Update a single chunk's embedding.
   *
   * Qdrant upserts are idempotent — we look up the existing point by filtering
   * on documentId + index, then re-upsert with the new vector.
   */
  async updateVectors(chunkId: string, embedding: number[]): Promise<void> {
    const existing = await qdrant.retrieve(COLLECTION_DOCUMENT_CHUNKS, {
      ids: [chunkId],
      with_payload: true,
      with_vector: false,
    });

    if (existing.length === 0) {
      throw new Error(`Chunk ${chunkId} not found in Qdrant`);
    }

    const payload = existing[0]?.payload ?? {};
    await qdrant.upsert(COLLECTION_DOCUMENT_CHUNKS, {
      wait: true,
      points: [
        {
          id: chunkId,
          vector: embedding,
          payload,
        },
      ],
    });
  }

  /**
   * Update multiple chunks' embeddings.
   */
  async updateMultipleVectors(
    updates: Array<{ chunkId: string; embedding: number[] }>
  ): Promise<void> {
    if (updates.length === 0) return;

    const ids = updates.map((u) => u.chunkId);
    const existing = await qdrant.retrieve(COLLECTION_DOCUMENT_CHUNKS, {
      ids,
      with_payload: true,
      with_vector: false,
    });

    const embeddingMap = new Map(updates.map((u) => [u.chunkId, u.embedding]));
    const points = existing.map((point) => ({
      id: point.id,
      vector: embeddingMap.get(String(point.id)) ?? [],
      payload: point.payload ?? {},
    }));

    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_DOCUMENT_CHUNKS, {
        wait: true,
        points,
      });
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Add chunks in batches for better performance.
   *
   * Delegates to upsertChunks which handles batching internally.
   */
  async addVectorsBatched(
    chunks: ChunkInsertData[],
    documentId: string,
    userId: string,
    batchSize = 100
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or access denied`);
    }

    const qdrantChunks: ChunkPointData[] = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      page: chunk.page,
      section: chunk.section,
    }));

    await upsertChunks(qdrantChunks, {
      userId,
      documentName: document.name,
      documentType: document.contentType,
      batchSize,
    });
  }

  /**
   * Get chunks without embeddings (for backfill).
   *
   * In Qdrant all upserted points already have embeddings, so this returns
   * an empty array. Kept for API compatibility.
   */
  async getChunksWithoutEmbeddings(
    _documentId: string,
    _limit = 100
  ): Promise<Array<{ id: string; content: string; index: number }>> {
    // Qdrant points always have embeddings after upsert — no backfill needed.
    return [];
  }

  /**
   * Count chunks without embeddings.
   *
   * In Qdrant all upserted points have embeddings, so this is always 0.
   */
  async countChunksWithoutEmbeddings(_documentId: string): Promise<number> {
    return 0;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get document statistics.
   *
   * Returns chunk counts from Qdrant plus an average content-length estimate.
   */
  async getDocumentStats(documentId: string): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    chunksWithoutEmbeddings: number;
    avgContentLength: number;
  }> {
    const stats = await qdrantGetDocumentStats(documentId);
    return {
      totalChunks: stats.totalChunks,
      chunksWithEmbeddings: stats.chunksWithEmbeddings,
      chunksWithoutEmbeddings: 0, // Qdrant points always carry embeddings
      avgContentLength: 0, // Not tracked in Qdrant payload
    };
  }

  /**
   * Check if document has been vectorized.
   */
  async isDocumentVectorized(documentId: string): Promise<boolean> {
    const stats = await qdrantGetDocumentStats(documentId);
    return stats.totalChunks > 0;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let vectorStoreInstance: VectorStore | null = null;

/**
 * Get or create singleton VectorStore instance.
 *
 * The `prisma` parameter is accepted for backward compatibility but is no
 * longer required — the VectorStore constructor is parameterless.
 */
export function getVectorStore(_prisma?: unknown): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
  }
  return vectorStoreInstance;
}

/**
 * Create a new VectorStore instance.
 *
 * The `prisma` parameter is accepted for backward compatibility but is no
 * longer required — the VectorStore constructor is parameterless.
 */
export function createVectorStore(_prisma?: unknown): VectorStore {
  return new VectorStore();
}
