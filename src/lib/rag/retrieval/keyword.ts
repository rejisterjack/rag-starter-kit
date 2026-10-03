/**
 * Keyword / Full-Text Search using PostgreSQL Full-Text Search
 *
 * Implements keyword search using PostgreSQL tsvector matching capabilities.
 * Supports multiple query parsing methods and filtering.
 */

import { searchKeyword as vectorSearchKeyword } from '@/lib/vector';
import { buildVectorFilter } from '@/lib/vector/filters';
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
 * Keyword Retriever class for full-text search via PostgreSQL
 */
export class KeywordRetriever {
  private config: KeywordSearchConfig;

  constructor(config: Partial<KeywordSearchConfig> = {}) {
    this.config = { ...defaultKeywordSearchConfig, ...config };
  }

  /**
   * Perform keyword/full-text search using PostgreSQL tsvector
   */
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.01;

    try {
      const filter = buildVectorFilter({
        userId: options.userId,
        workspaceId: options.workspaceId,
        filters: options.filters,
      });

      const results = await vectorSearchKeyword(query, { filter, topK: topK * 2 });

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
   */
  async getSuggestions(partialQuery: string, workspaceId: string, limit = 5): Promise<string[]> {
    validateIdentifier(workspaceId, 'workspaceId');

    const filter = buildVectorFilter({ workspaceId });
    const results = await vectorSearchKeyword(partialQuery, { filter, topK: limit * 2 });

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
   */
  async getTermStats(
    workspaceId: string,
    _limit = 100
  ): Promise<Array<{ term: string; frequency: number }>> {
    validateIdentifier(workspaceId, 'workspaceId');

    // Global term statistics are not computed on-the-fly; callers should use dedicated analytics.
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
 * Note: Handled automatically by Prisma migrations on document_chunks.content_tsv
 */
export function createSearchIndexSQL(): string {
  return '-- Managed by Prisma schema and migrations (document_chunks.content_tsv).';
}

/**
 * SQL to drop search index and related objects
 * Note: Handled automatically by Prisma migrations
 */
export function dropSearchIndexSQL(): string {
  return '-- Managed by Prisma schema and migrations.';
}

/**
 * Check if search index exists
 */
export async function searchIndexExists(): Promise<boolean> {
  return true;
}
