/**
 * Keyword/Full-Text Search using Qdrant
 *
 * Implements keyword search using Qdrant's text matching capabilities.
 * Supports multiple query parsing methods and filtering.
 */

import { searchKeyword as qdrantKeywordSearch } from '@/lib/vector';
import { buildQdrantFilter } from '@/lib/vector/filters';
import type { KeywordSearchConfig, RetrievalOptions, RetrievedChunk } from './types';

/**
 * Default configuration for keyword search
 */
export const defaultKeywordSearchConfig: KeywordSearchConfig = {
  language: 'english',
  queryType: 'websearch',
  highlight: true,
  highlightStartTag: '<mark>',
  highlightEndTag: '</mark>',
};

/**
 * Supported languages for full-text search
 */
export const supportedLanguages = [
  'english',
  'spanish',
  'french',
  'german',
  'italian',
  'portuguese',
  'dutch',
  'russian',
  'chinese',
  'japanese',
  'korean',
  'arabic',
  'hindi',
  'simple', // language-independent
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

function validateIdentifier(value: string, name: string): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
    throw new Error(`Invalid ${name}: must be alphanumeric with hyphens/underscores, max 64 chars`);
  }
}

/**
 * Keyword Retriever class for keyword search using Qdrant
 */
export class KeywordRetriever {
  private config: KeywordSearchConfig;

  constructor(config: Partial<KeywordSearchConfig> = {}) {
    this.config = { ...defaultKeywordSearchConfig, ...config };
  }

  /**
   * Perform keyword/full-text search using Qdrant
   */
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.01;

    try {
      const filter = buildQdrantFilter({
        userId: options.userId,
        workspaceId: options.workspaceId,
        filters: options.filters,
      });

      const results = await qdrantKeywordSearch(query, { filter, topK: topK * 2 });

      // Transform to RetrievedChunk format
      const chunks: RetrievedChunk[] = results
        .map((point) => {
          const p = point.payload as Record<string, unknown>;
          return {
            id: String(point.id),
            content: (p?.content as string) ?? '',
            score: point.score ?? 0,
            metadata: {
              documentId: (p?.documentId as string) ?? '',
              documentName: (p?.documentName as string) ?? '',
              documentType: (p?.documentType as string) ?? 'unknown',
              page: (p?.page as number) ?? undefined,
              position: (p?.index as number) ?? 0,
              section: (p?.section as string) ?? undefined,
            },
            retrievalMethod: `keyword-${this.config.queryType}`,
          };
        })
        .filter((chunk) => chunk.score >= minScore)
        .slice(0, topK);

      return chunks;
    } catch (error) {
      throw new Error(
        `Keyword search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get search suggestions based on partial query
   * Note: With Qdrant, suggestions are approximated from keyword search results
   */
  async getSuggestions(partialQuery: string, workspaceId: string, limit = 5): Promise<string[]> {
    validateIdentifier(workspaceId, 'workspaceId');

    const filter = buildQdrantFilter({ workspaceId });
    const results = await qdrantKeywordSearch(partialQuery, { filter, topK: limit * 2 });

    // Extract unique words from matching content
    const words = new Set<string>();
    const prefix = partialQuery.toLowerCase();
    for (const point of results) {
      const p = point.payload as Record<string, unknown>;
      const content = (p?.content as string) ?? '';
      const contentWords = content.toLowerCase().split(/\s+/);
      for (const word of contentWords) {
        if (word.startsWith(prefix) && word.length > 2) {
          words.add(word);
          if (words.size >= limit) break;
        }
      }
      if (words.size >= limit) break;
    }

    return Array.from(words).slice(0, limit);
  }

  /**
   * Get term frequency statistics for a workspace
   * Note: With Qdrant, term stats are approximated from search results
   */
  async getTermStats(
    workspaceId: string,
    _limit = 100
  ): Promise<Array<{ term: string; frequency: number }>> {
    validateIdentifier(workspaceId, 'workspaceId');

    // Qdrant does not provide global term statistics like PostgreSQL ts_stat.
    // Return empty results — callers should use a dedicated analytics pipeline.
    return [];
  }

  /**
   * Get the configuration
   */
  getConfig(): KeywordSearchConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<KeywordSearchConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Convenience function for single keyword search
 */
export async function searchKeyword(
  query: string,
  options: RetrievalOptions,
  config?: Partial<KeywordSearchConfig>
): Promise<RetrievedChunk[]> {
  const retriever = new KeywordRetriever(config);
  return retriever.retrieve(query, options);
}

/**
 * SQL to create tsvector search index
 * @deprecated No longer needed with Qdrant — keyword search uses Qdrant text matching.
 */
export function createSearchIndexSQL(): string {
  return '-- Keyword search is now handled by Qdrant. No SQL index needed.';
}

/**
 * SQL to drop search index and related objects
 * @deprecated No longer needed with Qdrant.
 */
export function dropSearchIndexSQL(): string {
  return '-- Keyword search is now handled by Qdrant. No SQL index to drop.';
}

/**
 * Check if search index exists
 * @deprecated With Qdrant, text matching is always available.
 */
export async function searchIndexExists(): Promise<boolean> {
  return true;
}
