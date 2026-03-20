/**
 * Hybrid Search - Combining Vector and Keyword Retrieval
 *
 * Implements Reciprocal Rank Fusion (RRF) to combine results from
 * vector similarity search and keyword search for improved retrieval quality.
 */

import { generateEmbedding } from '@/lib/ai';
import { type defaultKeywordSearchConfig, KeywordRetriever } from './keyword';
import type { HybridSearchConfig, RankedChunk, RetrievalOptions, RetrievedChunk } from './types';
import { type defaultVectorSearchConfig, VectorRetriever } from './vector';

/**
 * Default configuration for hybrid search
 */
export const defaultHybridSearchConfig: HybridSearchConfig = {
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  rrfK: 60,
  normalizeScores: true,
};

/**
 * Reciprocal Rank Fusion (RRF) implementation
 *
 * RRF formula: score = sum(1 / (k + rank)) for each list
 * where k = 60 (constant that dampens the impact of low rankings)
 *
 * @param resultsList - Array of result lists from different retrieval methods
 * @param k - RRF constant (default: 60)
 * @returns Fused and ranked results
 */
export function reciprocalRankFusion(resultsList: RetrievedChunk[][], k = 60): RankedChunk[] {
  // Map to track unique chunks and their RRF scores
  const chunkMap = new Map<string, RankedChunk>();

  // Process each result list
  resultsList.forEach((results, listIndex) => {
    results.forEach((chunk, rank) => {
      const existing = chunkMap.get(chunk.id);

      // RRF score contribution from this list
      const rrfContribution = 1 / (k + rank + 1); // +1 because rank is 0-indexed

      if (existing) {
        // Add to existing RRF score and track original rank
        existing.rrfScore += rrfContribution;
        existing.originalRanks.set(`list_${listIndex}`, rank + 1);

        // Keep the higher score
        if (chunk.score > existing.score) {
          existing.score = chunk.score;
        }
      } else {
        // Create new ranked chunk
        const rankedChunk: RankedChunk = {
          ...chunk,
          rrfScore: rrfContribution,
          originalRanks: new Map([[`list_${listIndex}`, rank + 1]]),
        };
        chunkMap.set(chunk.id, rankedChunk);
      }
    });
  });

  // Convert to array and sort by RRF score (descending)
  const rankedChunks = Array.from(chunkMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

  return rankedChunks;
}

/**
 * Normalize scores to 0-1 range for fair comparison
 */
function normalizeScores(chunks: RetrievedChunk[]): RetrievedChunk[] {
  if (chunks.length === 0) return chunks;

  const scores = chunks.map((c) => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  if (range === 0) return chunks;

  return chunks.map((chunk) => ({
    ...chunk,
    score: (chunk.score - minScore) / range,
  }));
}

/**
 * Weighted score fusion (alternative to RRF)
 * Combines normalized scores with configurable weights
 */
export function weightedScoreFusion(
  vectorResults: RetrievedChunk[],
  keywordResults: RetrievedChunk[],
  vectorWeight: number,
  keywordWeight: number
): RetrievedChunk[] {
  // Normalize scores
  const normalizedVector = normalizeScores([...vectorResults]);
  const normalizedKeyword = normalizeScores([...keywordResults]);

  // Map to track unique chunks
  const chunkMap = new Map<string, RetrievedChunk & { weightedScore: number }>();

  // Process vector results
  normalizedVector.forEach((chunk) => {
    chunkMap.set(chunk.id, {
      ...chunk,
      score: chunk.score,
      weightedScore: chunk.score * vectorWeight,
      retrievalMethod: 'hybrid-vector',
    });
  });

  // Process keyword results and combine
  normalizedKeyword.forEach((chunk) => {
    const existing = chunkMap.get(chunk.id);
    if (existing) {
      existing.weightedScore += chunk.score * keywordWeight;
      existing.retrievalMethod = 'hybrid-both';
    } else {
      chunkMap.set(chunk.id, {
        ...chunk,
        score: chunk.score,
        weightedScore: chunk.score * keywordWeight,
        retrievalMethod: 'hybrid-keyword',
      });
    }
  });

  // Sort by weighted score
  return Array.from(chunkMap.values())
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .map(({ weightedScore, ...chunk }) => chunk);
}

/**
 * Deduplicate chunks based on content similarity
 * Removes near-duplicate chunks to improve result diversity
 */
export function deduplicateChunks(
  chunks: RetrievedChunk[],
  similarityThreshold = 0.9
): RetrievedChunk[] {
  const deduplicated: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    let isDuplicate = false;

    for (const existing of deduplicated) {
      const similarity = calculateJaccardSimilarity(chunk.content, existing.content);
      if (similarity >= similarityThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(chunk);
    }
  }

  return deduplicated;
}

/**
 * Calculate Jaccard similarity between two strings
 * Simple token-based similarity for deduplication
 */
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Hybrid Retriever class
 */
export class HybridRetriever {
  private vectorRetriever: VectorRetriever;
  private keywordRetriever: KeywordRetriever;
  private config: HybridSearchConfig;

  constructor(
    vectorConfig?: Partial<typeof defaultVectorSearchConfig>,
    keywordConfig?: Partial<typeof defaultKeywordSearchConfig>,
    config?: Partial<HybridSearchConfig>
  ) {
    this.vectorRetriever = new VectorRetriever(vectorConfig);
    this.keywordRetriever = new KeywordRetriever(keywordConfig);
    this.config = { ...defaultHybridSearchConfig, ...config };
  }

  /**
   * Perform hybrid retrieval
   */
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const startTime = Date.now();
    const topK = options.topK ?? 5;

    // Generate embedding for vector search
    const queryEmbedding = await generateEmbedding(query);

    // Run vector and keyword searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorRetriever.retrieve(queryEmbedding, {
        ...options,
        topK: topK * 2, // Get more results for fusion
      }),
      this.keywordRetriever.retrieve(query, {
        ...options,
        topK: topK * 2,
      }),
    ]);

    console.log(
      `[HybridRetriever] Vector: ${vectorResults.length}, Keyword: ${keywordResults.length} results`
    );

    // Apply RRF fusion
    const fusedResults = reciprocalRankFusion([vectorResults, keywordResults], this.config.rrfK);

    // Convert back to RetrievedChunk format
    let finalChunks: RetrievedChunk[] = fusedResults.map((ranked) => ({
      id: ranked.id,
      content: ranked.content,
      score: ranked.rrfScore, // Use RRF score as the final score
      metadata: ranked.metadata,
      retrievalMethod: ranked.retrievalMethod.includes('hybrid')
        ? ranked.retrievalMethod
        : 'hybrid-rrf',
    }));

    // Deduplicate results
    finalChunks = deduplicateChunks(finalChunks);

    // Limit to topK
    finalChunks = finalChunks.slice(0, topK);

    console.log(
      `[HybridRetriever] Fused to ${finalChunks.length} chunks in ${Date.now() - startTime}ms`
    );

    return finalChunks;
  }

  /**
   * Retrieve with weighted score fusion (alternative to RRF)
   */
  async retrieveWeighted(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const startTime = Date.now();
    const topK = options.topK ?? 5;

    // Generate embedding for vector search
    const queryEmbedding = await generateEmbedding(query);

    // Run searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorRetriever.retrieve(queryEmbedding, {
        ...options,
        topK: topK * 2,
      }),
      this.keywordRetriever.retrieve(query, {
        ...options,
        topK: topK * 2,
      }),
    ]);

    // Apply weighted fusion
    let finalChunks = weightedScoreFusion(
      vectorResults,
      keywordResults,
      this.config.vectorWeight,
      this.config.keywordWeight
    );

    // Deduplicate and limit
    finalChunks = deduplicateChunks(finalChunks).slice(0, topK);

    console.log(
      `[HybridRetriever] Weighted fusion: ${finalChunks.length} chunks in ${Date.now() - startTime}ms`
    );

    return finalChunks;
  }

  /**
   * Get the configuration
   */
  getConfig(): HybridSearchConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HybridSearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update vector retriever config
   */
  updateVectorConfig(config: Parameters<VectorRetriever['updateConfig']>[0]): void {
    this.vectorRetriever.updateConfig(config);
  }

  /**
   * Update keyword retriever config
   */
  updateKeywordConfig(config: Parameters<KeywordRetriever['updateConfig']>[0]): void {
    this.keywordRetriever.updateConfig(config);
  }
}

/**
 * Convenience function for hybrid search
 */
export async function searchHybrid(
  query: string,
  options: RetrievalOptions,
  config?: Partial<HybridSearchConfig>
): Promise<RetrievedChunk[]> {
  const retriever = new HybridRetriever(undefined, undefined, config);
  return retriever.retrieve(query, options);
}

/**
 * Convenience function for weighted hybrid search
 */
export async function searchHybridWeighted(
  query: string,
  options: RetrievalOptions,
  config?: Partial<HybridSearchConfig>
): Promise<RetrievedChunk[]> {
  const retriever = new HybridRetriever(undefined, undefined, config);
  return retriever.retrieveWeighted(query, options);
}
