/**
 * Vector Store
 *
 * Core vector operations using pgvector extension.
 * Provides document chunk storage, similarity search, and metadata filtering.
 */

import type { DocumentChunk } from '@prisma/client';
import { Prisma, type PrismaClient } from '@prisma/client';

// Type for transaction client
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ============================================================================
// Types
// ============================================================================

export interface SearchOptions {
  /** Workspace/user ID for isolation */
  userId: string;
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (default: 0.7) */
  minScore?: number;
  /** Optional filters */
  filter?: SearchFilter;
  /** Search type: 'cosine' | 'euclidean' | 'inner_product' (default: 'cosine') */
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
// Vector Store Class
// ============================================================================

export class VectorStore {
  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Add document chunks with embeddings
   */
  async addVectors(chunks: ChunkInsertData[], documentId: string, userId: string): Promise<void> {
    if (chunks.length === 0) return;

    // Verify document exists and belongs to user
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or access denied`);
    }

    // Use transaction for consistency
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // Delete existing chunks for this document (if updating)
      await tx.documentChunk.deleteMany({
        where: { documentId },
      });

      // Insert new chunks with embeddings using raw query
      for (const chunk of chunks) {
        await tx.$executeRaw`
          INSERT INTO document_chunks (
            id, document_id, content, embedding, "index", 
            start, "end", page, section, created_at
          )
          VALUES (
            ${crypto.randomUUID()},
            ${chunk.documentId},
            ${chunk.content},
            ${chunk.embedding}::vector,
            ${chunk.index},
            ${chunk.start ?? 0},
            ${chunk.end ?? chunk.content.length},
            ${chunk.page ?? null},
            ${chunk.section ?? null},
            NOW()
          )
        `;
      }
    });
  }

  /**
   * Similarity search with filters
   */
  async similaritySearch(
    _query: string,
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { userId, topK = 5, minScore = 0.7, filter, searchType = 'cosine' } = options;

    // Build the distance expression based on search type
    const distanceExpr = this.getDistanceExpression(searchType);
    const scoreExpr = this.getScoreExpression(searchType);

    // Build WHERE clause
    const conditions: string[] = [
      `d.user_id = ${Prisma.sql`'` + userId + Prisma.sql`'`}`,
      `d.status = 'COMPLETED'`,
    ];

    if (filter?.documentIds && filter.documentIds.length > 0) {
      const ids = filter.documentIds.map((id) => `'${id}'`).join(',');
      conditions.push(`d.id IN (${ids})`);
    }

    if (filter?.documentTypes && filter.documentTypes.length > 0) {
      const types = filter.documentTypes.map((t) => `'${t}'`).join(',');
      conditions.push(`d.content_type IN (${types})`);
    }

    if (filter?.dateRange) {
      conditions.push(
        `d.created_at >= '${filter.dateRange.from.toISOString()}'`,
        `d.created_at <= '${filter.dateRange.to.toISOString()}'`
      );
    }

    const whereClause = conditions.join(' AND ');

    // Execute search query
    const results = await this.prisma.$queryRaw<
      Array<{
        chunkId: string;
        content: string;
        score: number;
        documentId: string;
        documentName: string;
        documentType: string;
        page: number | null;
        section: string | null;
        index: number;
      }>
    >`
      SELECT 
        dc.id as "chunkId",
        dc.content,
        ${Prisma.raw(scoreExpr)} as score,
        d.id as "documentId",
        d.name as "documentName",
        d.content_type as "documentType",
        dc.page,
        dc.section,
        dc.index
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE ${Prisma.raw(whereClause)}
        AND dc.embedding IS NOT NULL
      ORDER BY ${Prisma.raw(distanceExpr)} ${queryEmbedding}::vector
      LIMIT ${topK * 2}
    `;

    // Filter by minimum score and format results
    return results
      .filter((r) => r.score >= minScore)
      .slice(0, topK)
      .map((r) => ({
        chunkId: r.chunkId,
        content: r.content,
        score: r.score,
        metadata: {
          documentId: r.documentId,
          documentName: r.documentName,
          documentType: r.documentType,
          page: r.page ?? undefined,
          section: r.section ?? undefined,
          index: r.index,
        },
      }));
  }

  /**
   * Delete all vectors for a document
   */
  async deleteDocumentVectors(documentId: string): Promise<number> {
    const result = await this.prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    return result.count;
  }

  /**
   * Update a single chunk's embedding
   */
  async updateVectors(chunkId: string, embedding: number[]): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE document_chunks
      SET embedding = ${embedding}::vector
      WHERE id = ${chunkId}
    `;
  }

  /**
   * Update multiple chunks' embeddings
   */
  async updateMultipleVectors(
    updates: Array<{ chunkId: string; embedding: number[] }>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.$executeRaw`
          UPDATE document_chunks
          SET embedding = ${update.embedding}::vector
          WHERE id = ${update.chunkId}
        `;
      }
    });
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Add chunks in batches for better performance
   */
  async addVectorsBatched(
    chunks: ChunkInsertData[],
    documentId: string,
    userId: string,
    batchSize = 100
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Verify document exists and belongs to user
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or access denied`);
    }

    // Process in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      await this.prisma.$transaction(async (tx) => {
        for (const chunk of batch) {
          await tx.$executeRaw`
            INSERT INTO document_chunks (
              id, document_id, content, embedding, "index", 
              start, "end", page, section, created_at
            )
            VALUES (
              ${crypto.randomUUID()},
              ${chunk.documentId},
              ${chunk.content},
              ${chunk.embedding}::vector,
              ${chunk.index},
              ${chunk.start ?? 0},
              ${chunk.end ?? chunk.content.length},
              ${chunk.page ?? null},
              ${chunk.section ?? null},
              NOW()
            )
          `;
        }
      });

      // Small delay between batches to prevent overwhelming the database
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Get chunks without embeddings (for backfill)
   */
  async getChunksWithoutEmbeddings(
    documentId: string,
    limit = 100
  ): Promise<Array<Pick<DocumentChunk, 'id' | 'content' | 'index'>>> {
    return this.prisma.$queryRaw`
      SELECT id, content, index
      FROM document_chunks
      WHERE document_id = ${documentId}
        AND embedding IS NULL
      ORDER BY index
      LIMIT ${limit}
    `;
  }

  /**
   * Count chunks without embeddings
   */
  async countChunksWithoutEmbeddings(documentId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE document_id = ${documentId}
        AND embedding IS NULL
    `;
    return Number(result[0]?.count ?? 0);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get document statistics
   */
  async getDocumentStats(documentId: string): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    chunksWithoutEmbeddings: number;
    avgContentLength: number;
  }> {
    const result = await this.prisma.$queryRaw<
      [
        {
          total_chunks: bigint;
          chunks_with_embeddings: bigint;
          chunks_without_embeddings: bigint;
          avg_content_length: number;
        },
      ]
    >`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embeddings,
        COUNT(CASE WHEN embedding IS NULL THEN 1 END) as chunks_without_embeddings,
        AVG(LENGTH(content)) as avg_content_length
      FROM document_chunks
      WHERE document_id = ${documentId}
    `;

    const stats = result[0];
    return {
      totalChunks: Number(stats?.total_chunks ?? 0),
      chunksWithEmbeddings: Number(stats?.chunks_with_embeddings ?? 0),
      chunksWithoutEmbeddings: Number(stats?.chunks_without_embeddings ?? 0),
      avgContentLength: Math.round(stats?.avg_content_length ?? 0),
    };
  }

  /**
   * Check if document has been vectorized
   */
  async isDocumentVectorized(documentId: string): Promise<boolean> {
    const stats = await this.getDocumentStats(documentId);
    return stats.totalChunks > 0 && stats.chunksWithoutEmbeddings === 0;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get distance expression for search type
   */
  private getDistanceExpression(searchType: DistanceMetric): string {
    switch (searchType) {
      case 'cosine':
        return 'dc.embedding <=>'; // Cosine distance
      case 'euclidean':
        return 'dc.embedding <->'; // Euclidean distance
      case 'inner_product':
        return 'dc.embedding <#>'; // Negative inner product
      default:
        return 'dc.embedding <=>';
    }
  }

  /**
   * Get score expression (converts distance to similarity score)
   */
  private getScoreExpression(searchType: DistanceMetric): string {
    switch (searchType) {
      case 'cosine':
        return '1 - (dc.embedding <=>'; // Cosine similarity
      case 'euclidean':
        return '1 / (1 + (dc.embedding <->'; // Convert to similarity
      case 'inner_product':
        return '-(dc.embedding <#>'; // Negate to get similarity
      default:
        return '1 - (dc.embedding <=>';
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let vectorStoreInstance: VectorStore | null = null;

/**
 * Get or create singleton VectorStore instance
 */
export function getVectorStore(prisma?: PrismaClient): VectorStore {
  if (!vectorStoreInstance && prisma) {
    vectorStoreInstance = new VectorStore(prisma);
  }
  if (!vectorStoreInstance) {
    throw new Error('VectorStore not initialized');
  }
  return vectorStoreInstance;
}

/**
 * Create a new VectorStore instance
 */
export function createVectorStore(prisma: PrismaClient): VectorStore {
  return new VectorStore(prisma);
}
