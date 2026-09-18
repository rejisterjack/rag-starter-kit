/**
 * Vector Similarity Search using Qdrant
 *
 * Implements vector similarity search via the Qdrant client, with
 * pre-filtering by metadata and score threshold.
 */

import { buildQdrantFilterFromRetrievalOptions } from '@/lib/vector/filters';
import { batchSearch, searchSimilar } from '@/lib/vector/points';
import type { RetrievalOptions, RetrievedChunk, VectorSearchConfig } from './types';

/**
 * Default configuration for vector search
 */
export const defaultVectorSearchConfig: VectorSearchConfig = {
  distanceMetric: 'cosine',
};

/**
 * Map a Qdrant ScoredPoint payload to a RetrievedChunk
 */
function mapScoredPointToChunk(
  point: { id: string | number; score: number; payload?: Record<string, unknown> | null },
  distanceMetric: string
): RetrievedChunk {
  const p = point.payload ?? {};
  const getString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
  const getNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

  return {
    id: String(point.id),
    content: getString(p.content),
    score: point.score,
    metadata: {
      documentId: getString(p.documentId),
      documentName: getString(p.documentName),
      documentType: getString(p.documentType, 'unknown'),
      page: getNumber(p.page),
      position: typeof p.index === 'number' ? p.index : 0,
      section: typeof p.section === 'string' ? p.section : undefined,
      start: getNumber(p.start),
      end: getNumber(p.end),
    },
    retrievalMethod: `vector-${distanceMetric}`,
  };
}

/**
 * Vector Retriever class for similarity search via Qdrant
 */
export class VectorRetriever {
  private config: VectorSearchConfig;

  constructor(config: Partial<VectorSearchConfig> = {}) {
    this.config = { ...defaultVectorSearchConfig, ...config };
  }

  /**
   * Perform vector similarity search
   */
  async retrieve(queryEmbedding: number[], options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.7;

    try {
      const filter = buildQdrantFilterFromRetrievalOptions(options);

      const results = await searchSimilar(queryEmbedding, {
        filter,
        topK: topK * 2,
        minScore,
        withPayload: true,
      });

      return results
        .map((point) => mapScoredPointToChunk(point, this.config.distanceMetric))
        .filter((chunk) => chunk.score >= minScore)
        .slice(0, topK);
    } catch (error) {
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
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.7;

    try {
      const filter = buildQdrantFilterFromRetrievalOptions(options);

      const batchResults = await batchSearch(queryEmbeddings, {
        filter,
        topK: topK * 2,
        minScore,
        withPayload: true,
      });

      return batchResults.map((results) =>
        results
          .map((point) => mapScoredPointToChunk(point, this.config.distanceMetric))
          .filter((chunk) => chunk.score >= minScore)
          .slice(0, topK)
      );
    } catch (error) {
      throw new Error(
        `Batch vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
