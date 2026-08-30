/**
 * Vector Store
 *
 * Core vector operations using PostgreSQL + pgvector.
 * Provides document chunk storage, similarity search, and metadata filtering.
 */

import type { ChunkPointData } from '@/lib/vector';
import {
  buildVectorFilter,
  deleteByDocumentId,
  getChunksByIds,
  getDocumentStats,
  searchSimilar,
  updateChunkEmbeddings,
  upsertChunks,
} from '@/lib/vector';

import { prisma } from './client';

type ScoredPoint = Awaited<ReturnType<typeof searchSimilar>>[number];

export interface SearchOptions {
  userId: string;
  workspaceId?: string;
  topK?: number;
  minScore?: number;
  filter?: SearchFilter;
  searchType?: DistanceMetric;
}

export interface SearchFilter {
  documentIds?: string[];
  documentTypes?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  metadata?: Record<string, unknown>;
}

export type DistanceMetric = 'cosine' | 'euclidean' | 'inner_product';

export interface SearchResult {
  chunkId: string;
  content: string;
  score: number;
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
  content: string;
  embedding: number[];
  documentId: string;
  index: number;
  start?: number;
  end?: number;
  page?: number;
  section?: string;
}

function scoredPointToResult(point: ScoredPoint): SearchResult {
  const p = point.payload ?? {};
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

export class VectorStore {
  async addVectors(chunks: ChunkInsertData[], documentId: string, userId: string): Promise<void> {
    if (chunks.length === 0) return;

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or access denied`);
    }

    const pointData: ChunkPointData[] = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      page: chunk.page,
      section: chunk.section,
    }));

    await upsertChunks(pointData, {
      userId,
      workspaceId: document.workspaceId ?? undefined,
      documentName: document.name,
      documentType: document.contentType,
    });
  }

  async similaritySearch(
    _query: string,
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { userId, workspaceId, topK = 5, minScore = 0.5, filter } = options;

    const vectorFilter = buildVectorFilter({
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
      filter: vectorFilter,
      topK,
      minScore,
      withPayload: true,
    });

    return scoredPoints.map(scoredPointToResult);
  }

  async deleteDocumentVectors(documentId: string): Promise<number> {
    return deleteByDocumentId(documentId);
  }

  async updateVectors(chunkId: string, embedding: number[]): Promise<void> {
    const existing = await getChunksByIds([chunkId]);
    if (existing.length === 0) {
      throw new Error(`Chunk ${chunkId} not found`);
    }
    await updateChunkEmbeddings([{ chunkId, embedding }]);
  }

  async updateMultipleVectors(
    updates: Array<{ chunkId: string; embedding: number[] }>
  ): Promise<void> {
    if (updates.length === 0) return;
    await updateChunkEmbeddings(updates);
  }

  async addVectorsBatched(
    chunks: ChunkInsertData[],
    documentId: string,
    userId: string,
    batchSize = 100
  ): Promise<void> {
    if (chunks.length === 0) return;

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or access denied`);
    }

    const pointData: ChunkPointData[] = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      page: chunk.page,
      section: chunk.section,
    }));

    await upsertChunks(pointData, {
      userId,
      workspaceId: document.workspaceId ?? undefined,
      documentName: document.name,
      documentType: document.contentType,
      batchSize,
    });
  }

  async getChunksWithoutEmbeddings(
    documentId: string,
    limit = 100
  ): Promise<Array<{ id: string; content: string; index: number }>> {
    return prisma.$queryRaw<Array<{ id: string; content: string; index: number }>>`
      SELECT id, content, index
      FROM document_chunks
      WHERE "documentId" = ${documentId} AND embedding IS NULL
      LIMIT ${limit}
    `;
  }

  async countChunksWithoutEmbeddings(documentId: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM document_chunks
      WHERE "documentId" = ${documentId} AND embedding IS NULL
    `;
    return rows[0]?.count ?? 0;
  }

  async getDocumentStats(documentId: string): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    chunksWithoutEmbeddings: number;
    avgContentLength: number;
  }> {
    const stats = await getDocumentStats(documentId);
    const avgRows = await prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(length(content))::float AS avg
      FROM document_chunks
      WHERE "documentId" = ${documentId}
    `;
    return {
      totalChunks: stats.totalChunks,
      chunksWithEmbeddings: stats.chunksWithEmbeddings,
      chunksWithoutEmbeddings: stats.totalChunks - stats.chunksWithEmbeddings,
      avgContentLength: avgRows[0]?.avg ?? 0,
    };
  }

  async isDocumentVectorized(documentId: string): Promise<boolean> {
    const stats = await getDocumentStats(documentId);
    return stats.chunksWithEmbeddings > 0;
  }
}

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(_prisma?: unknown): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
  }
  return vectorStoreInstance;
}

export function createVectorStore(_prisma?: unknown): VectorStore {
  return new VectorStore();
}
