/**
 * Keyword/Full-Text Search using PostgreSQL tsvector
 *
 * Implements BM25-style ranking using PostgreSQL's full-text search capabilities.
 * Supports multiple query parsing methods and highlighting of matching terms.
 */

import { prisma } from '@/lib/db';
import type {
  KeywordSearchConfig,
  RawSearchResult,
  RetrievalOptions,
  RetrievedChunk,
} from './types';

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

/**
 * Get the tsquery generation function based on query type
 */
function getTsqueryFunction(queryType: string): string {
  switch (queryType) {
    case 'plain':
      return 'plainto_tsquery';
    case 'phrase':
      return 'phraseto_tsquery';
    case 'websearch':
      return 'websearch_to_tsquery';
    default:
      return 'websearch_to_tsquery';
  }
}

/**
 * Parse and validate language
 */
function validateLanguage(lang: string): SupportedLanguage {
  if (supportedLanguages.includes(lang as SupportedLanguage)) {
    return lang as SupportedLanguage;
  }
  return 'english';
}

/**
 * Build WHERE clause filters for keyword search
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

  const whereClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';

  return { whereClause, params, nextIndex: idx };
}

/**
 * Keyword Retriever class for full-text search
 */
export class KeywordRetriever {
  private config: KeywordSearchConfig;

  constructor(config: Partial<KeywordSearchConfig> = {}) {
    this.config = { ...defaultKeywordSearchConfig, ...config };
  }

  /**
   * Perform keyword/full-text search
   */
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const startTime = Date.now();
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.01; // BM25 scores are typically small
    const language = validateLanguage(this.config.language ?? 'english');
    const tsqueryFn = getTsqueryFunction(this.config.queryType ?? 'websearch');

    // Build filters
    const { whereClause, params, nextIndex } = buildFilters(options, 1);
    const queryParam = `$${nextIndex}`;
    const languageParam = `$${nextIndex + 1}`;
    const limitParam = `$${nextIndex + 2}`;

    // Build highlight expression
    const highlightExpr = this.config.highlight
      ? `ts_headline(
          ${languageParam}::regconfig,
          dc.content,
          ${tsqueryFn}(${languageParam}::regconfig, ${queryParam}),
          'StartSel=${this.config.highlightStartTag}, StopSel=${this.config.highlightEndTag}, MaxWords=50, MinWords=10'
        ) as highlighted_content`
      : 'dc.content as highlighted_content';

    // Build the SQL query with BM25-style ranking using ts_rank_cd
    // ts_rank_cd computes the cover density ranking, which is similar to BM25
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
        ts_rank_cd(
          dc.search_vector,
          ${tsqueryFn}(${languageParam}::regconfig, ${queryParam}),
          32 /* rank normalization: divide by document length + 1 */
        ) as score,
        ${highlightExpr}
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.search_vector @@ ${tsqueryFn}(${languageParam}::regconfig, ${queryParam})
        ${whereClause}
      ORDER BY score DESC
      LIMIT ${limitParam}
    `;

    try {
      // Add query, language, and limit to params
      const queryParams = [...params, query, language ?? 'english', topK * 2];

      const results = await prisma.$queryRawUnsafe<
        Array<RawSearchResult & { highlighted_content?: string }>
      >(sqlQuery, ...queryParams);

      // Transform to RetrievedChunk format
      const chunks: RetrievedChunk[] = results.map((result) => ({
        id: result.id,
        content:
          this.config.highlight && result.highlighted_content
            ? result.highlighted_content
            : result.content,
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
        retrievalMethod: `keyword-${this.config.queryType}`,
      }));

      // Post-filtering by score
      const filteredChunks = chunks.filter((chunk) => chunk.score >= minScore).slice(0, topK);

      console.log(
        `[KeywordRetriever] Found ${filteredChunks.length} chunks in ${Date.now() - startTime}ms`
      );

      return filteredChunks;
    } catch (error) {
      console.error('[KeywordRetriever] Search error:', error);
      throw new Error(
        `Keyword search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, workspaceId: string, limit = 5): Promise<string[]> {
    validateLanguage(this.config.language ?? 'english');

    const results = await prisma.$queryRaw<Array<{ word: string }>>`
      SELECT DISTINCT word
      FROM ts_stat(${
        `SELECT search_vector FROM document_chunks dc ` +
        `JOIN documents d ON dc.document_id = d.id ` +
        `WHERE d.user_id = '${workspaceId}' AND d.status = 'COMPLETED'`
      })
      WHERE word LIKE ${partialQuery.toLowerCase() + '%'}
      ORDER BY nentry DESC, word ASC
      LIMIT ${limit}
    `;

    return results.map((r) => r.word);
  }

  /**
   * Get term frequency statistics for a workspace
   */
  async getTermStats(
    workspaceId: string,
    limit = 100
  ): Promise<Array<{ term: string; frequency: number }>> {
    const language = validateLanguage(this.config.language ?? 'english');

    const results = await prisma.$queryRaw<Array<{ word: string; nentry: bigint; ndoc: bigint }>>`
      SELECT word, nentry, ndoc
      FROM ts_stat(${
        `SELECT to_tsvector('${language}', content) FROM document_chunks dc ` +
        `JOIN documents d ON dc.document_id = d.id ` +
        `WHERE d.user_id = '${workspaceId}' AND d.status = 'COMPLETED'`
      })
      ORDER BY nentry DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      term: r.word,
      frequency: Number(r.nentry),
    }));
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
 * Run this as a migration
 */
export function createSearchIndexSQL(
  language: SupportedLanguage = 'english',
  indexName = 'idx_chunks_search'
): string {
  return `
    -- Add search_vector column if it doesn't exist
    ALTER TABLE "document_chunks" 
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

    -- Create GIN index for full-text search
    CREATE INDEX IF NOT EXISTS ${indexName} 
    ON "document_chunks" 
    USING GIN(search_vector);

    -- Create function to automatically update search_vector
    CREATE OR REPLACE FUNCTION update_search_vector()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.search_vector := to_tsvector('${language}', COALESCE(NEW.content, ''));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger to update search_vector on insert/update
    DROP TRIGGER IF EXISTS trigger_update_search_vector ON "document_chunks";
    CREATE TRIGGER trigger_update_search_vector
    BEFORE INSERT OR UPDATE OF content ON "document_chunks"
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

    -- Update existing rows
    UPDATE "document_chunks" 
    SET search_vector = to_tsvector('${language}', content)
    WHERE search_vector IS NULL;
  `;
}

/**
 * SQL to drop search index and related objects
 */
export function dropSearchIndexSQL(indexName = 'idx_chunks_search'): string {
  return `
    DROP TRIGGER IF EXISTS trigger_update_search_vector ON "document_chunks";
    DROP FUNCTION IF EXISTS update_search_vector();
    DROP INDEX IF EXISTS ${indexName};
    ALTER TABLE "document_chunks" DROP COLUMN IF EXISTS search_vector;
  `;
}

/**
 * Check if search index exists
 */
export async function searchIndexExists(indexName = 'idx_chunks_search'): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = ${indexName}
    ) as exists
  `;
  return result[0].exists;
}
