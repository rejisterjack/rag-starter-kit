/**
 * Late chunking strategy
 * Embeds entire document first, then averages token-level embeddings over chunk windows
 * Results in better contextualized embeddings with more accurate context representation
 *
 * Use case: Models with large context windows (OpenAI text-embedding-3 with 8k context)
 * Reference: https://arxiv.org/abs/2409.04701
 */

import { countTokens, estimateTokenCount } from './tokens';
import type { Chunk, Chunker, ChunkingOptions } from './types';
import { ChunkingError } from './types';
import { averageVectors, generateId } from './utils';

/**
 * Function type for getting token-level embeddings
 */
type TokenEmbeddingFunction = (text: string) => Promise<number[][]>;

/**
 * Late chunker implementation
 */
export class LateChunker implements Chunker {
  private tokenEmbeddingFunction?: TokenEmbeddingFunction;

  constructor(options?: {
    tokenEmbeddingFunction?: TokenEmbeddingFunction;
  }) {
    this.tokenEmbeddingFunction = options?.tokenEmbeddingFunction;
  }

  /**
   * Get chunker name
   */
  getName(): string {
    return 'late';
  }

  /**
   * Validate chunking options
   */
  validateOptions(options: ChunkingOptions): boolean {
    if (!options.getTokenEmbeddings && !this.tokenEmbeddingFunction) {
      throw new ChunkingError(
        'getTokenEmbeddings function is required for late chunking',
        'INVALID_OPTIONS'
      );
    }

    const contextWindow = options.chunkSize ?? 8191;
    if (contextWindow < 1000) {
      throw new ChunkingError(
        'chunkSize (context window) should be at least 1000 for late chunking',
        'INVALID_OPTIONS',
        { contextWindow }
      );
    }

    return true;
  }

  /**
   * Chunk the document using late chunking strategy
   */
  async chunk(document: string, options: ChunkingOptions): Promise<Chunk[]> {
    this.validateOptions(options);

    if (!document || document.trim().length === 0) {
      throw new ChunkingError('Document is empty', 'EMPTY_DOCUMENT');
    }

    const embedFn = options.getTokenEmbeddings || this.tokenEmbeddingFunction;
    if (!embedFn) {
      throw new ChunkingError('Token embedding function is required', 'INVALID_OPTIONS');
    }

    const contextWindow = options.chunkSize ?? 8191;
    const targetChunkSize = options.chunkSize ?? 400;
    const stride = options.chunkOverlap ?? 50;

    // Step 1: Check if document fits in context window
    const tokenCount = await countTokens(document);

    if (tokenCount.total > contextWindow) {
      // Document too large, need to pre-split
      return this.handleLargeDocument(
        document,
        embedFn,
        contextWindow,
        targetChunkSize,
        stride,
        options.documentId
      );
    }

    // Step 2: Get token-level embeddings for entire document
    let tokenEmbeddings: number[][];
    try {
      tokenEmbeddings = await embedFn(document);
    } catch (error) {
      throw new ChunkingError('Failed to generate token-level embeddings', 'EMBEDDING_FAILED', {
        error,
      });
    }

    // Step 3: Create chunks with averaged embeddings
    const chunks = this.createChunksFromTokenEmbeddings(
      document,
      tokenEmbeddings,
      targetChunkSize,
      stride,
      0
    );

    return chunks;
  }

  /**
   * Handle documents larger than context window by pre-splitting
   */
  private async handleLargeDocument(
    document: string,
    embedFn: TokenEmbeddingFunction,
    contextWindow: number,
    targetChunkSize: number,
    stride: number,
    _documentId?: string
  ): Promise<Chunk[]> {
    // Pre-split into sections that fit in context window
    const sections = this.preSplitDocument(document, contextWindow);
    const allChunks: Chunk[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      try {
        const tokenEmbeddings = await embedFn(section.content);
        const sectionChunks = this.createChunksFromTokenEmbeddings(
          section.content,
          tokenEmbeddings,
          targetChunkSize,
          stride,
          section.startOffset
        );

        // Adjust indices for section offset
        for (const chunk of sectionChunks) {
          chunk.metadata.start += section.startOffset;
          chunk.metadata.end += section.startOffset;
          chunk.metadata.index += allChunks.length;
        }

        allChunks.push(...sectionChunks);
      } catch (error) {
        console.warn(`Failed to process section ${i}, falling back to fixed chunking:`, error);
        // Fallback: create chunks without embeddings
        const fallbackChunks = this.createFallbackChunks(
          section.content,
          allChunks.length,
          section.startOffset
        );
        allChunks.push(...fallbackChunks);
      }
    }

    return allChunks;
  }

  /**
   * Pre-split document into sections that fit in context window
   */
  private preSplitDocument(
    document: string,
    maxTokens: number
  ): Array<{ content: string; startOffset: number }> {
    const sections: Array<{ content: string; startOffset: number }> = [];
    const paragraphs = document.split(/\n\n+/);

    let currentSection = '';
    let currentSectionStart = 0;
    let currentPosition = 0;

    for (const paragraph of paragraphs) {
      const paragraphWithNewlines = paragraph + '\n\n';
      const estimatedTokens = estimateTokenCount(currentSection + paragraphWithNewlines);

      if (estimatedTokens > maxTokens && currentSection.length > 0) {
        // Save current section
        sections.push({
          content: currentSection.trim(),
          startOffset: currentSectionStart,
        });

        // Start new section with overlap
        const overlapText = this.getOverlapText(currentSection, 200);
        currentSection = overlapText + paragraphWithNewlines;
        currentSectionStart = currentPosition - overlapText.length;
      } else {
        currentSection += paragraphWithNewlines;
      }

      currentPosition += paragraphWithNewlines.length;
    }

    // Don't forget the last section
    if (currentSection.trim()) {
      sections.push({
        content: currentSection.trim(),
        startOffset: currentSectionStart,
      });
    }

    return sections;
  }

  /**
   * Get overlap text from the end of a section
   */
  private getOverlapText(text: string, overlapChars: number): string {
    if (text.length <= overlapChars) {
      return text;
    }

    // Try to find a good break point
    const start = Math.max(0, text.length - overlapChars);
    let overlap = text.slice(start);

    // Try to start at sentence boundary
    const sentenceStart = overlap.search(/[.!?]\s+/);
    if (sentenceStart !== -1 && sentenceStart < overlapChars / 2) {
      overlap = overlap.slice(sentenceStart + 2);
    }

    return overlap;
  }

  /**
   * Create chunks by averaging token embeddings over windows
   */
  private createChunksFromTokenEmbeddings(
    document: string,
    tokenEmbeddings: number[][],
    targetChunkSize: number,
    stride: number,
    startOffset: number = 0
  ): Chunk[] {
    const chunks: Chunk[] = [];

    // Map token positions to character positions (approximate)
    const tokensPerChar = tokenEmbeddings.length / document.length;

    // Calculate window size in tokens
    const windowSizeTokens = Math.max(Math.floor(targetChunkSize * tokensPerChar), 10);
    const strideTokens = Math.max(Math.floor(stride * tokensPerChar), 5);

    let tokenIndex = 0;
    let chunkIndex = 0;

    while (tokenIndex < tokenEmbeddings.length) {
      const windowEnd = Math.min(tokenIndex + windowSizeTokens, tokenEmbeddings.length);

      // Get embeddings for this window
      const windowEmbeddings = tokenEmbeddings.slice(tokenIndex, windowEnd);

      // Average the embeddings
      const averagedEmbedding = averageVectors(windowEmbeddings);

      // Calculate character positions
      const charStart = Math.floor(tokenIndex / tokensPerChar);
      const charEnd = Math.floor(windowEnd / tokensPerChar);

      // Extract text content
      const content = document.slice(charStart, charEnd).trim();

      if (content.length > 0) {
        const chunk: Chunk = {
          id: generateId(),
          content,
          metadata: {
            index: chunkIndex,
            start: startOffset + charStart,
            end: startOffset + charEnd,
            tokenCount: estimateTokenCount(content),
          },
          embedding: averagedEmbedding,
        };
        chunks.push(chunk);
        chunkIndex++;
      }

      tokenIndex += strideTokens;

      // Break if we've reached the end
      if (windowEnd >= tokenEmbeddings.length) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Create fallback chunks without embeddings
   */
  private createFallbackChunks(content: string, startIndex: number, startOffset: number): Chunk[] {
    const chunks: Chunk[] = [];
    const targetSize = 400;
    const overlap = 50;

    let position = 0;
    let index = startIndex;

    while (position < content.length) {
      const end = Math.min(position + targetSize, content.length);
      const chunkContent = content.slice(position, end);

      chunks.push({
        id: generateId(),
        content: chunkContent,
        metadata: {
          index,
          start: startOffset + position,
          end: startOffset + end,
          tokenCount: estimateTokenCount(chunkContent),
        },
      });

      position += targetSize - overlap;
      index++;

      if (end >= content.length) {
        break;
      }
    }

    return chunks;
  }
}

/**
 * Convenience function for late chunking
 */
export async function chunkLate(
  document: string,
  options: Omit<ChunkingOptions, 'strategy'> & {
    getTokenEmbeddings: TokenEmbeddingFunction;
    chunkSize?: number;
    chunkOverlap?: number;
  }
): Promise<Chunk[]> {
  const chunker = new LateChunker({
    tokenEmbeddingFunction: options.getTokenEmbeddings,
  });

  return chunker.chunk(document, {
    ...options,
    strategy: 'late',
  });
}

/**
 * Create a late chunking embedding function from a standard embedding function
 * This simulates token-level embeddings by chunking and embedding separately
 * Note: True late chunking requires model support for token-level embeddings
 */
export function createLateChunkingEmbedder(
  embedFunction: (texts: string[]) => Promise<number[][]>,
  options?: {
    simulateTokens?: number;
  }
): TokenEmbeddingFunction {
  return async (text: string): Promise<number[][]> => {
    // Simulate token-level embeddings by:
    // 1. Splitting into small chunks (simulating tokens)
    // 2. Getting embeddings for each

    const simulateTokenCount = options?.simulateTokens ?? 32;
    const approxCharsPerToken = 4;
    const chunkSize = simulateTokenCount * approxCharsPerToken;

    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    try {
      const embeddings = await embedFunction(chunks);
      return embeddings;
    } catch (error) {
      throw new ChunkingError('Failed to generate simulated token embeddings', 'EMBEDDING_FAILED', {
        error,
      });
    }
  };
}

/**
 * Check if late chunking is suitable for the given document and model
 */
export async function isLateChunkingSuitable(
  document: string,
  modelContextWindow: number = 8191
): Promise<{
  suitable: boolean;
  reason: string;
  tokenCount: number;
}> {
  const tokenCount = await countTokens(document);

  if (tokenCount.total <= modelContextWindow) {
    return {
      suitable: true,
      reason: 'Document fits within model context window',
      tokenCount: tokenCount.total,
    };
  }

  if (tokenCount.total <= modelContextWindow * 2) {
    return {
      suitable: true,
      reason: 'Document slightly exceeds context window but can be handled with pre-splitting',
      tokenCount: tokenCount.total,
    };
  }

  return {
    suitable: false,
    reason: `Document too large (${tokenCount.total} tokens) for late chunking with this model (${modelContextWindow} context)`,
    tokenCount: tokenCount.total,
  };
}
