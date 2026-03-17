/**
 * Vector Similarity Search using pgvector
 * 
 * Implements cosine similarity search with configurable distance metrics,
 * pre-filtering by metadata, and post-filtering by score threshold.
 */

import { prisma } from '@/lib/db';
import type {
  RetrievedChunk,
  RetrievalOptions,
  VectorSearchConfig,
  RawSearchResult,
  DistanceMetric,
} from './types';

/**
 * Default configuration for vector search
 */
export const defaultVectorSearchConfig: VectorSearchConfig = {
  distanceMetric: 'cosine',
  useIVF: false,
  ivfProbes: 1,
  maxCandidates: 1000,
};

/**
 * Get the SQL operator for the specified distance metric
 */
function getDistanceOperator(metric: DistanceMetric): string {
  switch (metric) {
    case 'cosine':
      return '<=>';
    case 'euclidean':
      return '<->';
    case 'inner_product':
      return '<#>';
    default:
      return '<=>';
  }
}

/**
 * Get the similarity score calculation based on distance metric
 * For cosine: similarity = 1 - distance
 * For euclidean: we use a normalized inverse distance
 * For inner product: we normalize to 0-1 range
 */
function getSimilarityCalculation(
  metric: DistanceMetric,
  columnRef: string,
  embeddingParam: string
): string {
  switch (metric) {
    case 'cosine':
      return `1 - (${columnRef} <=> ${embeddingParam}::vector)`;
    case 'euclidean':
      // Normalize Euclidean distance to 0-1 similarity (approximate)
      return `1 / (1 + (${columnRef} <-> ${embeddingParam}::vector))`;
    case 'inner_product':
      // Normalize inner product to 0-1 using sigmoid-like transformation
      return `CASE 
        WHEN (${columnRef} <#> ${embeddingParam}::vector) > 0 
        THEN 1 / (1 + exp(-(${columnRef} <#> ${embeddingParam}::vector))) 
        ELSE 0 
      END`;
    default:
      return `1 - (${columnRef} <=> ${embeddingParam}::vector)`;
  }
}

/**
 * Build WHERE clause filters for vector search
 */
function buildFilters(
  options: RetrievalOptions,
  paramIndex: number
): { whereClause: string; params: unknown[]; nextIndex: number } {
  const filters: string[] = [];
  const params: unknown[] = [];
  let idx = paramIndex;

  // Workspace/workspace filter (required)
  filters.push(`d.user_id = $${idx++}`);
  params.push(options.workspaceId);

  // Document status filter
  filters.push(`d.status = 'COMPLETED'`);

  // Document ID filter
  if (options.filters?.documentIds?.length) {
    filters.push(`dc.document_id = ANY($${idx++}::text[])`);
    params.push(options.filters.documentIds);
  }

  // Document type filter
  if (options.filters?.documentTypes?.length) {
    filters.push(`d.content_type = ANY($${idx++}::text[])`);
    params.push(options.filters.documentTypes);
  }

  // Date range filter
  if (options.filters?.dateRange) {
    filters.push(`d.created_at >= $${idx++} AND d.created_at <= $${idx++}`);
    params.push(options.filters.dateRange.from);
    params.push(options.filters.dateRange.to);
  }

  // Metadata filters (JSONB queries)
  if (options.filters?.metadata) {
    for (const [key, value] of Object.entries(options.filters.metadata)) {
      filters.push(`d.metadata->>'${key}' = $${idx++}`);
      params.push(String(value));
    }
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  return { whereClause, params, nextIndex: idx };
}

/**
 * Vector Retriever class for similarity search
 */
export class VectorRetriever {
  private config: VectorSearchConfig;

  constructor(config: Partial<VectorSearchConfig> = {}) {
    this.config = { ...defaultVectorSearchConfig, ...config };
  }

  /**
   * Perform vector similarity search
   */
  async retrieve(
    queryEmbedding: number[],
    options: RetrievalOptions
  ): Promise<RetrievedChunk[]> {
    const startTime = Date.now();
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.7;

    // Build filters
    const { whereClause, params, nextIndex } = buildFilters(options, 1);
    const embeddingParam = `$${nextIndex}`;
    const thresholdParam = `$${nextIndex + 1}`;
    const limitParam = `$${nextIndex + 2}`;

    // Get similarity calculation expression
    const similarityCalc = getSimilarityCalculation(
      this.config.distanceMetric,
      'dc.embedding',
      embeddingParam
    );

    // Get distance operator for ordering
    const distanceOp = getDistanceOperator(this.config.distanceMetric);

    // Build the SQL query
    const sqlQuery = `
      SELECT 
        dc.id,
        dc.document_id as "documentId",
        dc.content,
        dc.index,
        dc.page,
        dc.section,
        dc.headings,
        d.name as "documentName",
        d.content_type as "documentType",
        ${similarityCalc} as score
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      ${whereClause}
        AND dc.embedding IS NOT NULL
        AND ${similarityCalc} > ${thresholdParam}
      ORDER BY dc.embedding ${distanceOp} ${embeddingParam}::vector
      LIMIT ${limitParam}
    `;

    try {
      // Add embedding, threshold, and limit to params
      const queryParams = [...params, queryEmbedding, minScore, topK * 2]; // Get more for post-filtering

      const results = await prisma.$queryRawUnsafe<RawSearchResult[]>(
        sqlQuery,
        ...queryParams
      );

      // Transform to RetrievedChunk format
      const chunks: RetrievedChunk[] = results.map((result) => ({
        id: result.id,
        content: result.content,
        score: Number(result.score),
        metadata: {
          documentId: result.documentId,
          documentName: result.documentName,
          documentType: result.documentType || 'unknown',
          page: result.page ?? undefined,
          headings: result.headings,
          position: result.index,
          section: result.section ?? undefined,
        },
        retrievalMethod: `vector-${this.config.distanceMetric}`,
      }));

      // Post-filtering: ensure we respect the topK limit
      const filteredChunks = chunks
        .filter((chunk) => chunk.score >= minScore)
        .slice(0, topK);

      console.log(
        `[VectorRetriever] Found ${filteredChunks.length} chunks in ${Date.now() - startTime}ms`
      );

      return filteredChunks;
    } catch (error) {
      console.error('[VectorRetriever] Search error:', error);
      throw new Error(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Batch retrieve chunks for multiple query embeddings
   * Useful for multi-query retrieval
   */
  async retrieveBatch(
    queryEmbeddings: number[][],
    options: RetrievalOptions
  ): Promise<RetrievedChunk[][]> {
    const results = await Promise.all(
      queryEmbeddings.map((embedding) => this.retrieve(embedding, options))
    );
    return results;
  }

  /**
   * Get the configuration
   */
  getConfig(): VectorSearchConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VectorSearchConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Convenience function for single vector search
 */
export async function searchVector(
  queryEmbedding: number[],
  options: RetrievalOptions,
  config?: Partial<VectorSearchConfig>
): Promise<RetrievedChunk[]> {
  const retriever = new VectorRetriever(config);
  return retriever.retrieve(queryEmbedding, options);
}

/**
 * Create a vector index on document chunks
 * This should be run as a migration
 */
export function createVectorIndexSQL(
  metric: DistanceMetric = 'cosine',
  indexName = 'idx_chunks_embedding'
): string {
  const opclass = metric === 'cosine' ? 'vector_cosine_ops' : 
                  metric === 'euclidean' ? 'vector_l2_ops' : 
                  'vector_ip_ops';
  
  return `
    -- Create vector index for ${metric} similarity
    CREATE INDEX IF NOT EXISTS ${indexName} 
    ON "document_chunks" 
    USING ivfflat (embedding ${opclass})
    WITH (lists = 100);
  `;
}

/**
 * Get approximate vector count for a workspace
 */
export async function getVectorCount(workspaceId: string): Promise<number> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = ${workspaceId}
      AND d.status = 'COMPLETED'
      AND dc.embedding IS NOT NULL
  `;
  return Number(result[0].count);
}

/**
 * Check if vectors exist for a document
 */
export async function hasVectors(documentId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM document_chunks
    WHERE document_id = ${documentId}
      AND embedding IS NOT NULL
  `;
  return Number(result[0].count) > 0;
}
