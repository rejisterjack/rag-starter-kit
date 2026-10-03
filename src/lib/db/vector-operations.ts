import { prisma } from './client';

export interface VectorStats {
  totalVectors: number;
  documentStats: Array<{
    documentId: string;
    documentName: string;
    chunkCount: number;
    hasEmbeddings: boolean;
  }>;
}

export interface IndexStats {
  indexName: string;
  indexType: string;
  tableName: string;
  columnName: string;
  size: string;
  rows: number;
}

export interface HNSWIndexOptions {
  dimensions: number;
  m?: number;
  efConstruction?: number;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
}

export interface IVFFlatIndexOptions {
  dimensions: number;
  lists: number;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
}

export async function getVectorStats(): Promise<VectorStats> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        documentId: string;
        documentName: string;
        chunkCount: number;
        hasEmbeddings: boolean;
      }>
    >`
      SELECT
        "documentId",
        MAX("documentName") AS "documentName",
        COUNT(*)::int AS "chunkCount",
        BOOL_OR(embedding IS NOT NULL) AS "hasEmbeddings"
      FROM document_chunks
      GROUP BY "documentId"
    `;
    return {
      totalVectors: rows.reduce((sum, row) => sum + row.chunkCount, 0),
      documentStats: rows,
    };
  } catch {
    return { totalVectors: 0, documentStats: [] };
  }
}

export async function getGlobalVectorStats(): Promise<{
  totalVectors: number;
  totalDocuments: number;
  indexSize: string;
  tableSize: string;
}> {
  try {
    const [chunkCount, imageCount, sizes] = await Promise.all([
      prisma.$queryRaw<
        Array<{ count: number }>
      >`SELECT COUNT(*)::int AS count FROM document_chunks`,
      prisma.$queryRaw<
        Array<{ count: number }>
      >`SELECT COUNT(*)::int AS count FROM image_embeddings`,
      prisma.$queryRaw<Array<{ indexSize: string; tableSize: string }>>`
        SELECT
          COALESCE(pg_size_pretty(pg_relation_size('document_chunks_embedding_hnsw_idx')), '0 bytes') AS "indexSize",
          COALESCE(pg_size_pretty(pg_total_relation_size('document_chunks')), '0 bytes') AS "tableSize"
      `,
    ]);
    const documents = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "documentId")::int AS count FROM document_chunks
    `;
    return {
      totalVectors: (chunkCount[0]?.count ?? 0) + (imageCount[0]?.count ?? 0),
      totalDocuments: documents[0]?.count ?? 0,
      indexSize: sizes[0]?.indexSize ?? '0 bytes',
      tableSize: sizes[0]?.tableSize ?? '0 bytes',
    };
  } catch {
    return { totalVectors: 0, totalDocuments: 0, indexSize: '0 bytes', tableSize: '0 bytes' };
  }
}

export async function createHNSWIndex(): Promise<void> {
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 128)
  `;
}

export function createIVFFlatIndex(): Promise<void> {
  return Promise.resolve();
}

export async function dropHNSWIndex(): Promise<void> {
  await prisma.$executeRaw`DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx`;
}

export function dropIVFFlatIndex(): Promise<void> {
  return Promise.resolve();
}

export async function setHNSWEfSearch(ef = 64): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('hnsw.ef_search', ${String(ef)}, false)`;
}

export function setIVFFlatProbes(): Promise<void> {
  return Promise.resolve();
}

export async function listVectorIndexes(): Promise<IndexStats[]> {
  return prisma.$queryRaw<IndexStats[]>`
    SELECT
      i.relname AS "indexName",
      am.amname AS "indexType",
      t.relname AS "tableName",
      COALESCE(a.attname, 'embedding') AS "columnName",
      pg_size_pretty(pg_relation_size(i.oid)) AS size,
      t.reltuples::int AS rows
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_am am ON am.oid = i.relam
    LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (x.indkey)
    WHERE t.relname IN ('document_chunks', 'image_embeddings')
      AND i.relname LIKE '%embedding%'
  `;
}

export async function analyzeVectorIndex(): Promise<IndexStats[]> {
  return listVectorIndexes();
}

export async function reindexVector(): Promise<void> {
  await prisma.$executeRaw`REINDEX INDEX CONCURRENTLY document_chunks_embedding_hnsw_idx`.catch(
    async () => {
      await prisma.$executeRaw`REINDEX INDEX document_chunks_embedding_hnsw_idx`;
    }
  );
}

export async function vacuumVectorTable(): Promise<void> {
  await prisma.$executeRawUnsafe('VACUUM ANALYZE document_chunks');
}

export async function findDuplicateVectors(): Promise<
  Array<{ content: string; count: number; ids: string[] }>
> {
  return prisma.$queryRaw<Array<{ content: string; count: number; ids: string[] }>>`
    SELECT content, COUNT(*)::int AS count, array_agg(id) AS ids
    FROM document_chunks
    GROUP BY content
    HAVING COUNT(*) > 1
    LIMIT 100
  `;
}

export async function removeOrphanedVectors(): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM document_chunks dc
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d WHERE d.id = dc."documentId"
    )
  `;
  return Number(result);
}

export function calculateOptimalLists(rowCount = 1000): number {
  return Math.max(1, Math.round(Math.sqrt(rowCount)));
}

export function calculateHNSWParams(): { m: number; efConstruction: number } {
  return { m: 32, efConstruction: 128 };
}
