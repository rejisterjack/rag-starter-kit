/**
 * Token counting utilities for chunking
 * Uses tiktoken for accurate OpenAI token counting with fallback estimation
 */

import type { TokenCount } from './types';

// Tiktoken encoding (loaded dynamically)
let encoding: { encode: (text: string) => number[]; decode: (tokens: number[]) => string } | null =
  null;

/**
 * Initialize tiktoken encoding
 * This is done lazily to avoid loading overhead until needed
 */
async function getEncoding(): Promise<{
  encode: (text: string) => number[];
  decode: (tokens: number[]) => string;
} | null> {
  if (encoding) return encoding;

  try {
    // Dynamic import to avoid issues if js-tiktoken is not installed
    const tiktoken = (await import('js-tiktoken')) as {
      get_encoding: (name: string) => {
        encode: (text: string) => number[];
        decode: (tokens: number[]) => string;
      };
    };
    // Use cl100k_base encoding (used by GPT-4, GPT-3.5-turbo, text-embedding-3)
    encoding = tiktoken.get_encoding('cl100k_base');
    return encoding;
  } catch {
    return null;
  }
}

/**
 * Count tokens accurately using tiktoken
 * Falls back to estimation if tiktoken is not available
 */
export async function countTokens(text: string): Promise<TokenCount> {
  if (!text || text.trim().length === 0) {
    return { total: 0, isEstimated: false };
  }

  const enc = await getEncoding();

  if (enc) {
    try {
      const tokens = enc.encode(text);
      return {
        total: tokens.length,
        isEstimated: false,
      };
    } catch (_error) {}
  }

  // Fallback estimation
  return {
    total: estimateTokenCount(text),
    isEstimated: true,
  };
}

/**
 * Count tokens for multiple chunks
 */
export async function countTokensForChunks(chunks: string[]): Promise<TokenCount> {
  if (chunks.length === 0) {
    return { total: 0, perChunk: [], isEstimated: false };
  }

  const enc = await getEncoding();
  const perChunk: number[] = [];

  if (enc) {
    try {
      for (const chunk of chunks) {
        const tokens = enc.encode(chunk);
        perChunk.push(tokens.length);
      }
      return {
        total: perChunk.reduce((a, b) => a + b, 0),
        perChunk,
        isEstimated: false,
      };
    } catch (_error) {}
  }

  // Fallback estimation
  for (const chunk of chunks) {
    perChunk.push(estimateTokenCount(chunk));
  }

  return {
    total: perChunk.reduce((a, b) => a + b, 0),
    perChunk,
    isEstimated: true,
  };
}

/**
 * Estimate token count without tiktoken
 * Based on OpenAI's approximation: ~0.75 tokens per word, ~4 characters per token
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Method 1: Character-based estimation (4 chars ≈ 1 token)
  const charEstimate = Math.ceil(text.length / 4);

  // Method 2: Word-based estimation (0.75 tokens per word)
  const wordCount = text.trim().split(/\s+/).length;
  const wordEstimate = Math.ceil(wordCount / 0.75);

  // Average both methods for better accuracy
  return Math.round((charEstimate + wordEstimate) / 2);
}

/**
 * Estimate tokens for multiple chunks
 */
export function estimateTokensForChunks(chunks: string[]): TokenCount {
  const perChunk = chunks.map((chunk) => estimateTokenCount(chunk));
  return {
    total: perChunk.reduce((a, b) => a + b, 0),
    perChunk,
    isEstimated: true,
  };
}

/**
 * Check if text fits within token budget
 */
export async function fitsInTokenBudget(text: string, maxTokens: number): Promise<boolean> {
  const count = await countTokens(text);
  return count.total <= maxTokens;
}

/**
 * Truncate text to fit within token budget
 */
export async function truncateToTokenLimit(text: string, maxTokens: number): Promise<string> {
  const enc = await getEncoding();

  if (!enc) {
    // Fallback: approximate with character count
    const estimatedChars = maxTokens * 4;
    return text.slice(0, estimatedChars);
  }

  try {
    const tokens = enc.encode(text);
    if (tokens.length <= maxTokens) {
      return text;
    }
    const truncated = tokens.slice(0, maxTokens);
    return enc.decode(truncated);
  } catch (_error) {
    // Fallback
    return text.slice(0, maxTokens * 4);
  }
}

/**
 * Token budget manager for managing multiple chunks
 */
export class TokenBudgetManager {
  private usedTokens: number = 0;
  private reservedTokens: number = 0;

  constructor(
    private totalBudget: number,
    private _reserveBuffer: number = 200
  ) {
    this._reserveBuffer = _reserveBuffer;
    this.totalBudget = totalBudget;
  }

  /**
   * Get remaining token budget
   */
  get remainingBudget(): number {
    return this.totalBudget - this.usedTokens - this.reservedTokens - this._reserveBuffer;
  }

  /**
   * Check if we can allocate tokens
   */
  canAllocate(tokens: number): boolean {
    return tokens <= this.remainingBudget;
  }

  /**
   * Allocate tokens from budget
   */
  allocate(tokens: number): boolean {
    if (!this.canAllocate(tokens)) {
      return false;
    }
    this.usedTokens += tokens;
    return true;
  }

  /**
   * Reserve tokens for future use
   */
  reserve(tokens: number): boolean {
    if (tokens > this.remainingBudget) {
      return false;
    }
    this.reservedTokens += tokens;
    return true;
  }

  /**
   * Release reserved tokens
   */
  release(tokens: number): void {
    this.reservedTokens = Math.max(0, this.reservedTokens - tokens);
  }

  /**
   * Reset budget
   */
  reset(): void {
    this.usedTokens = 0;
    this.reservedTokens = 0;
  }

  /**
   * Get budget status
   */
  getStatus(): {
    totalBudget: number;
    usedTokens: number;
    reservedTokens: number;
    remainingBudget: number;
    utilizationPercent: number;
  } {
    return {
      totalBudget: this.totalBudget,
      usedTokens: this.usedTokens,
      reservedTokens: this.reservedTokens,
      remainingBudget: this.remainingBudget,
      utilizationPercent: Math.round(
        ((this.usedTokens + this.reservedTokens + this._reserveBuffer) / this.totalBudget) * 100
      ),
    };
  }
}

/**
 * Model-specific token limits
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // OpenAI models
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'text-embedding-3-small': 8191,
  'text-embedding-3-large': 8191,
  'text-embedding-ada-002': 8191,
  // Default
  default: 8192,
};

/**
 * Get token limit for a model
 */
export function getModelTokenLimit(model: string): number {
  return MODEL_TOKEN_LIMITS[model] || MODEL_TOKEN_LIMITS.default;
}

/**
 * Calculate optimal chunk size based on token budget
 */
export function calculateOptimalChunkSize(
  totalTokens: number,
  targetChunks: number,
  overlapTokens: number = 50
): { chunkSize: number; overlap: number } {
  const effectiveTokens = totalTokens - overlapTokens * (targetChunks - 1);
  const chunkSize = Math.floor(effectiveTokens / targetChunks);

  return {
    chunkSize: Math.max(chunkSize, 100),
    overlap: overlapTokens,
  };
}
