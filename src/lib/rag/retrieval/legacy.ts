/**
 * Legacy exports for backward compatibility
 *
 * These functions are maintained for compatibility with existing code.
 * New code should use the RetrievalEngine class directly.
 */

import { generateEmbedding } from '@/lib/ai';
import { searchSimilar } from '@/lib/vector';
import { buildQdrantFilter } from '@/lib/vector/filters';
import type { RAGConfig, Source } from '@/types';

// Default RAG configuration
const defaultRAGConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: 'auto',
  embeddingModel: 'text-embedding-3-small',
};

/**
 * Generate embedding for a query string
 * @deprecated Use RetrievalEngine instead
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query);
}

/**
 * Search for similar chunks in the vector database
 * @deprecated Use VectorRetriever instead
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  userId: string,
  config: Partial<RAGConfig> = {}
): Promise<
  Array<{
    id: string;
    documentId: string;
    content: string;
    index: number;
    page: number | null;
    section: string | null;
    documentName: string;
    similarity: number;
  }>
> {
  const topK = config.topK ?? defaultRAGConfig.topK;
  const threshold = config.similarityThreshold ?? defaultRAGConfig.similarityThreshold;

  const filter = buildQdrantFilter({ userId });
  const qdrantResults = await searchSimilar(queryEmbedding, { filter, topK, minScore: threshold });

  const results = qdrantResults.map((point) => {
    const p = point.payload as Record<string, unknown>;
    return {
      id: String(point.id),
      documentId: (p?.documentId as string) ?? '',
      content: (p?.content as string) ?? '',
      index: (p?.index as number) ?? 0,
      page: (p?.page as number | null) ?? null,
      section: (p?.section as string | null) ?? null,
      documentName: (p?.documentName as string) ?? '',
      similarity: point.score ?? 0,
    };
  });

  return results;
}

/**
 * Retrieve relevant sources for a query
 * @deprecated Use RetrievalEngine.retrieve() instead
 */
export async function retrieveSources(
  query: string,
  userId: string,
  config: Partial<RAGConfig> = {}
): Promise<Source[]> {
  const queryEmbedding = await generateEmbedding(query);
  const results = await searchSimilarChunks(queryEmbedding, userId, config);

  return results.map((result) => ({
    id: result.id,
    content: result.content,
    similarity: result.similarity,
    metadata: {
      documentId: result.documentId,
      documentName: result.documentName,
      page: result.page ?? undefined,
      chunkIndex: result.index,
      totalChunks: 0,
    },
  }));
}

/**
 * Build a context string from retrieved sources
 * @deprecated Use RetrievalEngine instead
 */
export function buildContext(sources: Source[], maxLength = 4000): string {
  if (sources.length === 0) {
    return '';
  }

  let context = '';
  let currentLength = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const sourceText = `[${i + 1}] Source: ${source.metadata.documentName}${source.metadata.page ? `, Page ${source.metadata.page}` : ''}\n${source.content}\n\n`;

    if (currentLength + sourceText.length > maxLength) {
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
 * @deprecated Use RetrievalEngine instead
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
 * @deprecated Use reranking module instead
 */
export function rerankSources(sources: Source[], query: string): Source[] {
  const queryTerms = query.toLowerCase().split(/\s+/);

  return sources
    .map((source) => {
      const contentTerms = source.content.toLowerCase().split(/\s+/);
      const overlap = queryTerms.filter((term) => contentTerms.includes(term)).length;
      const keywordScore = overlap / queryTerms.length;

      const score = (source.similarity ?? 0) * 0.4 + keywordScore * 0.3 + 0.3;

      return { ...source, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Deduplicate sources from the same document section
 * @deprecated Use hybrid module instead
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
