/**
 * Advanced Chunking Strategies for RAG
 *
 * This module provides multiple chunking strategies for different document types:
 * - Fixed: Classic character/token-based splitting
 * - Semantic: Embedding-based boundary detection
 * - Hierarchical: Parent-child chunk relationships
 * - Late: Context-aware embeddings via token-level processing
 *
 * @example
 * ```typescript
 * import { ChunkingEngine, ChunkingStrategy } from '@/lib/rag/chunking';
 *
 * const chunks = await ChunkingEngine.chunk(document, {
 *   strategy: 'semantic',
 *   chunkSize: 1000,
 *   embeddingFunction: async (text) => {
 *     // Your embedding logic
 *     return embedding;
 *   }
 * });
 * ```
 */

import { DocumentAnalyzer } from './analyzer';
import { FixedChunker } from './fixed';
import { HierarchicalChunker } from './hierarchical';
import { LateChunker } from './late';
import { SemanticChunker } from './semantic';
import type {
  Chunk,
  Chunker,
  ChunkingOptions,
  ChunkingStrategy,
  ChunkStats,
  DocumentProfile,
} from './types';

// Re-export analyzer
export { analyzeDocuments, createDocumentAnalyzer, DocumentAnalyzer } from './analyzer';
// Re-export chunking implementations
export { FixedChunker } from './fixed';
// Re-export hierarchical utilities
export {
  buildEnrichedContext,
  getChildChunks,
  getChunkContextPath,
  getParentChunk,
  HierarchicalChunker,
} from './hierarchical';
// Re-export late chunking utilities
export {
  createLateChunkingEmbedder,
  isLateChunkingSuitable,
  LateChunker,
} from './late';
export { SemanticChunker } from './semantic';

// Re-export token utilities
export {
  calculateOptimalChunkSize as calculateTokenBasedChunkSize,
  countTokens,
  countTokensForChunks,
  estimateTokenCount,
  estimateTokensForChunks,
  fitsInTokenBudget,
  getModelTokenLimit,
  MODEL_TOKEN_LIMITS,
  TokenBudgetManager,
  truncateToTokenLimit,
} from './tokens';
// Re-export all types
export type {
  Chunk,
  Chunker,
  ChunkingErrorCode,
  ChunkingOptions,
  ChunkingStrategy,
  ChunkMetadata,
  ChunkStats,
  DocumentProfile,
  DocumentStructure,
  FixedChunkingOptions,
  HierarchicalChunkingOptions,
  LateChunkingOptions,
  SemanticChunkingOptions,
  SizeDistribution,
  TokenCount,
} from './types';
export { ChunkingError } from './types';

/**
 * Chunking Engine - Factory for creating and using chunkers
 */
const chunkerCache: Map<ChunkingStrategy, Chunker> = new Map();

/**
 * Create a chunker instance for the given strategy
 */
function createChunker(strategy: ChunkingStrategy): Chunker {
  // Check cache first
  const cached = chunkerCache.get(strategy);
  if (cached) {
    return cached;
  }

  let chunker: Chunker;

  switch (strategy) {
    case 'semantic':
      chunker = new SemanticChunker();
      break;

    case 'hierarchical':
      chunker = new HierarchicalChunker();
      break;

    case 'late':
      chunker = new LateChunker();
      break;
    default:
      chunker = new FixedChunker();
      break;
  }

  // Cache the chunker
  chunkerCache.set(strategy, chunker);

  return chunker;
}

/**
 * Chunk a document using the specified strategy
 */
async function chunkDocument(document: string, options: ChunkingOptions): Promise<Chunk[]> {
  const chunker = createChunker(options.strategy);
  return chunker.chunk(document, options);
}

/**
 * Chunk multiple documents
 */
async function chunkBatch(
  documents: Array<{ id: string; content: string }>,
  options: ChunkingOptions
): Promise<Array<{ documentId: string; chunks: Chunk[] }>> {
  const chunker = createChunker(options.strategy);

  const results = await Promise.all(
    documents.map(async (doc) => {
      const chunks = await chunker.chunk(doc.content, {
        ...options,
        documentId: doc.id,
      });
      return { documentId: doc.id, chunks };
    })
  );

  return results;
}

/**
 * Analyze document and recommend best strategy
 */
function analyzeDocument(document: string): DocumentProfile {
  const analyzer = new DocumentAnalyzer();
  return analyzer.analyze(document);
}

/**
 * Smart chunk - analyzes document and uses recommended strategy
 */
async function smartChunkDocument(
  document: string,
  overrides?: Partial<ChunkingOptions>
): Promise<{ chunks: Chunk[]; profile: DocumentProfile }> {
  const profile = analyzeDocument(document);
  const strategy = overrides?.strategy ?? profile.recommendedStrategy;

  const options: ChunkingOptions = {
    strategy,
    chunkSize: overrides?.chunkSize,
    chunkOverlap: overrides?.chunkOverlap,
    ...overrides,
  };

  const chunks = await chunkDocument(document, options);

  return { chunks, profile };
}

/**
 * Get statistics for chunks
 */
async function getChunkStats(chunks: Chunk[]): Promise<ChunkStats> {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
      estimatedTokens: 0,
      avgTokensPerChunk: 0,
      sizeDistribution: { small: 0, medium: 0, large: 0, extraLarge: 0 },
    };
  }

  const sizes = chunks.map((c) => c.content.length);
  const totalSize = sizes.reduce((a, b) => a + b, 0);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  const avgSize = Math.round(totalSize / chunks.length);

  // Import token utilities
  const { estimateTokensForChunks } = await import('./tokens');
  const tokenCounts = estimateTokensForChunks(chunks.map((c) => c.content));

  // Calculate size distribution
  const distribution = {
    small: sizes.filter((s) => s < 100).length,
    medium: sizes.filter((s) => s >= 100 && s < 500).length,
    large: sizes.filter((s) => s >= 500 && s < 1000).length,
    extraLarge: sizes.filter((s) => s >= 1000).length,
  };

  return {
    totalChunks: chunks.length,
    avgChunkSize: avgSize,
    minChunkSize: minSize,
    maxChunkSize: maxSize,
    estimatedTokens: tokenCounts.total,
    avgTokensPerChunk: Math.round(tokenCounts.total / chunks.length),
    sizeDistribution: distribution,
  };
}

/**
 * Clear chunker cache
 */
function clearChunkerCache(): void {
  chunkerCache.clear();
}

/**
 * Chunking Engine - Namespace exposing all chunking operations
 * @deprecated Use individual functions directly instead
 */
export const ChunkingEngine = {
  create: createChunker,
  chunk: chunkDocument,
  chunkBatch,
  analyze: analyzeDocument,
  smartChunk: smartChunkDocument,
  getStats: getChunkStats,
  clearCache: clearChunkerCache,
};

/**
 * Convenience function for fixed-size chunking
 */
export async function chunkFixed(
  document: string,
  options?: Omit<ChunkingOptions, 'strategy'>
): Promise<Chunk[]> {
  return chunkDocument(document, {
    ...options,
    strategy: 'fixed',
  });
}

/**
 * Convenience function for semantic chunking
 */
export async function chunkSemantic(
  document: string,
  options: Omit<ChunkingOptions, 'strategy'> & {
    embeddingFunction: (text: string) => Promise<number[]> | number[];
    similarityThreshold?: number;
  }
): Promise<Chunk[]> {
  return chunkDocument(document, {
    ...options,
    strategy: 'semantic',
  });
}

/**
 * Convenience function for hierarchical chunking
 */
export async function chunkHierarchical(
  document: string,
  options?: Omit<ChunkingOptions, 'strategy'> & {
    hierarchicalLevels?: number;
  }
): Promise<Chunk[]> {
  return chunkDocument(document, {
    ...options,
    strategy: 'hierarchical',
  });
}

/**
 * Utility functions
 */
export { cosineSimilarity, generateId, splitIntoSentences } from './utils';

/**
 * Backward compatibility: Create document chunks with metadata
 * This function provides compatibility with the old chunking API
 */
export async function createChunks(
  documentId: string,
  content: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
  }
): Promise<
  Array<{
    documentId: string;
    content: string;
    index: number;
    metadata: {
      start: number;
      end: number;
      chunkIndex: number;
      totalChunks: number;
    };
  }>
> {
  const chunks = await chunkFixed(content, {
    chunkSize: options?.chunkSize ?? 1000,
    chunkOverlap: options?.chunkOverlap ?? 200,
  });

  return chunks.map((chunk) => ({
    documentId,
    content: chunk.content,
    index: chunk.metadata.index,
    metadata: {
      start: chunk.metadata.start,
      end: chunk.metadata.end,
      chunkIndex: chunk.metadata.index,
      totalChunks: chunks.length,
    },
  }));
}

/**
 * Split text into chunks
 * Backward compatibility function
 */
export async function splitText(
  text: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
  }
): Promise<string[]> {
  const chunks = await chunkFixed(text, options);
  return chunks.map((c) => c.content);
}

/**
 * Calculate optimal chunk size based on document type
 * Backward compatibility function
 */
export function calculateOptimalChunkSize(
  content: string,
  _documentType: string
): { chunkSize: number; chunkOverlap: number } {
  const contentLength = content.length;

  let chunkSize = 1000;
  let chunkOverlap = 200;

  // Adjust for very small documents
  if (contentLength < chunkSize * 2) {
    chunkSize = Math.floor(contentLength / 2);
    chunkOverlap = Math.floor(chunkSize * 0.1);
  }

  return { chunkSize, chunkOverlap };
}

/**
 * Convenience function for late chunking
 */
export async function chunkLate(
  document: string,
  options: Omit<ChunkingOptions, 'strategy'> & {
    getTokenEmbeddings: (text: string) => Promise<number[][]>;
  }
): Promise<Chunk[]> {
  return chunkDocument(document, {
    ...options,
    strategy: 'late',
  });
}

/**
 * Smart chunk with automatic strategy selection
 */
export async function smartChunk(
  document: string,
  overrides?: Partial<ChunkingOptions>
): Promise<{ chunks: Chunk[]; profile: DocumentProfile }> {
  return smartChunkDocument(document, overrides);
}

// Default export
export default ChunkingEngine;
