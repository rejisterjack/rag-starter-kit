/**
 * Vector Operations
 * 
 * Advanced vector database operations including index management,
 * optimization, and statistics.
 */

import { PrismaClient, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface HNSWIndexOptions {
  /** Table name */
  tableName: string;
  /** Column name containing vectors */
  columnName: string;
  /** Vector dimensions */
  dimensions: number;
  /** Max connections per layer (default: 16) */
  m?: number;
  /** Build-time search factor (default: 64) */
  efConstruction?: number;
  /** Distance metric (default: l2) */
  distanceMetric?: 'l2' | 'ip' | 'cosine';
}

export interface IVFFlatIndexOptions {
  /** Table name */
  tableName: string;
  /** Column name containing vectors */
  columnName: string;
  /** Vector dimensions */
  dimensions: number;
  /** Number of lists (partitions) - sqrt of row count is good default */
  lists: number;
  /** Distance metric (default: l2) */
  distanceMetric?: 'l2' | 'ip' | 'cosine';
}

export interface IndexStats {
  indexName: string;
  indexType: string;
  tableName: string;
  columnName: string;
  size: string;
  rows: number;
}

export interface VectorStats {
  /** Total number of vectors */
  totalVectors: number;
  /** Average vector size in bytes */
  avgVectorSize: number;
  /** Total index size */
  indexSize: string;
  /** Table size */
  tableSize: string;
  /** Per-document statistics */
  documentStats: Array<{
    documentId: string;
    documentName: string;
    chunkCount: number;
    hasEmbeddings: boolean;
  }>;
}

// ============================================================================
// HNSW Index Management
// ============================================================================

/**
 * Create HNSW index for fast approximate search
 * 
 * HNSW (Hierarchical Navigable Small World) is the recommended index for pgvector
 * as it provides the best query performance with reasonable build time.
 * 
 * @param prisma - PrismaClient instance
 * @param options - Index configuration options
 */
export async function createHNSWIndex(
  prisma: PrismaClient,
  options: HNSWIndexOptions
): Promise<void> {
  const {
    tableName,
    columnName,
    m = 16,
    efConstruction = 64,
    distanceMetric = 'cosine',
  } = options;

  const indexName = `${tableName}_${columnName}_hnsw_idx`;

  // Validate dimensions
  if (options.dimensions <= 0) {
    throw new Error('Dimensions must be greater than 0');
  }

  // Drop existing index if exists
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS ${indexName}`
  );

  // Create HNSW index
  // Note: Using raw query with proper escaping for identifiers
  const createIndexSQL = `
    CREATE INDEX ${indexName}
    ON ${tableName}
    USING hnsw (${columnName} ${getDistanceOperator(distanceMetric)})
    WITH (m = ${m}, ef_construction = ${efConstruction})
  `;

  await prisma.$executeRawUnsafe(createIndexSQL);

  console.log(`Created HNSW index: ${indexName} (m=${m}, ef_construction=${efConstruction})`);
}

/**
 * Drop HNSW index
 */
export async function dropHNSWIndex(
  prisma: PrismaClient,
  tableName: string,
  columnName: string
): Promise<void> {
  const indexName = `${tableName}_${columnName}_hnsw_idx`;
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${indexName}`);
}

/**
 * Update HNSW search parameters for a query
 * Higher ef = more accurate but slower
 */
export async function setHNSWEfSearch(
  prisma: PrismaClient,
  ef: number
): Promise<void> {
  await prisma.$executeRaw`SET hnsw.ef_search = ${ef}`;
}

// ============================================================================
// IVFFlat Index Management
// ============================================================================

/**
 * Create IVFFlat index (alternative to HNSW)
 * 
 * IVFFlat is good for large datasets where index build time is a concern.
 * However, HNSW generally provides better query performance.
 * 
 * @param prisma - PrismaClient instance
 * @param options - Index configuration options
 */
export async function createIVFFlatIndex(
  prisma: PrismaClient,
  options: IVFFlatIndexOptions
): Promise<void> {
  const {
    tableName,
    columnName,
    lists,
    distanceMetric = 'cosine',
  } = options;

  const indexName = `${tableName}_${columnName}_ivfflat_idx`;

  // Drop existing index if exists
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS ${indexName}`
  );

  // Create IVFFlat index
  const createIndexSQL = `
    CREATE INDEX ${indexName}
    ON ${tableName}
    USING ivfflat (${columnName} ${getDistanceOperator(distanceMetric)})
    WITH (lists = ${lists})
  `;

  await prisma.$executeRawUnsafe(createIndexSQL);

  console.log(`Created IVFFlat index: ${indexName} (lists=${lists})`);
}

/**
 * Drop IVFFlat index
 */
export async function dropIVFFlatIndex(
  prisma: PrismaClient,
  tableName: string,
  columnName: string
): Promise<void> {
  const indexName = `${tableName}_${columnName}_ivfflat_idx`;
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${indexName}`);
}

/**
 * Update IVFFlat probe count for a query
 * Higher probes = more accurate but slower
 */
export async function setIVFFlatProbes(
  prisma: PrismaClient,
  probes: number
): Promise<void> {
  await prisma.$executeRaw`SET ivfflat.probes = ${probes}`;
}

// ============================================================================
// Index Analysis and Optimization
// ============================================================================

/**
 * Analyze and optimize index
 * Run after significant data changes
 */
export async function analyzeVectorIndex(
  prisma: PrismaClient,
  tableName: string
): Promise<IndexStats[]> {
  // Analyze the table
  await prisma.$executeRawUnsafe(`ANALYZE ${tableName}`);

  // Get index statistics
  const stats = await prisma.$queryRaw<Array<{
    indexname: string;
    indextype: string;
    tablename: string;
    columnname: string;
    size: string;
    rows: bigint;
  }>>`
    SELECT 
      i.relname as indexname,
      am.amname as indextype,
      t.relname as tablename,
      a.attname as columnname,
      pg_size_pretty(pg_relation_size(ix.indexrelid)) as size,
      c.reltuples::bigint as rows
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_am am ON am.oid = i.relam
    LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = ${tableName}
      AND am.amname IN ('hnsw', 'ivfflat')
  `;

  return stats.map((s) => ({
    indexName: s.indexname,
    indexType: s.indextype,
    tableName: s.tablename,
    columnName: s.columnname,
    size: s.size,
    rows: Number(s.rows),
  }));
}

/**
 * Get all vector indexes in the database
 */
export async function listVectorIndexes(
  prisma: PrismaClient
): Promise<IndexStats[]> {
  const stats = await prisma.$queryRaw<Array<{
    indexname: string;
    indextype: string;
    tablename: string;
    columnname: string;
    size: string;
    rows: bigint;
  }>>`
    SELECT 
      i.relname as indexname,
      am.amname as indextype,
      t.relname as tablename,
      a.attname as columnname,
      pg_size_pretty(pg_relation_size(i.oid)) as size,
      c.reltuples::bigint as rows
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_am am ON am.oid = i.relam
    LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE am.amname IN ('hnsw', 'ivfflat')
    ORDER BY t.relname, i.relname
  `;

  return stats.map((s) => ({
    indexName: s.indexname,
    indexType: s.indextype,
    tableName: s.tablename,
    columnName: s.columnname,
    size: s.size,
    rows: Number(s.rows),
  }));
}

/**
 * Reindex a vector index
 * Use when index becomes fragmented
 */
export async function reindexVector(
  prisma: PrismaClient,
  indexName: string
): Promise<void> {
  await prisma.$executeRawUnsafe(`REINDEX INDEX ${indexName}`);
}

// ============================================================================
// Vector Statistics
// ============================================================================

/**
 * Get vector statistics for a user's workspace
 */
export async function getVectorStats(
  prisma: PrismaClient,
  userId: string
): Promise<VectorStats> {
  // Get overall statistics
  const stats = await prisma.$queryRaw<[
    {
      total_vectors: bigint;
      avg_vector_size: number;
      index_size: string;
      table_size: string;
    },
  ]>`
    SELECT 
      COUNT(*) as total_vectors,
      AVG(pg_column_size(embedding)) as avg_vector_size,
      (
        SELECT pg_size_pretty(pg_relation_size(indexrelid))
        FROM pg_index
        WHERE indrelid = 'document_chunks'::regclass
          AND indisvalid
        LIMIT 1
      ) as index_size,
      pg_size_pretty(pg_total_relation_size('document_chunks')) as table_size
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = ${userId}
  `;

  // Get per-document statistics
  const documentStats = await prisma.$queryRaw<Array<{
    document_id: string;
    document_name: string;
    chunk_count: bigint;
    has_embeddings: boolean;
  }>>`
    SELECT 
      d.id as document_id,
      d.name as document_name,
      COUNT(dc.id) as chunk_count,
      bool_and(dc.embedding IS NOT NULL) as has_embeddings
    FROM documents d
    LEFT JOIN document_chunks dc ON d.id = dc.document_id
    WHERE d.user_id = ${userId}
    GROUP BY d.id, d.name
    ORDER BY d.created_at DESC
  `;

  const stat = stats[0];
  return {
    totalVectors: Number(stat?.total_vectors ?? 0),
    avgVectorSize: Math.round(stat?.avg_vector_size ?? 0),
    indexSize: stat?.index_size ?? '0 bytes',
    tableSize: stat?.table_size ?? '0 bytes',
    documentStats: documentStats.map((d) => ({
      documentId: d.document_id,
      documentName: d.document_name,
      chunkCount: Number(d.chunk_count),
      hasEmbeddings: d.has_embeddings ?? false,
    })),
  };
}

/**
 * Get global vector statistics (admin only)
 */
export async function getGlobalVectorStats(prisma: PrismaClient): Promise<{
  totalVectors: number;
  totalDocuments: number;
  documentsWithEmbeddings: number;
  documentsWithoutEmbeddings: number;
  avgChunksPerDocument: number;
  indexSize: string;
  tableSize: string;
}> {
  const stats = await prisma.$queryRaw<[
    {
      total_vectors: bigint;
      total_documents: bigint;
      docs_with_embeddings: bigint;
      docs_without_embeddings: bigint;
      avg_chunks: number;
      index_size: string;
      table_size: string;
    },
  ]>`
    WITH doc_stats AS (
      SELECT 
        d.id,
        COUNT(dc.id) as chunk_count,
        COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) as embedded_chunks
      FROM documents d
      LEFT JOIN document_chunks dc ON d.id = dc.document_id
      GROUP BY d.id
    )
    SELECT 
      (SELECT COUNT(*) FROM document_chunks) as total_vectors,
      (SELECT COUNT(*) FROM documents) as total_documents,
      (SELECT COUNT(*) FROM doc_stats WHERE embedded_chunks > 0) as docs_with_embeddings,
      (SELECT COUNT(*) FROM doc_stats WHERE embedded_chunks = 0) as docs_without_embeddings,
      (SELECT AVG(chunk_count) FROM doc_stats) as avg_chunks,
      (
        SELECT pg_size_pretty(SUM(pg_relation_size(indexrelid)))
        FROM pg_index
        WHERE indrelid = 'document_chunks'::regclass
      ) as index_size,
      pg_size_pretty(pg_total_relation_size('document_chunks')) as table_size
  `;

  const stat = stats[0];
  return {
    totalVectors: Number(stat?.total_vectors ?? 0),
    totalDocuments: Number(stat?.total_documents ?? 0),
    documentsWithEmbeddings: Number(stat?.docs_with_embeddings ?? 0),
    documentsWithoutEmbeddings: Number(stat?.docs_without_embeddings ?? 0),
    avgChunksPerDocument: Math.round((stat?.avg_chunks ?? 0) * 10) / 10,
    indexSize: stat?.index_size ?? '0 bytes',
    tableSize: stat?.table_size ?? '0 bytes',
  };
}

// ============================================================================
// Maintenance Operations
// ============================================================================

/**
 * Vacuum and analyze vector table
 * Run periodically for optimal performance
 */
export async function vacuumVectorTable(
  prisma: PrismaClient
): Promise<void> {
  // Note: VACUUM cannot run inside a transaction
  // This needs to be run outside of Prisma's transaction
  await prisma.$executeRaw`VACUUM ANALYZE document_chunks`;
}

/**
 * Find and optionally remove duplicate vectors
 */
export async function findDuplicateVectors(
  prisma: PrismaClient,
  documentId?: string
): Promise<Array<{
  content: string;
  count: number;
  ids: string[];
}>> {
  const whereClause = documentId 
    ? Prisma.sql`WHERE document_id = ${documentId}` 
    : Prisma.sql``;

  return prisma.$queryRaw`
    SELECT 
      content,
      COUNT(*) as count,
      array_agg(id) as ids
    FROM document_chunks
    ${whereClause}
    GROUP BY content
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;
}

/**
 * Remove vectors with null embeddings (orphaned)
 */
export async function removeOrphanedVectors(
  prisma: PrismaClient,
  documentId: string
): Promise<number> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    DELETE FROM document_chunks
    WHERE document_id = ${documentId}
      AND embedding IS NULL
    RETURNING COUNT(*) as count
  `;

  return Number(result[0]?.count ?? 0);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the distance operator for a given metric
 */
function getDistanceOperator(metric: 'l2' | 'ip' | 'cosine'): string {
  switch (metric) {
    case 'l2':
      return 'vector_l2_ops';
    case 'ip':
      return 'vector_ip_ops';
    case 'cosine':
      return 'vector_cosine_ops';
    default:
      return 'vector_cosine_ops';
  }
}

/**
 * Calculate optimal number of IVFFlat lists based on row count
 */
export function calculateOptimalLists(rowCount: number): number {
  // Rule of thumb: sqrt of row count, rounded to nearest power of 2
  const sqrt = Math.sqrt(rowCount);
  return Math.pow(2, Math.round(Math.log2(sqrt)));
}

/**
 * Calculate optimal HNSW parameters based on dataset size
 */
export function calculateHNSWParams(rowCount: number): {
  m: number;
  efConstruction: number;
} {
  // Small dataset
  if (rowCount < 10000) {
    return { m: 8, efConstruction: 32 };
  }
  // Medium dataset
  if (rowCount < 100000) {
    return { m: 16, efConstruction: 64 };
  }
  // Large dataset
  return { m: 32, efConstruction: 128 };
}
