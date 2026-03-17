/**
 * Utility functions for chunking
 */

/**
 * Generate a unique ID (replacement for uuid when not available)
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Simple hash function for strings
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Escape special regex characters
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize whitespace in text
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Get overlapping text between two strings
 */
export function getOverlap(str1: string, str2: string, maxLength: number = 100): string {
  if (!str1 || !str2) return '';

  for (let len = Math.min(str1.length, str2.length, maxLength); len > 0; len--) {
    const end = str1.slice(-len);
    const start = str2.slice(0, len);
    if (end === start) {
      return end;
    }
  }

  return '';
}

/**
 * Find the best insertion point for a needle in a haystack
 * Returns the index where the needle is found, or -1
 */
export function findInsertionPoint(haystack: string, needle: string, startIndex: number = 0): number {
  // Try exact match first
  const exactIndex = haystack.indexOf(needle, startIndex);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  // Try normalized match
  const normalizedHaystack = haystack.replace(/\s+/g, ' ');
  const normalizedNeedle = needle.replace(/\s+/g, ' ');
  const normalizedIndex = normalizedHaystack.indexOf(normalizedNeedle, startIndex);
  if (normalizedIndex !== -1) {
    // Map back to original index (approximate)
    return Math.min(normalizedIndex, haystack.length - 1);
  }

  return -1;
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Split text into sentences
 * Handles common abbreviations and edge cases
 */
export function splitIntoSentences(text: string): string[] {
  // Protect common abbreviations
  const protectedText = text
    .replace(/(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|Vol|vol|pp|et al|i\.e|e\.g)\.\s/g, '$1<DOT> ')
    .replace(/(\d)\.\s/g, '$1<DOT> ')
    .replace(/(www|http|https)\./g, '$1<DOT>');

  // Split on sentence terminators followed by space or end
  const sentences = protectedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Split text into paragraphs
 */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Average multiple vectors
 */
export function averageVectors(vectors: number[][]): number[] {
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
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Batch array into chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}
