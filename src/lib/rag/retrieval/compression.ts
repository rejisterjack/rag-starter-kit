/**
 * Contextual Compression Module
 *
 * Compresses retrieved chunks to fit more relevant context into limited window.
 * Uses LLM to extract the most relevant sentences from each chunk.
 */

import { estimateTokens, generateChatCompletion } from '@/lib/ai';
import type { CompressionConfig, RetrievedChunk } from './types';

// Message type for AI completions
interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * Default configuration for contextual compression
 */
export const defaultCompressionConfig: CompressionConfig = {
  maxTokensPerChunk: 200,
  preserveSentences: true,
  targetRatio: 0.5,
};

/**
 * Compression result for a single chunk
 */
interface CompressionResult {
  compressedContent: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  relevantSentences: string[];
}

/**
 * Prompt template for LLM-based compression
 */
const COMPRESSION_PROMPT = `Given the following user query and document chunk, extract the most relevant sentences that help answer the query.

User Query: {query}

Document Chunk:
{chunk}

Instructions:
1. Extract 1-5 most relevant sentences that directly address the query
2. Preserve the original wording and context
3. If the entire chunk is relevant, return it as-is
4. If nothing is relevant, return "[NOT RELEVANT]"
5. Return only the extracted sentences, one per line

Relevant Sentences:`;

/**
 * Prompt template for map-reduce style compression
 */
const MAP_REDUCE_PROMPT = `Summarize the following document chunk focusing only on information relevant to the query.
Keep the summary concise but informative.

User Query: {query}

Document Chunk:
{chunk}

Concise Summary (1-2 sentences):`;

/**
 * Contextual Compressor class
 */
export class ContextualCompressor {
  private config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = { ...defaultCompressionConfig, ...config };
  }

  /**
   * Compress chunks based on relevance to query
   *
   * @param query - User query
   * @param chunks - Retrieved chunks to compress
   * @returns Compressed chunks
   */
  async compress(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    const _startTime = Date.now();
    const compressedChunks: RetrievedChunk[] = [];

    // Process chunks in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const compressedBatch = await Promise.all(
        batch.map((chunk) => this.compressChunk(query, chunk))
      );
      compressedChunks.push(...compressedBatch);
    }

    return compressedChunks;
  }

  /**
   * Compress a single chunk
   */
  private async compressChunk(query: string, chunk: RetrievedChunk): Promise<RetrievedChunk> {
    // Skip short chunks that don't need compression
    const originalTokens = estimateTokens(chunk.content);
    if (originalTokens <= this.config.maxTokensPerChunk) {
      return {
        ...chunk,
        retrievalMethod: `${chunk.retrievalMethod}-no-compression`,
      };
    }

    try {
      // Try LLM-based compression first
      const result = await this.llmBasedCompression(query, chunk.content);

      if (result.compressionRatio > 0.1) {
        return {
          ...chunk,
          content: result.compressedContent,
          score: chunk.score * (1 + result.compressionRatio * 0.2), // Boost score for good compression
          retrievalMethod: `${chunk.retrievalMethod}-llm-compressed`,
        };
      }
    } catch (_error) {}

    // Fallback to heuristic compression
    const heuristicResult = this.heuristicCompression(query, chunk.content);

    return {
      ...chunk,
      content: heuristicResult.compressedContent,
      retrievalMethod: `${chunk.retrievalMethod}-heuristic-compressed`,
    };
  }

  /**
   * LLM-based compression using relevant sentence extraction
   */
  private async llmBasedCompression(query: string, content: string): Promise<CompressionResult> {
    const prompt = COMPRESSION_PROMPT.replace('{query}', query).replace('{chunk}', content);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a precise document compressor. Extract only relevant sentences.',
      },
      { role: 'user', content: prompt },
    ];

    const { text } = await generateChatCompletion(
      messages as unknown as Parameters<typeof generateChatCompletion>[0],
      { temperature: 0.3, maxTokens: this.config.maxTokensPerChunk * 2 }
    );

    const relevantSentences = text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== '[NOT RELEVANT]');

    const compressedContent = this.config.preserveSentences
      ? relevantSentences.join('. ')
      : relevantSentences.join(' ');

    const originalLength = content.length;
    const compressedLength = compressedContent.length;
    const compressionRatio = 1 - compressedLength / originalLength;

    return {
      compressedContent: compressedContent || content,
      originalLength,
      compressedLength,
      compressionRatio,
      relevantSentences,
    };
  }

  /**
   * Map-reduce style compression (for very long chunks)
   */
  async mapReduceCompress(query: string, content: string): Promise<string> {
    const prompt = MAP_REDUCE_PROMPT.replace('{query}', query).replace('{chunk}', content);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a concise summarizer. Focus on query-relevant information.',
      },
      { role: 'user', content: prompt },
    ];

    const { text } = await generateChatCompletion(
      messages as unknown as Parameters<typeof generateChatCompletion>[0],
      { temperature: 0.3, maxTokens: this.config.maxTokensPerChunk }
    );

    return text.trim();
  }

  /**
   * Heuristic-based compression (fallback)
   * Uses keyword matching and sentence scoring
   */
  private heuristicCompression(query: string, content: string): CompressionResult {
    const sentences = this.splitIntoSentences(content);
    const queryTerms = new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 3)
    );

    // Score each sentence
    const scoredSentences = sentences.map((sentence) => ({
      sentence,
      score: this.scoreSentence(sentence, queryTerms),
    }));

    // Sort by score and select top sentences
    scoredSentences.sort((a, b) => b.score - a.score);

    // Select sentences until we reach target token count
    const targetTokens = this.config.maxTokensPerChunk;
    const selectedSentences: string[] = [];
    let currentTokens = 0;

    for (const { sentence, score } of scoredSentences) {
      if (score === 0) continue;

      const sentenceTokens = estimateTokens(sentence);
      if (currentTokens + sentenceTokens > targetTokens && selectedSentences.length > 0) {
        break;
      }

      selectedSentences.push(sentence);
      currentTokens += sentenceTokens;
    }

    // Sort back to original order
    const sentenceOrder = new Map(sentences.map((s, i) => [s, i]));
    selectedSentences.sort((a, b) => (sentenceOrder.get(a) ?? 0) - (sentenceOrder.get(b) ?? 0));

    const compressedContent = selectedSentences.join('. ');
    const originalLength = content.length;
    const compressedLength = compressedContent.length;

    return {
      compressedContent: compressedContent || content,
      originalLength,
      compressedLength,
      compressionRatio: 1 - compressedLength / originalLength,
      relevantSentences: selectedSentences,
    };
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be improved with NLP libraries)
    return text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  /**
   * Score a sentence based on keyword overlap and other heuristics
   */
  private scoreSentence(sentence: string, queryTerms: Set<string>): number {
    const sentenceLower = sentence.toLowerCase();
    const sentenceTerms = new Set(sentenceLower.split(/\s+/).filter((t) => t.length > 3));

    // Keyword overlap score
    let score = 0;
    for (const term of queryTerms) {
      if (sentenceLower.includes(term)) {
        score += 1;
        // Bonus for exact word match
        if (sentenceTerms.has(term)) {
          score += 0.5;
        }
      }
    }

    // Normalize by query term count
    score /= Math.max(queryTerms.size, 1);

    // Bonus for sentences with numbers (often contain facts)
    if (/\d/.test(sentence)) {
      score += 0.1;
    }

    // Penalty for very short sentences
    if (sentence.length < 30) {
      score *= 0.8;
    }

    return score;
  }

  /**
   * Compress context to fit within token limit
   * Removes least relevant chunks if necessary
   */
  compressToFit(
    chunks: RetrievedChunk[],
    maxTokens: number,
    reserveTokens = 500
  ): RetrievedChunk[] {
    const availableTokens = maxTokens - reserveTokens;
    const targetTokens = Math.floor(availableTokens / Math.max(chunks.length, 1));

    // Compress each chunk to target size
    const compressed = chunks.map((chunk) => {
      const tokens = estimateTokens(chunk.content);
      if (tokens <= targetTokens) {
        return chunk;
      }

      // Truncate to target tokens (approximately)
      const targetChars = targetTokens * 4; // Rough estimate
      const truncated = chunk.content.slice(0, targetChars);

      // Try to end at sentence boundary
      const lastSentence = truncated.lastIndexOf('.');
      const finalContent = lastSentence > 0 ? truncated.slice(0, lastSentence + 1) : truncated;

      return {
        ...chunk,
        content: `${finalContent}...`,
        retrievalMethod: `${chunk.retrievalMethod}-truncated`,
      };
    });

    // If still too long, remove lowest scoring chunks
    let totalTokens = compressed.reduce((sum, c) => sum + estimateTokens(c.content), 0);
    const result = [...compressed];

    while (totalTokens > availableTokens && result.length > 1) {
      // Remove lowest scoring chunk
      result.sort((a, b) => a.score - b.score);
      const removed = result.shift()!;
      totalTokens -= estimateTokens(removed.content);
    }

    // Sort back by original score
    result.sort((a, b) => b.score - a.score);

    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Convenience function for contextual compression
 */
export async function compressChunks(
  query: string,
  chunks: RetrievedChunk[],
  config?: Partial<CompressionConfig>
): Promise<RetrievedChunk[]> {
  const compressor = new ContextualCompressor(config);
  return compressor.compress(query, chunks);
}

/**
 * Convenience function for map-reduce compression
 */
export async function mapReduceCompress(
  query: string,
  content: string,
  config?: Partial<CompressionConfig>
): Promise<string> {
  const compressor = new ContextualCompressor(config);
  return compressor.mapReduceCompress(query, content);
}

/**
 * Simple truncation-based compression (fastest, no LLM)
 */
export function truncateChunks(
  chunks: RetrievedChunk[],
  maxTokensPerChunk: number
): RetrievedChunk[] {
  return chunks.map((chunk) => {
    const tokens = estimateTokens(chunk.content);
    if (tokens <= maxTokensPerChunk) {
      return chunk;
    }

    const targetChars = maxTokensPerChunk * 4;
    const truncated = chunk.content.slice(0, targetChars);
    const lastPeriod = truncated.lastIndexOf('.');

    return {
      ...chunk,
      content: lastPeriod > 0 ? `${truncated.slice(0, lastPeriod + 1)}...` : `${truncated}...`,
      retrievalMethod: `${chunk.retrievalMethod}-truncated`,
    };
  });
}
