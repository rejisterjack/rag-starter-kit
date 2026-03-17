import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  vectorSearch,
  keywordSearch,
  hybridSearch,
  rerankResults,
  combineResults,
} from '@/lib/rag/retrieval';
import { mockPrisma, getMockPrisma } from '@/tests/utils/mocks/prisma';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('Retrieval', () => {
  const mockChunks = [
    { id: 'chunk-1', content: 'Q1 revenue was $32 million', similarity: 0.92, documentId: 'doc-1' },
    { id: 'chunk-2', content: 'Q2 revenue was $38 million', similarity: 0.88, documentId: 'doc-1' },
    { id: 'chunk-3', content: 'Total operating expenses were $123 million', similarity: 0.85, documentId: 'doc-1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Vector Search', () => {
    it('performs vector search correctly', async () => {
      const mockQuery = vi.fn().mockResolvedValue(mockChunks);
      getMockPrisma().$queryRaw = mockQuery;

      const results = await vectorSearch({
        query: 'What was the revenue?',
        queryEmbedding: Array(1536).fill(0).map(() => Math.random()),
        workspaceId: 'ws-1',
        topK: 5,
      });

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('chunk-1');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('respects topK parameter', async () => {
      const mockQuery = vi.fn().mockResolvedValue(mockChunks);
      getMockPrisma().$queryRaw = mockQuery;

      await vectorSearch({
        query: 'revenue',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 2,
      });

      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall.values).toContain(2); // LIMIT 2
    });

    it('filters by workspace ID', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      getMockPrisma().$queryRaw = mockQuery;

      await vectorSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'workspace-123',
        topK: 5,
      });

      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall.values).toContain('workspace-123');
    });

    it('filters by document IDs when specified', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      getMockPrisma().$queryRaw = mockQuery;

      await vectorSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        documentIds: ['doc-1', 'doc-2'],
        topK: 5,
      });

      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall.strings.join('')).toContain('documentId');
    });

    it('applies similarity threshold', async () => {
      const filteredChunks = mockChunks.filter(c => c.similarity >= 0.9);
      const mockQuery = vi.fn().mockResolvedValue(filteredChunks);
      getMockPrisma().$queryRaw = mockQuery;

      const results = await vectorSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
        minSimilarity: 0.9,
      });

      expect(results.every(r => r.similarity >= 0.9)).toBe(true);
    });

    it('handles empty results gracefully', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue([]);

      const results = await vectorSearch({
        query: 'nonexistent',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
      });

      expect(results).toEqual([]);
    });
  });

  describe('Keyword Search', () => {
    it('performs full-text search', async () => {
      const mockResults = [
        { id: 'chunk-1', content: 'Revenue report', rank: 0.8 },
        { id: 'chunk-2', content: 'Financial revenue data', rank: 0.7 },
      ];
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue(mockResults);

      const results = await keywordSearch({
        query: 'revenue',
        workspaceId: 'ws-1',
        topK: 5,
      });

      expect(results).toHaveLength(2);
      expect(results[0].content).toContain('Revenue');
    });

    it('uses websearch_to_tsquery for better matching', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      getMockPrisma().$queryRaw = mockQuery;

      await keywordSearch({
        query: 'machine learning algorithms',
        workspaceId: 'ws-1',
        topK: 5,
      });

      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall.strings.join('')).toContain('websearch_to_tsquery');
    });

    it('handles special characters in query', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue([]);

      await expect(keywordSearch({
        query: 'test & special | chars!',
        workspaceId: 'ws-1',
        topK: 5,
      })).resolves.not.toThrow();
    });
  });

  describe('Hybrid Search', () => {
    it('combines vector and keyword search', async () => {
      const vectorResults = [
        { id: 'chunk-1', content: 'Vector match', similarity: 0.95 },
        { id: 'chunk-2', content: 'Another vector', similarity: 0.85 },
      ];
      const keywordResults = [
        { id: 'chunk-2', content: 'Another vector', rank: 0.9 },
        { id: 'chunk-3', content: 'Keyword match', rank: 0.8 },
      ];

      getMockPrisma().$queryRaw
        .mockResolvedValueOnce(vectorResults)
        .mockResolvedValueOnce(keywordResults);

      const results = await hybridSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
      });

      // Should include results from both searches
      const ids = results.map(r => r.id);
      expect(ids).toContain('chunk-1');
      expect(ids).toContain('chunk-3');
    });

    it('applies RRF fusion', async () => {
      const vectorResults = [
        { id: 'chunk-1', content: 'First', similarity: 0.95 },
        { id: 'chunk-2', content: 'Second', similarity: 0.90 },
      ];
      const keywordResults = [
        { id: 'chunk-2', content: 'Second', rank: 0.95 },
        { id: 'chunk-1', content: 'First', rank: 0.85 },
      ];

      getMockPrisma().$queryRaw
        .mockResolvedValueOnce(vectorResults)
        .mockResolvedValueOnce(keywordResults);

      const results = await hybridSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
        fusion: 'rrf',
        rrfK: 60,
      });

      // chunk-2 should rank higher due to good position in both lists
      expect(results[0].id).toBe('chunk-2');
    });

    it('applies weighted fusion', async () => {
      const vectorResults = [
        { id: 'chunk-1', content: 'Vector', similarity: 0.5 },
      ];
      const keywordResults = [
        { id: 'chunk-1', content: 'Vector', rank: 0.9 },
      ];

      getMockPrisma().$queryRaw
        .mockResolvedValueOnce(vectorResults)
        .mockResolvedValueOnce(keywordResults);

      const results = await hybridSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
        fusion: 'weighted',
        weights: { vector: 0.3, keyword: 0.7 },
      });

      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('deduplicates results from both searches', async () => {
      const vectorResults = [
        { id: 'chunk-1', content: 'Duplicate', similarity: 0.95 },
      ];
      const keywordResults = [
        { id: 'chunk-1', content: 'Duplicate', rank: 0.9 },
      ];

      getMockPrisma().$queryRaw
        .mockResolvedValueOnce(vectorResults)
        .mockResolvedValueOnce(keywordResults);

      const results = await hybridSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
      });

      const chunk1Results = results.filter(r => r.id === 'chunk-1');
      expect(chunk1Results).toHaveLength(1);
    });
  });

  describe('Re-ranking', () => {
    it('re-ranks results by relevance', async () => {
      const results = [
        { id: 'chunk-1', content: 'Operating expenses', score: 0.85 },
        { id: 'chunk-2', content: 'Q1 revenue was $32 million', score: 0.88 },
        { id: 'chunk-3', content: 'Q2 revenue details', score: 0.92 },
      ];

      const reranked = await rerankResults({
        query: 'revenue for Q1',
        results,
        topK: 3,
      });

      // chunk-2 should rank higher due to semantic relevance
      expect(reranked[0].content).toContain('Q1 revenue');
    });

    it('uses cross-encoder for re-ranking', async () => {
      const results = [
        { id: 'chunk-1', content: 'Test content', score: 0.8 },
      ];

      // Mock the cross-encoder scoring
      vi.mock('@/lib/rag/reranker', () => ({
        crossEncoderScore: vi.fn().mockResolvedValue([0.95]),
      }));

      const reranked = await rerankResults({
        query: 'test',
        results,
        topK: 3,
      });

      expect(reranked[0].score).toBe(0.95);
    });

    it('limits results to topK', async () => {
      const results = Array(10).fill(0).map((_, i) => ({
        id: `chunk-${i}`,
        content: `Content ${i}`,
        score: 0.9 - i * 0.05,
      }));

      const reranked = await rerankResults({
        query: 'test',
        results,
        topK: 5,
      });

      expect(reranked).toHaveLength(5);
    });
  });

  describe('Result Combination', () => {
    it('combines multiple result sets', () => {
      const set1 = [
        { id: 'chunk-1', content: 'A', score: 0.9 },
        { id: 'chunk-2', content: 'B', score: 0.8 },
      ];
      const set2 = [
        { id: 'chunk-2', content: 'B', score: 0.85 },
        { id: 'chunk-3', content: 'C', score: 0.75 },
      ];

      const combined = combineResults([set1, set2]);

      expect(combined).toHaveLength(3);
      // chunk-2 score should be combined
      const chunk2 = combined.find(c => c.id === 'chunk-2');
      expect(chunk2?.score).toBeGreaterThan(0.8);
    });

    it('normalizes scores before combining', () => {
      const set1 = [
        { id: 'chunk-1', content: 'A', score: 100 },
        { id: 'chunk-2', content: 'B', score: 80 },
      ];
      const set2 = [
        { id: 'chunk-1', content: 'A', score: 0.9 },
        { id: 'chunk-3', content: 'C', score: 0.7 },
      ];

      const combined = combineResults([set1, set2], { normalize: true });

      // All scores should be in [0, 1] range
      combined.forEach(c => {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles very long queries', async () => {
      const longQuery = 'word '.repeat(500);
      
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue([]);

      await expect(vectorSearch({
        query: longQuery,
        queryEmbedding: Array(1536).fill(0),
        workspaceId: 'ws-1',
        topK: 5,
      })).resolves.not.toThrow();
    });

    it('handles queries with special characters', async () => {
      const specialQuery = "Revenue & Profit (Q1'24) - *Special*!";
      
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue([]);

      await expect(keywordSearch({
        query: specialQuery,
        workspaceId: 'ws-1',
        topK: 5,
      })).resolves.not.toThrow();
    });

    it('handles null embeddings gracefully', async () => {
      const results = await vectorSearch({
        query: 'test',
        queryEmbedding: null as unknown as number[],
        workspaceId: 'ws-1',
        topK: 5,
      });

      expect(results).toEqual([]);
    });

    it('handles database errors gracefully', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockRejectedValue(new Error('DB Error'));

      await expect(vectorSearch({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'ws-1',
        topK: 5,
      })).rejects.toThrow('DB Error');
    });
  });
});
