/**
 * Semantic chunking strategy
 * Uses embeddings to detect natural boundaries between semantically different content
 */

import { generateId, cosineSimilarity } from './utils';
import type { Chunk, ChunkingOptions, Chunker } from './types';
import { ChunkingError } from './types';
import { estimateTokenCount } from './tokens';



/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations to avoid false splits
  const protectedText = text
    .replace(/(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|Vol|vol|pp|et al|i\.e|e\.g)\.\s/g, '$1<DOT> ')
    .replace(/(\.\d+)\./g, '$1<DOT>');

  // Split on sentence terminators
  const sentences = protectedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Semantic chunker implementation
 */
export class SemanticChunker implements Chunker {
  private embeddingFunction?: (text: string) => Promise<number[]> | number[];

  constructor(options?: {
    embeddingFunction?: (text: string) => Promise<number[]> | number[];
  }) {
    this.embeddingFunction = options?.embeddingFunction;
  }

  /**
   * Get chunker name
   */
  getName(): string {
    return 'semantic';
  }

  /**
   * Validate chunking options
   */
  validateOptions(options: ChunkingOptions): boolean {
    if (options.similarityThreshold !== undefined) {
      if (options.similarityThreshold < 0 || options.similarityThreshold > 1) {
        throw new ChunkingError(
          'similarityThreshold must be between 0 and 1',
          'INVALID_OPTIONS',
          { similarityThreshold: options.similarityThreshold }
        );
      }
    }

    if (options.chunkSize && options.chunkSize < 100) {
      throw new ChunkingError(
        'chunkSize should be at least 100 for semantic chunking',
        'INVALID_OPTIONS',
        { chunkSize: options.chunkSize }
      );
    }

    return true;
  }

  /**
   * Chunk the document using semantic boundaries
   */
  async chunk(document: string, options: ChunkingOptions): Promise<Chunk[]> {
    this.validateOptions(options);

    if (!document || document.trim().length === 0) {
      throw new ChunkingError(
        'Document is empty',
        'EMPTY_DOCUMENT'
      );
    }

    // Get embedding function
    const embedFn = options.embeddingFunction || this.embeddingFunction;
    if (!embedFn) {
      throw new ChunkingError(
        'Embedding function is required for semantic chunking',
        'INVALID_OPTIONS'
      );
    }

    const similarityThreshold = options.similarityThreshold ?? 0.7;
    const minChunkSize = options.minChunkSize ?? 200;
    const maxChunkSize = options.maxChunkSize ?? 1500;
    const windowSize = 3; // Number of sentences to compare

    // Step 1: Split into sentences
    const sentences = splitIntoSentences(document);
    if (sentences.length === 0) {
      return [];
    }

    // Step 2: Generate embeddings for sentences (with batching)
    const embeddings = await this.generateEmbeddings(sentences, embedFn);

    // Step 3: Calculate similarities between consecutive sentences
    const similarities = this.calculateSimilarities(embeddings, windowSize);

    // Step 4: Find semantic boundaries
    const boundaries = this.findBoundaries(
      sentences,
      similarities,
      similarityThreshold,
      minChunkSize,
      maxChunkSize
    );

    // Step 5: Group sentences into chunks
    const chunks = this.groupSentencesIntoChunks(
      sentences,
      boundaries,
      document,
      options.documentId
    );

    // Step 6: Merge small chunks if possible
    return this.mergeSmallChunks(chunks, minChunkSize, maxChunkSize);
  }

  /**
   * Generate embeddings for sentences
   */
  private async generateEmbeddings(
    sentences: string[],
    embedFn: (text: string) => Promise<number[]> | number[]
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches to avoid overwhelming the embedding API
    const batchSize = 20;

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);

      try {
        const batchEmbeddings = await Promise.all(
          batch.map((sentence) => Promise.resolve(embedFn(sentence)))
        );
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        throw new ChunkingError(
          'Failed to generate embeddings',
          'EMBEDDING_FAILED',
          { error, batchIndex: i }
        );
      }
    }

    return embeddings;
  }

  /**
   * Calculate similarities between consecutive sentences using sliding window
   */
  private calculateSimilarities(
    embeddings: number[][],
    windowSize: number
  ): number[] {
    const similarities: number[] = [];

    for (let i = 0; i < embeddings.length - 1; i++) {
      // Calculate similarity between current sentence and next
      // Using windowed average for smoother transitions
      const currentWindow = embeddings.slice(
        Math.max(0, i - windowSize + 1),
        i + 1
      );
      const nextWindow = embeddings.slice(
        i + 1,
        Math.min(embeddings.length, i + 1 + windowSize)
      );

      const currentAvg = this.averageVectors(currentWindow);
      const nextAvg = this.averageVectors(nextWindow);

      const similarity = cosineSimilarity(currentAvg, nextAvg);
      similarities.push(similarity);
    }

    return similarities;
  }

  /**
   * Average multiple vectors
   */
  private averageVectors(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    if (vectors.length === 1) return vectors[0];

    const dimensions = vectors[0].length;
    const result = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        result[i] += vector[i];
      }
    }

    return result.map((sum) => sum / vectors.length);
  }

  /**
   * Find semantic boundaries based on similarity drops
   */
  private findBoundaries(
    sentences: string[],
    similarities: number[],
    threshold: number,
    minChunkSize: number,
    maxChunkSize: number
  ): number[] {
    const boundaries: number[] = [0]; // First boundary is always at start

    let currentChunkLength = sentences[0].length;

    for (let i = 0; i < similarities.length; i++) {
      const similarity = similarities[i];
      const sentenceLength = sentences[i + 1]?.length || 0;

      // Check if we should create a boundary
      const isSimilarityDrop = similarity < threshold;
      const exceedsMaxSize = currentChunkLength + sentenceLength > maxChunkSize;
      const exceedsMinSize = currentChunkLength >= minChunkSize;

      if ((isSimilarityDrop && exceedsMinSize) || exceedsMaxSize) {
        boundaries.push(i + 1);
        currentChunkLength = sentenceLength;
      } else {
        currentChunkLength += sentenceLength;
      }
    }

    // Always add the end as a boundary
    if (boundaries[boundaries.length - 1] !== sentences.length) {
      boundaries.push(sentences.length);
    }

    return boundaries;
  }

  /**
   * Group sentences into chunks based on boundaries
   */
  private groupSentencesIntoChunks(
    sentences: string[],
    boundaries: number[],
    originalDocument: string,
    _documentId?: string
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const startIdx = boundaries[i];
      const endIdx = boundaries[i + 1];

      const chunkSentences = sentences.slice(startIdx, endIdx);
      const content = chunkSentences.join(' ');

      // Find position in original document
      const start = originalDocument.indexOf(chunkSentences[0]);
      const end = start !== -1 ? start + content.length : 0;

      chunks.push({
        id: generateId(),
        content,
        metadata: {
          index: i,
          start,
          end,
          tokenCount: estimateTokenCount(content),
        },
      });
    }

    return chunks;
  }

  /**
   * Merge small chunks with neighbors when possible
   */
  private async mergeSmallChunks(
    chunks: Chunk[],
    minChunkSize: number,
    maxChunkSize: number
  ): Promise<Chunk[]> {
    if (chunks.length <= 1) return chunks;

    const result: Chunk[] = [];
    let currentChunk = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
      const nextChunk = chunks[i];
      const combinedLength = currentChunk.content.length + nextChunk.content.length;

      // Merge if current chunk is too small and combined doesn't exceed max
      if (currentChunk.content.length < minChunkSize && combinedLength <= maxChunkSize) {
        currentChunk = {
          ...currentChunk,
          id: generateId(),
          content: currentChunk.content + ' ' + nextChunk.content,
          metadata: {
            ...currentChunk.metadata,
            end: nextChunk.metadata.end,
            tokenCount: estimateTokenCount(currentChunk.content + ' ' + nextChunk.content),
          },
        };
      } else {
        result.push(currentChunk);
        currentChunk = nextChunk;
      }
    }

    // Don't forget the last chunk
    result.push(currentChunk);

    // Handle case where last chunk is too small
    const lastChunk = result[result.length - 1];
    if (lastChunk.content.length < minChunkSize && result.length > 1) {
      // Merge with previous if possible
      const prevChunk = result[result.length - 2];
      const combinedLength = prevChunk.content.length + lastChunk.content.length;

      if (combinedLength <= maxChunkSize) {
        result[result.length - 2] = {
          ...prevChunk,
          content: prevChunk.content + ' ' + lastChunk.content,
          metadata: {
            ...prevChunk.metadata,
            end: lastChunk.metadata.end,
            tokenCount: estimateTokenCount(prevChunk.content + ' ' + lastChunk.content),
          },
        };
        result.pop();
      }
    }

    return result;
  }
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
  const chunker = new SemanticChunker({
    embeddingFunction: options.embeddingFunction,
  });

  return chunker.chunk(document, {
    ...options,
    strategy: 'semantic',
    similarityThreshold: options.similarityThreshold ?? 0.7,
  });
}

/**
 * Analyze semantic structure of text without full chunking
 * Returns similarity scores between sentences
 */
export async function analyzeSemanticStructure(
  document: string,
  embeddingFunction: (text: string) => Promise<number[]> | number[]
): Promise<{
  sentences: string[];
  similarities: number[];
  avgSimilarity: number;
}> {
  const sentences = splitIntoSentences(document);

  if (sentences.length < 2) {
    return { sentences, similarities: [], avgSimilarity: 1 };
  }

  const chunker = new SemanticChunker({ embeddingFunction });
  const embeddings = await (chunker as unknown as {
    generateEmbeddings: (s: string[], fn: typeof embeddingFunction) => Promise<number[][]>;
  }).generateEmbeddings(sentences, embeddingFunction);

  const similarities: number[] = [];
  for (let i = 0; i < embeddings.length - 1; i++) {
    const sim = cosineSimilarity(embeddings[i], embeddings[i + 1]);
    similarities.push(sim);
  }

  const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

  return { sentences, similarities, avgSimilarity };
}
