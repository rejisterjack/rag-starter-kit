/**
 * Fixed-size chunking strategy
 * Classic character/token-based splitting with configurable overlap
 * Based on LangChain's RecursiveCharacterTextSplitter logic
 */

import { countTokensForChunks, estimateTokenCount } from './tokens';
import type { Chunk, Chunker, ChunkingOptions, ChunkStats } from './types';
import { ChunkingError } from './types';
import { generateId } from './utils';

/**
 * Default separators in priority order
 */
const DEFAULT_SEPARATORS = [
  '\n\n', // Paragraph break
  '\n', // Line break
  '. ', // Sentence (period with space)
  '! ', // Exclamation
  '? ', // Question
  '; ', // Semicolon
  ': ', // Colon
  ' ', // Space
  '', // Character (fallback)
];

/**
 * Fixed-size chunker implementation
 */
export class FixedChunker implements Chunker {
  private separators: string[];
  private keepSeparator: 'start' | 'end' | false;

  constructor(options?: {
    separators?: string[];
    keepSeparator?: 'start' | 'end' | false;
  }) {
    this.separators = options?.separators ?? DEFAULT_SEPARATORS;
    this.keepSeparator = options?.keepSeparator ?? 'end';
  }

  /**
   * Get chunker name
   */
  getName(): string {
    return 'fixed';
  }

  /**
   * Validate chunking options
   */
  validateOptions(options: ChunkingOptions): boolean {
    if (options.chunkSize && options.chunkSize < 1) {
      throw new ChunkingError('chunkSize must be at least 1', 'INVALID_OPTIONS', {
        chunkSize: options.chunkSize,
      });
    }

    if (options.chunkOverlap && options.chunkOverlap < 0) {
      throw new ChunkingError('chunkOverlap must be non-negative', 'INVALID_OPTIONS', {
        chunkOverlap: options.chunkOverlap,
      });
    }

    if (options.chunkOverlap && options.chunkSize && options.chunkOverlap >= options.chunkSize) {
      throw new ChunkingError('chunkOverlap must be less than chunkSize', 'INVALID_OPTIONS', {
        chunkOverlap: options.chunkOverlap,
        chunkSize: options.chunkSize,
      });
    }

    return true;
  }

  /**
   * Chunk the document using fixed-size strategy
   */
  async chunk(document: string, options: ChunkingOptions): Promise<Chunk[]> {
    this.validateOptions(options);

    if (!document || document.trim().length === 0) {
      throw new ChunkingError('Document is empty', 'EMPTY_DOCUMENT');
    }

    const chunkSize = options.chunkSize ?? 1000;
    const chunkOverlap = options.chunkOverlap ?? 200;
    const minChunkSize = options.minChunkSize ?? 50;
    const separators = Array.isArray(options.separator)
      ? options.separator
      : options.separator
        ? [options.separator]
        : this.separators;

    // Use recursive splitting
    const chunks = this.splitText(document, chunkSize, chunkOverlap, separators);

    // Filter out chunks that are too small
    const validChunks = chunks.filter((c) => c.length >= minChunkSize);

    // Create Chunk objects with metadata
    return this.createChunks(validChunks, document, options.documentId);
  }

  /**
   * Recursively split text using separators
   */
  private splitText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    separators: string[]
  ): string[] {
    const chunks: string[] = [];
    const separator = this.getAppropriateSeparator(text, separators);

    // Split by the separator
    const splits = separator ? text.split(separator) : text.split('');

    // Process splits into chunks
    let currentChunk = '';

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const separatorSuffix = separator && this.keepSeparator === 'end' ? separator : '';
      const separatorPrefix = separator && this.keepSeparator === 'start' ? separator : '';

      const potentialChunk =
        currentChunk + (currentChunk ? separatorPrefix : '') + split + separatorSuffix;

      if (potentialChunk.length > chunkSize && currentChunk) {
        // Current chunk is full, save it
        chunks.push(currentChunk.trim());

        // Start new chunk with overlap
        if (chunkOverlap > 0) {
          currentChunk =
            this.getOverlapChunk(currentChunk, chunkOverlap) +
            separatorPrefix +
            split +
            separatorSuffix;
        } else {
          currentChunk = split + separatorSuffix;
        }
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Handle chunks that are still too large
    return this.mergeOrSplitChunks(chunks, chunkSize, chunkOverlap, separators);
  }

  /**
   * Get the appropriate separator for the text
   */
  private getAppropriateSeparator(text: string, separators: string[]): string {
    // Find the first separator that exists in the text
    for (const sep of separators) {
      if (sep === '') continue; // Skip empty separator here
      if (text.includes(sep)) {
        return sep;
      }
    }
    // Fall back to character splitting
    return '';
  }

  /**
   * Get the end of a chunk for overlap
   */
  private getOverlapChunk(chunk: string, overlapSize: number): string {
    if (chunk.length <= overlapSize) {
      return chunk;
    }

    // Try to find a good break point
    const start = Math.max(0, chunk.length - overlapSize);
    let overlap = chunk.slice(start);

    // Try to start at a sentence boundary
    const sentenceStart = overlap.search(/[.!?]\s+/);
    if (sentenceStart !== -1 && sentenceStart < overlapSize / 2) {
      overlap = overlap.slice(sentenceStart + 2);
    }

    return overlap;
  }

  /**
   * Merge small chunks or split large ones
   */
  private mergeOrSplitChunks(
    chunks: string[],
    chunkSize: number,
    chunkOverlap: number,
    separators: string[]
  ): string[] {
    const result: string[] = [];

    for (const chunk of chunks) {
      if (chunk.length > chunkSize * 1.5) {
        // Chunk is too large, split it further
        const subSeparator = this.getNextSeparator(separators);
        const subChunks = this.splitText(
          chunk,
          chunkSize,
          chunkOverlap,
          subSeparator ? [subSeparator] : ['']
        );
        result.push(...subChunks);
      } else if (result.length > 0 && result[result.length - 1].length + chunk.length < chunkSize) {
        // Merge with previous chunk if it's small
        result[result.length - 1] += '\n\n' + chunk;
      } else {
        result.push(chunk);
      }
    }

    return result;
  }

  /**
   * Get the next separator in priority
   */
  private getNextSeparator(separators: string[]): string | null {
    const index = separators.indexOf('\n\n');
    if (index !== -1 && index + 1 < separators.length) {
      return separators[index + 1];
    }
    return separators.find((s) => s && s !== '\n\n') || null;
  }

  /**
   * Create Chunk objects with proper metadata
   */
  private createChunks(texts: string[], originalDocument: string, _documentId?: string): Chunk[] {
    let currentPosition = 0;

    return texts.map((content, index) => {
      // Find the position of this chunk in the original document
      const start = originalDocument.indexOf(content, currentPosition);
      const end = start !== -1 ? start + content.length : currentPosition + content.length;

      if (start !== -1) {
        currentPosition = start + 1; // Move past this occurrence
      }

      return {
        id: generateId(),
        content,
        metadata: {
          index,
          start: start !== -1 ? start : 0,
          end,
          tokenCount: estimateTokenCount(content),
        },
      };
    });
  }

  /**
   * Calculate statistics for chunks
   */
  async calculateStats(chunks: Chunk[]): Promise<ChunkStats> {
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

    const tokenCounts = await countTokensForChunks(chunks.map((c) => c.content));

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
}

/**
 * Convenience function for fixed-size chunking
 */
export async function chunkFixed(
  document: string,
  options: Omit<ChunkingOptions, 'strategy'>
): Promise<Chunk[]> {
  const chunker = new FixedChunker();
  return chunker.chunk(document, { ...options, strategy: 'fixed' });
}

/**
 * Split text into chunks with fixed size (simple version)
 */
export async function splitTextFixed(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200,
  separators?: string[]
): Promise<string[]> {
  const chunker = new FixedChunker({ separators });
  // Use a simplified approach for the basic function
  const opts: ChunkingOptions = {
    strategy: 'fixed',
    chunkSize,
    chunkOverlap,
    separator: separators,
  };

  // Return just the text content
  const chunks = await chunker.chunk(text, opts);
  return chunks.map((c) => c.content);
}
