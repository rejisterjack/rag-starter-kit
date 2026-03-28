/**
 * @fileoverview RAG Retrieval Module - Vector search and source retrieval
 *
 * Provides comprehensive retrieval capabilities for the RAG pipeline:
 * - Vector similarity search using pgvector
 * - Hybrid search (vector + full-text)
 * - Source reranking and deduplication
 * - Semantic caching support
 *
 * ## Retrieval Strategies
 *
 * 1. **Vector Search**: Semantic similarity using embeddings
 * 2. **Keyword Search**: Full-text search with PostgreSQL tsvector
 * 3. **Hybrid Search**: Combines both using Reciprocal Rank Fusion (RRF)
 *
 * ## Usage
 *
 * ```typescript
 * import { retrieveSources, hybridSearch } from '@/lib/rag/retrieval';
 *
 * // Basic vector retrieval
 * const sources = await retrieveSources(
 *   "What are the key findings?",
 *   userId,
 *   { topK: 5, similarityThreshold: 0.7 }
 * );
 *
 * // Hybrid search for better recall
 * const hybridSources = await hybridSearch(
 *   "quarterly revenue",
 *   queryEmbedding,
 *   userId,
 *   { topK: 5 }
 * );
 *
 * // Build context from sources
 * const context = buildContext(sources, 4000);
 * ```
 *
 * @module rag/retrieval
 * @see {@link module:db/vector-store} for vector store implementation
 * @see {@link https://github.com/pgvector/pgvector|pgvector Documentation}
 */

import { createEmbeddingProviderFromEnv } from '@/lib/ai/embeddings';
import { createVectorStore, prisma, type SearchOptions } from '@/lib/db';
import { createSemanticCache, MemoryCacheProvider } from '@/lib/db/vector-cache';
import { tracing } from '@/lib/tracing';
import type { RAGConfig, Source, VectorSearchResult } from '@/types';

// Initialize semantic cache (can be replaced with Redis provider in production)
export const semanticCache = createSemanticCache(new MemoryCacheProvider(), {
  keyPrefix: 'rag:retrieval:',
  defaultTtl: 3600, // 1 hour default TTL
  similarityThreshold: 0.95, // 95% similarity threshold for cache hits
});

/**
 * Generate embedding for a query string
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const provider = createEmbeddingProviderFromEnv();
  return provider.embedQuery(query);
}

/**
 * Search for similar chunks in the vector database
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  userId: string,
  config: Partial<RAGConfig> = {}
): Promise<VectorSearchResult[]> {
  const vectorStore = createVectorStore(prisma);

  const searchOptions: SearchOptions = {
    userId,
    topK: config.topK ?? 5,
    minScore: config.similarityThreshold ?? 0.7,
    searchType: 'cosine',
    filter: config.filter,
  };

  const results = await vectorStore.similaritySearch(
    '', // Query is not needed when we already have embedding
    queryEmbedding,
    searchOptions
  );

  return results.map((r) => ({
    id: r.chunkId,
    documentId: r.metadata.documentId,
    content: r.content,
    index: r.metadata.index,
    page: r.metadata.page ?? null,
    section: r.metadata.section ?? null,
    documentName: r.metadata.documentName,
    similarity: r.score,
  }));
}

/**
 * Search similar chunks by document IDs (filtered search)
 */
export async function searchSimilarChunksByDocuments(
  queryEmbedding: number[],
  userId: string,
  documentIds: string[],
  config: Partial<RAGConfig> = {}
): Promise<VectorSearchResult[]> {
  const vectorStore = createVectorStore(prisma);

  const searchOptions: SearchOptions = {
    userId,
    topK: config.topK ?? 5,
    minScore: config.similarityThreshold ?? 0.7,
    searchType: 'cosine',
    filter: {
      documentIds,
    },
  };

  const results = await vectorStore.similaritySearch('', queryEmbedding, searchOptions);

  return results.map((r) => ({
    id: r.chunkId,
    documentId: r.metadata.documentId,
    content: r.content,
    index: r.metadata.index,
    page: r.metadata.page ?? null,
    section: r.metadata.section ?? null,
    documentName: r.metadata.documentName,
    similarity: r.score,
  }));
}

/**
 * Retrieve relevant sources for a query
 */
export async function retrieveSources(
  query: string,
  userId: string,
  config: Partial<RAGConfig> = {}
): Promise<Source[]> {
  return tracing.retrieveSources(query, config.topK ?? 5, async () => {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // Check semantic cache first
    const cachedResults = await semanticCache.findSimilar(query, queryEmbedding);
    if (cachedResults) {
      return cachedResults as Source[];
    }

    // Search for similar chunks
    const results = await searchSimilarChunks(queryEmbedding, userId, config);

    // Map to Source type
    const sources = results.map((result) => ({
      id: result.id,
      content: result.content,
      similarity: result.similarity,
      metadata: {
        documentId: result.documentId,
        documentName: result.documentName,
        page: result.page ?? undefined,
        chunkIndex: result.index,
        totalChunks: 0, // Will be populated if needed
      },
    }));

    // Apply reranking if enabled
    let finalSources: Source[];
    if (config.rerank && sources.length > 1) {
      const reranked = rerankSources(sources, query);
      finalSources = deduplicateSources(reranked, config.maxSourcesPerDocument);
    } else {
      finalSources = deduplicateSources(sources, config.maxSourcesPerDocument);
    }

    // Cache the results
    await semanticCache.set(query, queryEmbedding, finalSources, config.cacheTtl);

    return finalSources;
  }) as Promise<Source[]>;
}

/**
 * Retrieve sources with semantic caching support
 */
export async function retrieveSourcesWithCache(
  query: string,
  userId: string,
  cache: {
    get(query: string, embedding: number[]): Promise<Source[] | null>;
    set(query: string, embedding: number[], sources: Source[], ttl?: number): Promise<void>;
  },
  config: Partial<RAGConfig> = {}
): Promise<Source[]> {
  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);

  // Check cache
  const cached = await cache.get(query, queryEmbedding);
  if (cached) {
    return cached;
  }

  // Perform search
  const sources = await retrieveSources(query, userId, config);

  // Cache results
  await cache.set(query, queryEmbedding, sources, config.cacheTtl);

  return sources;
}

/**
 * Build a context string from retrieved sources
 */
export function buildContext(sources: Source[], maxLength = 4000): string {
  if (sources.length === 0) {
    return '';
  }

  let context = '';
  let currentLength = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) continue;

    const sourceText = `[${i + 1}] Source: ${source.metadata.documentName}${source.metadata.page ? `, Page ${source.metadata.page}` : ''}\n${source.content}\n\n`;

    // Check if adding this source would exceed max length
    if (currentLength + sourceText.length > maxLength) {
      // Try to add a truncated version
      const remainingSpace = maxLength - currentLength;
      if (remainingSpace > 200) {
        context += `[${i + 1}] Source: ${source.metadata.documentName} (truncated)\n${source.content.slice(0, remainingSpace - 100)}...\n\n`;
      }
      break;
    }

    context += sourceText;
    currentLength += sourceText.length;
  }

  return context.trim();
}

/**
 * Format sources for citation in responses
 */
export function formatSourceCitations(sources: Source[]): string {
  if (sources.length === 0) {
    return '';
  }

  return sources
    .map((source, index) => {
      const meta = source.metadata;
      return `[${index + 1}] ${meta.documentName}${meta.page ? `, p.${meta.page}` : ''}`;
    })
    .join('\n');
}

/**
 * Rerank sources using a simple scoring algorithm
 * This can be enhanced with a dedicated reranking model like Cohere Rerank
 */
export function rerankSources(sources: Source[], query: string): Source[] {
  // Simple reranking based on:
  // 1. Original similarity score (40%)
  // 2. Keyword overlap (30%)
  // 3. Source recency/diversity (30%)

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  return sources
    .map((source) => {
      const contentTerms = source.content.toLowerCase().split(/\s+/);
      const overlap = queryTerms.filter((term) => contentTerms.includes(term)).length;
      const keywordScore = queryTerms.length > 0 ? overlap / queryTerms.length : 0;

      // Combined score
      const score = (source.similarity ?? 0) * 0.4 + keywordScore * 0.3 + 0.3; // diversity bonus

      return { ...source, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Deduplicate sources from the same document section
 */
export function deduplicateSources(sources: Source[], maxPerDocument = 3): Source[] {
  const documentCounts = new Map<string, number>();
  const deduplicated: Source[] = [];

  for (const source of sources) {
    const docId = source.metadata.documentId;
    const count = documentCounts.get(docId) ?? 0;

    if (count < maxPerDocument) {
      deduplicated.push(source);
      documentCounts.set(docId, count + 1);
    }
  }

  return deduplicated;
}

/**
 * Aggregate chunks by document for summary view
 */
export function aggregateByDocument(sources: Source[]): Array<{
  documentId: string;
  documentName: string;
  chunks: Source[];
  relevance: number;
}> {
  const docMap = new Map<string, { name: string; chunks: Source[] }>();

  for (const source of sources) {
    const existing = docMap.get(source.metadata.documentId);
    if (existing) {
      existing.chunks.push(source);
    } else {
      docMap.set(source.metadata.documentId, {
        name: source.metadata.documentName,
        chunks: [source],
      });
    }
  }

  return Array.from(docMap.entries())
    .map(([documentId, data]) => ({
      documentId,
      documentName: data.name,
      chunks: data.chunks,
      relevance: Math.max(...data.chunks.map((c) => c.similarity ?? 0)),
    }))
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Get document statistics for retrieved sources
 */
export async function getSourceDocumentStats(sources: Source[]): Promise<
  Array<{
    documentId: string;
    documentName: string;
    totalChunks: number;
    matchedChunks: number;
  }>
> {
  const documentIds = [...new Set(sources.map((s) => s.metadata.documentId))];

  const stats = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    include: {
      _count: { select: { chunks: true } },
    },
  });

  const matchedCounts = new Map<string, number>();
  for (const source of sources) {
    matchedCounts.set(
      source.metadata.documentId,
      (matchedCounts.get(source.metadata.documentId) ?? 0) + 1
    );
  }

  return stats.map((doc) => ({
    documentId: doc.id,
    documentName: doc.name,
    totalChunks: doc._count.chunks,
    matchedChunks: matchedCounts.get(doc.id) ?? 0,
  }));
}

/**
 * Hybrid search combining vector similarity with full-text search
 * Note: This requires the SQL templates for optimal performance
 */
export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  userId: string,
  config: Partial<RAGConfig> = {}
): Promise<VectorSearchResult[]> {
  // Get vector search results
  const vectorResults = await searchSimilarChunks(queryEmbedding, userId, {
    ...config,
    topK: (config.topK ?? 5) * 2, // Get more for fusion
  });

  // Get full-text search results using Prisma
  const textResults = await prisma.$queryRaw<
    Array<{
      id: string;
      documentId: string;
      content: string;
      index: number;
      page: number | null;
      section: string | null;
      documentName: string;
      textScore: number;
    }>
  >`
    SELECT
      dc.id,
      dc.document_id as "documentId",
      dc.content,
      dc.index,
      dc.page,
      dc.section,
      d.name as "documentName",
      ts_rank_cd(
        to_tsvector('english', dc.content),
        plainto_tsquery('english', ${query})
      ) as "textScore"
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = ${userId}
      AND d.status = 'COMPLETED'
      AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
    ORDER BY "textScore" DESC
    LIMIT ${(config.topK ?? 5) * 2}
  `;

  // Fuse results using Reciprocal Rank Fusion (RRF)
  const k = 60; // RRF constant
  const scores = new Map<string, { score: number; result: VectorSearchResult }>();

  // Add vector scores
  vectorResults.forEach((result, index) => {
    const rank = index + 1;
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += 1 / (k + rank);
    } else {
      scores.set(result.id, {
        score: 1 / (k + rank),
        result,
      });
    }
  });

  // Add text scores
  textResults.forEach((result, index) => {
    const rank = index + 1;
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += 1 / (k + rank);
    } else {
      scores.set(result.id, {
        score: 1 / (k + rank),
        result: {
          id: result.id,
          documentId: result.documentId,
          content: result.content,
          index: result.index,
          page: result.page,
          section: result.section,
          documentName: result.documentName,
          similarity: result.textScore, // Use text score as fallback
        },
      });
    }
  });

  // Sort by fused score and return top results
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, config.topK ?? 5)
    .map((item) => item.result);
}

export type {
  ImageSearchResult,
  MultiModalSearchOptions,
  MultiModalSearchResult,
} from './multimodal';
// Export multi-modal retrieval functions and types
export {
  getDocumentImages,
  getPageImages,
  searchByImage,
  searchImagesByText,
  searchMultiModal,
} from './multimodal';
