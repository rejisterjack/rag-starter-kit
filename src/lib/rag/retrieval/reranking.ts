/**
 * Re-ranking Module
 * 
 * Implements result re-ranking using:
 * - Cohere Rerank API (external service)
 * - Local cross-encoder model (fallback)
 * - Simple keyword overlap scoring (baseline)
 */

import type { RetrievedChunk, RerankConfig } from './types';

/**
 * Reranker interface
 */
export interface Reranker {
  rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]>;
  readonly name: string;
}

/**
 * Default re-ranking configuration
 */
export const defaultRerankConfig: RerankConfig = {
  provider: 'local',
  model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  topN: 10,
};

/**
 * Cohere Rerank API response
 */
interface CohereRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

/**
 * Cohere Reranker implementation
 * Uses Cohere's rerank API for improved result ordering
 * 
 * @see https://docs.cohere.com/docs/rerank
 */
export class CohereReranker implements Reranker {
  readonly name = 'cohere';
  private apiKey: string;
  private model: string;
  private topN: number;

  constructor(apiKey?: string, model = 'rerank-english-v2.0', topN = 10) {
    this.apiKey = apiKey ?? process.env.COHERE_API_KEY ?? '';
    this.model = model;
    this.topN = topN;

    if (!this.apiKey) {
      console.warn('[CohereReranker] No API key provided, re-ranking will fail');
    }
  }

  /**
   * Re-rank chunks using Cohere API
   */
  async rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    if (!this.apiKey) {
      throw new Error('Cohere API key not configured');
    }

    if (chunks.length === 0) {
      return chunks;
    }

    try {
      const response = await fetch('https://api.cohere.com/v1/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          query,
          documents: chunks.map((c) => c.content),
          top_n: Math.min(this.topN, chunks.length),
          return_documents: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cohere API error: ${error}`);
      }

      const data = (await response.json()) as CohereRerankResponse;

      // Reorder chunks based on rerank results
      const rerankedChunks = data.results
        .map((result) => ({
          ...chunks[result.index],
          score: result.relevance_score,
          retrievalMethod: `${chunks[result.index].retrievalMethod}-cohere`,
        }))
        .slice(0, this.topN);

      console.log(`[CohereReranker] Re-ranked ${chunks.length} chunks`);
      return rerankedChunks;
    } catch (error) {
      console.error('[CohereReranker] Re-ranking failed:', error);
      // Return original chunks sorted by original score
      return chunks.sort((a, b) => b.score - a.score);
    }
  }
}

/**
 * Local cross-encoder reranker (fallback)
 * 
 * This is a simplified implementation that uses keyword overlap
 * and other heuristics. In production, you would use:
 * - sentence-transformers cross-encoder
 * - ONNX runtime for local inference
 * - BERT-based models like ms-marco-MiniLM
 */
export class LocalReranker implements Reranker {
  readonly name = 'local';
  private topN: number;

  constructor(topN = 10) {
    this.topN = topN;
  }

  /**
   * Re-rank chunks using local cross-encoder simulation
   * Uses keyword overlap, phrase matching, and semantic features
   */
  async rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    const queryLower = query.toLowerCase();
    const queryTerms = this.extractTerms(queryLower);
    const queryPhrases = this.extractPhrases(queryLower);

    // Score each chunk
    const scoredChunks = chunks.map((chunk) => {
      const chunkLower = chunk.content.toLowerCase();
      const chunkTerms = this.extractTerms(chunkLower);

      // Calculate various matching scores
      const scores = {
        // Term overlap (Jaccard similarity)
        termOverlap: this.calculateJaccardSimilarity(queryTerms, chunkTerms),
        
        // Exact phrase matches
        phraseMatch: queryPhrases.filter((p) => chunkLower.includes(p)).length / queryPhrases.length,
        
        // Keyword frequency (BM25-inspired)
        keywordFreq: this.calculateKeywordFrequency(queryTerms, chunkLower),
        
        // Original retrieval score (weighted less)
        originalScore: chunk.score * 0.3,
        
        // Position bonus (earlier chunks often more relevant)
        positionBonus: 1 / (1 + chunk.metadata.position * 0.1),
        
        // Heading match bonus
        headingMatch: chunk.metadata.headings?.some((h) => 
          queryTerms.some((qt) => h.toLowerCase().includes(qt))
        ) ? 0.2 : 0,
      };

      // Combined score with weights
      const combinedScore = 
        scores.termOverlap * 0.25 +
        scores.phraseMatch * 0.25 +
        scores.keywordFreq * 0.20 +
        scores.originalScore +
        scores.positionBonus * 0.05 +
        scores.headingMatch;

      return {
        ...chunk,
        score: Math.min(1, Math.max(0, combinedScore)),
        retrievalMethod: `${chunk.retrievalMethod}-local-rerank`,
      };
    });

    // Sort by score and return top N
    const reranked = scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topN);

    console.log(`[LocalReranker] Re-ranked ${chunks.length} chunks`);
    return reranked;
  }

  /**
   * Extract individual terms from text
   */
  private extractTerms(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !this.isStopWord(t));
  }

  /**
   * Extract phrases (2-3 word sequences) from text
   */
  private extractPhrases(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
    return phrases;
  }

  /**
   * Calculate Jaccard similarity between two term sets
   */
  private calculateJaccardSimilarity(terms1: string[], terms2: string[]): number {
    const set1 = new Set(terms1);
    const set2 = new Set(terms2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / Math.max(union.size, 1);
  }

  /**
   * Calculate keyword frequency score (BM25-inspired)
   */
  private calculateKeywordFrequency(queryTerms: string[], content: string): number {
    let score = 0;
    for (const term of queryTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        // Logarithmic term frequency with length normalization
        score += Math.log(1 + matches.length) / Math.log(2);
      }
    }
    // Normalize by query term count
    return score / Math.max(queryTerms.length, 1);
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'and', 'but', 'or', 'yet', 'so', 'if',
      'because', 'although', 'though', 'while', 'where', 'when',
      'that', 'which', 'who', 'whom', 'whose', 'what', 'this',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    ]);
    return stopWords.has(word.toLowerCase());
  }
}

/**
 * Simple keyword overlap reranker (baseline)
 * Fast but less accurate than cross-encoder
 */
export class KeywordOverlapReranker implements Reranker {
  readonly name = 'keyword-overlap';
  private topN: number;

  constructor(topN = 10) {
    this.topN = topN;
  }

  async rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    const queryTerms = new Set(
      query.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
    );

    const scoredChunks = chunks.map((chunk) => {
      const chunkTerms = new Set(
        chunk.content.toLowerCase().split(/\s+/)
      );

      // Calculate overlap
      const intersection = new Set([...queryTerms].filter((x) => chunkTerms.has(x)));
      const overlapScore = intersection.size / queryTerms.size;

      // Combined score
      const combinedScore = chunk.score * 0.5 + overlapScore * 0.5;

      return {
        ...chunk,
        score: combinedScore,
        retrievalMethod: `${chunk.retrievalMethod}-keyword-rerank`,
      };
    });

    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topN);
  }
}

/**
 * Factory function to create appropriate reranker
 */
export function createReranker(config?: Partial<RerankConfig>): Reranker {
  const provider = config?.provider ?? defaultRerankConfig.provider;

  switch (provider) {
    case 'cohere':
      return new CohereReranker(
        config?.apiKey,
        config?.model,
        config?.topN
      );
    case 'local':
      return new LocalReranker(config?.topN);
    case 'none':
    default:
      // Return a no-op reranker
      return {
        name: 'none',
        async rerank(_query: string, chunks: RetrievedChunk[]) {
          return chunks;
        },
      };
  }
}

/**
 * Convenience function for re-ranking
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  config?: Partial<RerankConfig>
): Promise<RetrievedChunk[]> {
  const reranker = createReranker(config);
  return reranker.rerank(query, chunks);
}

/**
 * Diversify results using Maximal Marginal Relevance (MMR)
 * Balances relevance with diversity to reduce redundancy
 * 
 * @param chunks - Retrieved chunks
 * @param lambda - Trade-off parameter (0 = max diversity, 1 = max relevance)
 * @param topN - Number of results to return
 */
export function diversifyWithMMR(
  chunks: RetrievedChunk[],
  lambda = 0.5,
  topN = 5
): RetrievedChunk[] {
  if (chunks.length <= topN) {
    return chunks;
  }

  const selected: RetrievedChunk[] = [];
  const remaining = [...chunks];

  // Select first chunk (highest relevance)
  selected.push(remaining.shift()!);

  while (selected.length < topN && remaining.length > 0) {
    // Calculate MMR scores for remaining chunks
    const mmrScores = remaining.map((chunk) => {
      // Relevance component (already in chunk.score)
      const relevance = chunk.score;

      // Diversity component (max similarity to already selected)
      const maxSimilarity = Math.max(
        ...selected.map((s) => calculateSimilarity(chunk, s))
      );

      // MMR formula: lambda * relevance - (1 - lambda) * max_similarity
      return lambda * relevance - (1 - lambda) * maxSimilarity;
    });

    // Select chunk with highest MMR score
    const maxIndex = mmrScores.indexOf(Math.max(...mmrScores));
    selected.push(remaining.splice(maxIndex, 1)[0]);
  }

  return selected;
}

/**
 * Calculate simple content similarity between two chunks
 */
function calculateSimilarity(chunk1: RetrievedChunk, chunk2: RetrievedChunk): number {
  const terms1 = new Set(chunk1.content.toLowerCase().split(/\s+/));
  const terms2 = new Set(chunk2.content.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...terms1].filter((x) => terms2.has(x)));
  const union = new Set([...terms1, ...terms2]);
  
  return intersection.size / union.size;
}
