import { describe, expect, it } from 'vitest';
import { deduplicateChunks } from '@/lib/rag/retrieval/hybrid';
import type { RetrievedChunk } from '@/lib/rag/retrieval/types';

describe('Hybrid Retrieval - Deduplication', () => {
  const createChunk = (id: string, content: string, score: number): RetrievedChunk => ({
    id,
    content,
    metadata: {
      documentId: 'doc-1',
      documentName: 'Test Doc',
      chunkIndex: 0,
      totalChunks: 10,
    },
    similarity: score,
  });

  describe('deduplicateChunks', () => {
    it('should remove exact duplicates', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'This is exactly the same content', 0.9),
        createChunk('2', 'This is exactly the same content', 0.85),
        createChunk('3', 'Different content here', 0.8),
      ];

      const result = deduplicateChunks(chunks, 0.9);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1'); // Higher score kept
      expect(result[1].id).toBe('3');
    });

    it('should remove near-duplicates based on Jaccard similarity', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'The quick brown fox jumps over the lazy dog', 0.9),
        createChunk('2', 'The quick brown fox jumps over the lazy dog.', 0.85), // Near duplicate with period
        createChunk('3', 'Completely different text about cats', 0.8),
      ];

      const result = deduplicateChunks(chunks, 0.8);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });

    it('should preserve higher scoring chunks when deduplicating', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'Content A', 0.7),
        createChunk('2', 'Content A', 0.9), // Same content, higher score
      ];

      const result = deduplicateChunks(chunks, 0.9);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2'); // Higher score should be kept
    });

    it('should handle empty input', () => {
      const result = deduplicateChunks([], 0.9);
      expect(result).toHaveLength(0);
    });

    it('should handle single chunk', () => {
      const chunks: RetrievedChunk[] = [createChunk('1', 'Only chunk', 0.9)];
      const result = deduplicateChunks(chunks, 0.9);
      expect(result).toHaveLength(1);
    });

    it('should respect similarity threshold', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'Some similar content here', 0.9),
        createChunk('2', 'Some similar content there', 0.85), // ~70% similar
        createChunk('3', 'Totally different stuff', 0.8),
      ];

      // With high threshold, should keep all
      const resultHigh = deduplicateChunks(chunks, 0.95);
      expect(resultHigh).toHaveLength(3);

      // With low threshold, should deduplicate
      const resultLow = deduplicateChunks(chunks, 0.7);
      expect(resultLow).toHaveLength(2);
    });
  });
});
