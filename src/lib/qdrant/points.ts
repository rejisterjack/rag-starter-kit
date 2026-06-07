import type { Schemas } from '@qdrant/js-client-rest';

type Filter = Schemas['Filter'];
type ScoredPoint = Schemas['ScoredPoint'];

import { logger } from '@/lib/logger';
import { qdrantCircuitBreaker } from '@/lib/resilience/external-services';
import { withRetry } from '@/lib/utils/retry';
import { qdrant } from './client';
import { COLLECTION_DOCUMENT_CHUNKS, COLLECTION_IMAGE_EMBEDDINGS } from './collections';

export interface ChunkPointData {
  id?: string;
  documentId: string;
  content: string;
  embedding: number[];
  index: number;
  start?: number | null;
  end?: number | null;
  page?: number | null;
  section?: string | null;
}

export interface UpsertOptions {
  userId: string;
  workspaceId?: string;
  documentName: string;
  documentType: string;
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface SearchOptions {
  filter?: Filter;
  topK?: number;
  minScore?: number;
  withPayload?: boolean;
}

export async function upsertChunks(
  chunks: ChunkPointData[],
  options: UpsertOptions
): Promise<{
  successCount: number;
  failureCount: number;
  errors: Array<{ batchIndex: number; error: string }>;
}> {
  const { batchSize = 50, onProgress } = options;
  const errors: Array<{ batchIndex: number; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    try {
      const points = batch.map((chunk) => ({
        id: chunk.id ?? crypto.randomUUID(),
        vector: chunk.embedding,
        payload: {
          documentId: chunk.documentId,
          userId: options.userId,
          workspaceId: options.workspaceId ?? null,
          content: chunk.content,
          index: chunk.index,
          start: chunk.start ?? 0,
          end: chunk.end ?? chunk.content.length,
          page: chunk.page ?? null,
          section: chunk.section ?? null,
          documentName: options.documentName,
          documentType: options.documentType,
          createdAt: Date.now(),
        },
      }));

      await withRetry(
        () =>
          qdrant.upsert(COLLECTION_DOCUMENT_CHUNKS, {
            wait: true,
            points,
          }),
        { maxRetries: 2, delayMs: 500 }
      );

      successCount += batch.length;
    } catch (error) {
      failureCount += batch.length;
      errors.push({
        batchIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      logger.error('Qdrant upsert batch failed', { batchIndex, error });
    }

    onProgress?.(Math.min(i + batchSize, chunks.length), chunks.length);
  }

  return { successCount, failureCount, errors };
}

export async function searchSimilar(
  queryVector: number[],
  options: SearchOptions = {}
): Promise<ScoredPoint[]> {
  const { filter, topK = 5, minScore, withPayload = true } = options;

  return qdrantCircuitBreaker.execute(() =>
    withRetry(
      () =>
        qdrant.search(COLLECTION_DOCUMENT_CHUNKS, {
          vector: queryVector,
          limit: topK,
          filter,
          with_payload: withPayload,
          score_threshold: minScore,
          search_params: {
            hnsw_ef: 64,
            exact: false,
          },
        } as Parameters<typeof qdrant.search>[1]),
      { maxRetries: 2, delayMs: 500 }
    )
  );
}

export async function searchKeyword(
  query: string,
  options: SearchOptions = {}
): Promise<ScoredPoint[]> {
  const { filter, topK = 5 } = options;

  return qdrantCircuitBreaker.execute(() =>
    withRetry(
      async () => {
        const results = await qdrant.query(COLLECTION_DOCUMENT_CHUNKS, {
          query: {
            fusion: 'rrf',
          },
          prefetch: [
            {
              query: {
                nearest: new Array(768).fill(0),
              },
              filter: {
                must: [
                  {
                    key: 'content',
                    match: { text: query },
                  },
                ],
                should: filter?.should,
                must_not: filter?.must_not,
              },
              limit: topK * 2,
            },
          ],
          limit: topK,
          with_payload: true,
        });
        return results.points;
      },
      { maxRetries: 2, delayMs: 500 }
    )
  );
}

export async function searchHybrid(
  query: string,
  queryVector: number[],
  options: SearchOptions = {}
): Promise<ScoredPoint[]> {
  const { filter, topK = 5 } = options;

  return qdrantCircuitBreaker.execute(() =>
    withRetry(
      async () => {
        const results = await qdrant.query(COLLECTION_DOCUMENT_CHUNKS, {
          query: {
            fusion: 'rrf',
          },
          prefetch: [
            {
              query: queryVector,
              limit: topK * 2,
              filter,
            },
            {
              query: {
                nearest: new Array(768).fill(0),
              },
              filter: {
                must: [
                  {
                    key: 'content',
                    match: { text: query },
                  },
                ],
                should: filter?.should,
                must_not: filter?.must_not,
              },
              limit: topK * 2,
            },
          ],
          limit: topK,
          with_payload: true,
        });
        return results.points;
      },
      { maxRetries: 2, delayMs: 500 }
    )
  );
}

export async function deleteByDocumentId(documentId: string): Promise<number> {
  const countResult = await qdrant.count(COLLECTION_DOCUMENT_CHUNKS, {
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
    exact: true,
  });

  await qdrant.delete(COLLECTION_DOCUMENT_CHUNKS, {
    wait: true,
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
  });

  return countResult.count;
}

export async function deleteImagePoints(documentId: string): Promise<number> {
  const countResult = await qdrant.count(COLLECTION_IMAGE_EMBEDDINGS, {
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
    exact: true,
  });

  await qdrant.delete(COLLECTION_IMAGE_EMBEDDINGS, {
    wait: true,
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
  });

  return countResult.count;
}

export interface DocumentChunk {
  id: string;
  text: string;
  index: number;
  page?: number | null;
  section?: string | null;
}

export async function getChunksByDocumentId(
  documentId: string,
  limit = 200
): Promise<DocumentChunk[]> {
  const results = await qdrant.scroll(COLLECTION_DOCUMENT_CHUNKS, {
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
    with_payload: true,
    limit,
    order_by: { key: 'index', direction: 'asc' },
  });

  return (results.points as Array<{ id: string | number; payload?: Record<string, unknown> }>).map(
    (point) => ({
      id: String(point.id),
      text: (point.payload?.content as string) ?? '',
      index: (point.payload?.index as number) ?? 0,
      page: point.payload?.page as number | null,
      section: point.payload?.section as string | null,
    })
  );
}

export async function getDocumentStats(documentId: string): Promise<{
  totalChunks: number;
  chunksWithEmbeddings: number;
}> {
  const result = await qdrant.count(COLLECTION_DOCUMENT_CHUNKS, {
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
    exact: true,
  });

  return {
    totalChunks: result.count,
    chunksWithEmbeddings: result.count,
  };
}

export async function batchSearch(
  queryVectors: number[][],
  options: SearchOptions = {}
): Promise<ScoredPoint[][]> {
  const { filter, topK = 5, minScore } = options;

  return qdrantCircuitBreaker.execute(() =>
    withRetry(
      async () => {
        const searches = queryVectors.map((vector) => ({
          vector,
          limit: topK,
          filter,
          with_payload: true,
          score_threshold: minScore,
        }));

        const results = await qdrant.searchBatch(COLLECTION_DOCUMENT_CHUNKS, {
          searches,
        });

        return results.map((r) => r);
      },
      { maxRetries: 2, delayMs: 500 }
    )
  );
}

export async function upsertImageEmbedding(data: {
  id: string;
  documentId: string;
  userId: string;
  embedding: number[];
  storageUrl: string;
  caption?: string;
  pageNumber?: number;
  model: string;
  dimensions: number;
}): Promise<void> {
  await withRetry(
    () =>
      qdrant.upsert(COLLECTION_IMAGE_EMBEDDINGS, {
        wait: true,
        points: [
          {
            id: data.id,
            vector: data.embedding,
            payload: {
              documentId: data.documentId,
              userId: data.userId,
              storageUrl: data.storageUrl,
              caption: data.caption ?? null,
              pageNumber: data.pageNumber ?? null,
              model: data.model,
              dimensions: data.dimensions,
            },
          },
        ],
      }),
    { maxRetries: 2, delayMs: 500 }
  );
}

export async function searchSimilarImages(
  queryVector: number[],
  options: { userId?: string; documentId?: string; topK?: number }
): Promise<ScoredPoint[]> {
  const must: NonNullable<Filter['must']> = [];
  if (options.userId) must.push({ key: 'userId', match: { value: options.userId } });
  if (options.documentId) must.push({ key: 'documentId', match: { value: options.documentId } });

  return qdrantCircuitBreaker.execute(() =>
    withRetry(
      () =>
        qdrant.search(COLLECTION_IMAGE_EMBEDDINGS, {
          vector: queryVector,
          limit: options.topK ?? 5,
          filter: must.length > 0 ? { must } : undefined,
          with_payload: true,
        }),
      { maxRetries: 2, delayMs: 500 }
    )
  );
}
