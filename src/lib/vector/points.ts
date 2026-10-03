import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { vectorSearchCircuitBreaker } from '@/lib/resilience/external-services';
import { withRetry } from '@/lib/utils/retry';
import { buildFilterSql, sqlVector } from './sql';
import type {
  ChunkPointData,
  ChunkRow,
  DocumentChunk,
  ScoredPoint,
  SearchOptions,
  UpsertOptions,
} from './types';

const HNSW_EF_SEARCH = 64;

function rowToScoredPoint(row: ChunkRow & { score: number }): ScoredPoint {
  return {
    id: row.id,
    score: Number(row.score),
    payload: {
      documentId: row.documentId,
      content: row.content,
      index: row.index,
      start: row.start,
      end: row.end,
      page: row.page,
      section: row.section,
      documentName: row.documentName,
      documentType: row.documentType,
      userId: row.userId,
      workspaceId: row.workspaceId,
    },
  };
}

async function withHnswSearch<T>(query: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    try {
      await tx.$executeRaw`SELECT set_config('hnsw.ef_search', ${String(HNSW_EF_SEARCH)}, true)`;
    } catch (error) {
      logger.debug('hnsw.ef_search is not available; using default', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return query(tx);
  });
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
      const values = batch.map((chunk) => {
        const id = chunk.id ?? crypto.randomUUID();
        const start = chunk.start ?? 0;
        const end = chunk.end ?? chunk.content.length;
        return Prisma.sql`(
          ${id},
          ${chunk.documentId},
          ${options.userId},
          ${options.workspaceId ?? null},
          ${chunk.content},
          ${sqlVector(chunk.embedding)},
          ${chunk.index},
          ${start},
          ${end},
          ${chunk.page ?? null},
          ${chunk.section ?? null},
          ${options.documentName},
          ${options.documentType},
          NOW(),
          NOW()
        )`;
      });

      await withRetry(
        () =>
          prisma.$executeRaw`
            INSERT INTO document_chunks (
              id, "documentId", "userId", "workspaceId", content, embedding,
              index, start, "end", page, section, "documentName", "documentType",
              "createdAt", "updatedAt"
            )
            VALUES ${Prisma.join(values)}
            ON CONFLICT (id) DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              index = EXCLUDED.index,
              start = EXCLUDED.start,
              "end" = EXCLUDED."end",
              page = EXCLUDED.page,
              section = EXCLUDED.section,
              "documentName" = EXCLUDED."documentName",
              "documentType" = EXCLUDED."documentType",
              "userId" = EXCLUDED."userId",
              "workspaceId" = EXCLUDED."workspaceId",
              "updatedAt" = NOW()
          `,
        { maxRetries: 2, delayMs: 500 }
      );

      successCount += batch.length;
    } catch (error) {
      failureCount += batch.length;
      errors.push({
        batchIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      logger.error('pgvector upsert batch failed', { batchIndex, error });
    }

    onProgress?.(Math.min(i + batchSize, chunks.length), chunks.length);
  }

  return { successCount, failureCount, errors };
}

const CHUNK_SELECT = Prisma.sql`
  dc.id,
  dc.content,
  dc.index,
  dc.page,
  dc.section,
  dc."documentId" AS "documentId",
  dc."documentName" AS "documentName",
  dc."documentType" AS "documentType",
  dc.start,
  dc."end",
  dc."userId" AS "userId",
  dc."workspaceId" AS "workspaceId"
`;

export async function searchSimilar(
  queryVector: number[],
  options: SearchOptions = {}
): Promise<ScoredPoint[]> {
  const { filter, topK = 5, minScore } = options;
  const where = buildFilterSql(filter);
  const vec = sqlVector(queryVector);

  return vectorSearchCircuitBreaker.execute(() =>
    withRetry(
      () =>
        withHnswSearch(async (tx) => {
          const rows = await tx.$queryRaw<(ChunkRow & { score: number })[]>`
            SELECT
              ${CHUNK_SELECT},
              1 - (dc.embedding <=> ${vec}) AS score
            FROM document_chunks dc
            WHERE ${where}
              ${minScore != null ? Prisma.sql`AND 1 - (dc.embedding <=> ${vec}) >= ${minScore}` : Prisma.empty}
            ORDER BY dc.embedding <=> ${vec}
            LIMIT ${topK}
          `;
          return rows.map(rowToScoredPoint);
        }),
      { maxRetries: 2, delayMs: 500 }
    )
  );
}

export async function searchKeyword(
  query: string,
  options: SearchOptions = {}
): Promise<ScoredPoint[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { filter, topK = 5 } = options;
  const where = buildFilterSql(filter);

  return vectorSearchCircuitBreaker.execute(() =>
    withRetry(
      async () => {
        const rows = await prisma.$queryRaw<(ChunkRow & { score: number })[]>`
          SELECT
            ${CHUNK_SELECT},
            ts_rank_cd(dc.content_tsv, websearch_to_tsquery('english', ${trimmed})) AS score
          FROM document_chunks dc
          WHERE ${where}
            AND dc.content_tsv @@ websearch_to_tsquery('english', ${trimmed})
          ORDER BY score DESC
          LIMIT ${topK}
        `;
        return rows.map(rowToScoredPoint);
      },
      { maxRetries: 2, delayMs: 500 }
    )
  );
}

function reciprocalRankFusion(resultLists: ScoredPoint[][], k = 60): ScoredPoint[] {
  const scores = new Map<string, { score: number; point: ScoredPoint }>();
  for (const list of resultLists) {
    list.forEach((point, index) => {
      const add = 1 / (k + index + 1);
      const existing = scores.get(point.id);
      if (existing) {
        existing.score += add;
      } else {
        scores.set(point.id, { score: add, point });
      }
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ score, point }) => ({ ...point, score }));
}

export async function searchHybrid(
  query: string,
  queryVector: number[],
  options: SearchOptions = {}
): Promise<ScoredPoint[]> {
  const topK = options.topK ?? 5;
  const expanded = { ...options, topK: topK * 2 };
  const [vectorResults, keywordResults] = await Promise.all([
    searchSimilar(queryVector, expanded),
    searchKeyword(query, expanded),
  ]);
  return reciprocalRankFusion([vectorResults, keywordResults]).slice(0, topK);
}

export async function deleteByDocumentId(documentId: string): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM document_chunks WHERE "documentId" = ${documentId}
  `;
  return Number(result);
}

export async function deleteImagePoints(documentId: string): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM image_embeddings WHERE "documentId" = ${documentId}
  `;
  return Number(result);
}

export async function deleteChunksByIds(chunkIds: string[]): Promise<number> {
  if (chunkIds.length === 0) return 0;
  const result = await prisma.$executeRaw`
    DELETE FROM document_chunks WHERE id IN (${Prisma.join(chunkIds)})
  `;
  return Number(result);
}

export async function getChunksByDocumentId(
  documentId: string,
  limit = 200
): Promise<DocumentChunk[]> {
  return prisma.$queryRaw<DocumentChunk[]>`
    SELECT id, content AS text, index, page, section
    FROM document_chunks
    WHERE "documentId" = ${documentId}
    ORDER BY index ASC
    LIMIT ${limit}
  `;
}

export async function listChunksByDocumentId(
  documentId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Array<{ id: string; content: string; index: number }>> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  return prisma.$queryRaw<Array<{ id: string; content: string; index: number }>>`
    SELECT id, content, index
    FROM document_chunks
    WHERE "documentId" = ${documentId}
    ORDER BY index ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

export async function getChunksByIds(ids: string[]): Promise<ChunkRow[]> {
  if (ids.length === 0) return [];
  return prisma.$queryRaw<ChunkRow[]>`
    SELECT ${CHUNK_SELECT}
    FROM document_chunks dc
    WHERE dc.id IN (${Prisma.join(ids)})
  `;
}

export async function updateChunkEmbeddings(
  updates: Array<{ chunkId: string; embedding: number[] }>
): Promise<void> {
  if (updates.length === 0) return;
  for (const update of updates) {
    await prisma.$executeRaw`
      UPDATE document_chunks
      SET embedding = ${sqlVector(update.embedding)}, "updatedAt" = NOW()
      WHERE id = ${update.chunkId}
    `;
  }
}

export async function updateChunkFields(
  updates: Array<{
    chunkId: string;
    content?: string;
    embedding?: number[];
    page?: number;
    section?: string;
  }>
): Promise<{ updated: string[]; missing: string[] }> {
  const updated: string[] = [];
  const missing: string[] = [];

  for (const update of updates) {
    const sets: Prisma.Sql[] = [Prisma.sql`"updatedAt" = NOW()`];
    if (update.content !== undefined) {
      sets.push(Prisma.sql`content = ${update.content}`);
      sets.push(Prisma.sql`"end" = ${update.content.length}`);
    }
    if (update.embedding) {
      sets.push(Prisma.sql`embedding = ${sqlVector(update.embedding)}`);
    }
    if (update.page !== undefined) {
      sets.push(Prisma.sql`page = ${update.page}`);
    }
    if (update.section !== undefined) {
      sets.push(Prisma.sql`section = ${update.section}`);
    }

    const count = await prisma.$executeRaw`
      UPDATE document_chunks
      SET ${Prisma.join(sets, ', ')}
      WHERE id = ${update.chunkId}
    `;
    if (Number(count) > 0) updated.push(update.chunkId);
    else missing.push(update.chunkId);
  }

  return { updated, missing };
}

export async function getDocumentStats(documentId: string): Promise<{
  totalChunks: number;
  chunksWithEmbeddings: number;
}> {
  const rows = await prisma.$queryRaw<Array<{ total: number; with_embeddings: number }>>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(embedding)::int AS with_embeddings
    FROM document_chunks
    WHERE "documentId" = ${documentId}
  `;
  return {
    totalChunks: rows[0]?.total ?? 0,
    chunksWithEmbeddings: rows[0]?.with_embeddings ?? 0,
  };
}

export async function batchSearch(
  queryVectors: number[][],
  options: SearchOptions = {}
): Promise<ScoredPoint[][]> {
  return Promise.all(queryVectors.map((vector) => searchSimilar(vector, options)));
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
  contentHash?: string;
  imageId?: string;
}): Promise<void> {
  await withRetry(
    () =>
      prisma.$executeRaw`
        INSERT INTO image_embeddings (
          id, "documentId", "imageId", "userId", "storageUrl", "contentHash",
          caption, "pageNumber", embedding, model, dimensions, "createdAt"
        )
        VALUES (
          ${data.id},
          ${data.documentId},
          ${data.imageId ?? null},
          ${data.userId},
          ${data.storageUrl},
          ${data.contentHash ?? null},
          ${data.caption ?? null},
          ${data.pageNumber ?? null},
          ${sqlVector(data.embedding)},
          ${data.model},
          ${data.dimensions},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          "storageUrl" = EXCLUDED."storageUrl",
          caption = EXCLUDED.caption,
          "pageNumber" = EXCLUDED."pageNumber",
          model = EXCLUDED.model,
          dimensions = EXCLUDED.dimensions
      `,
    { maxRetries: 2, delayMs: 500 }
  );
}

export async function searchSimilarImages(
  queryVector: number[],
  options: { userId?: string; documentId?: string; topK?: number }
): Promise<ScoredPoint[]> {
  const vec = sqlVector(queryVector);
  const parts: Prisma.Sql[] = [Prisma.sql`embedding IS NOT NULL`];
  if (options.userId) parts.push(Prisma.sql`"userId" = ${options.userId}`);
  if (options.documentId) parts.push(Prisma.sql`"documentId" = ${options.documentId}`);
  const where = Prisma.join(parts, ' AND ');

  return vectorSearchCircuitBreaker.execute(() =>
    withRetry(
      async () => {
        const rows = await prisma.$queryRaw<
          Array<{
            id: string;
            score: number;
            documentId: string | null;
            userId: string | null;
            storageUrl: string | null;
            caption: string | null;
            pageNumber: number | null;
            model: string;
            dimensions: number;
          }>
        >`
          SELECT
            id,
            1 - (embedding <=> ${vec}) AS score,
            "documentId",
            "userId",
            "storageUrl",
            caption,
            "pageNumber",
            model,
            dimensions
          FROM image_embeddings
          WHERE ${where}
          ORDER BY embedding <=> ${vec}
          LIMIT ${options.topK ?? 5}
        `;

        return rows.map((row) => ({
          id: row.id,
          score: Number(row.score),
          payload: {
            documentId: row.documentId,
            userId: row.userId,
            storageUrl: row.storageUrl,
            caption: row.caption,
            pageNumber: row.pageNumber,
            model: row.model,
            dimensions: row.dimensions,
          },
        }));
      },
      { maxRetries: 2, delayMs: 500 }
    )
  );
}
