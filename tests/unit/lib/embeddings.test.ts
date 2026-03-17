import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  getCachedEmbedding,
  setCachedEmbedding,
} from '@/lib/rag/embeddings';
import { createMockOpenAIClient, mockEmbeddingResponse } from '@/tests/utils/mocks/openai';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => createMockOpenAIClient()),
}));

describe('Embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache
    global.embeddingCache?.clear();
  });

  describe('Embedding Generation', () => {
    it('generates embedding for text', async () => {
      const text = 'This is a test sentence.';
      
      const embedding = await generateEmbedding(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536); // text-embedding-3-small dimension
    });

    it('generates embeddings for multiple texts in batch', async () => {
      const texts = [
        'First test sentence.',
        'Second test sentence.',
        'Third test sentence.',
      ];
      
      const embeddings = await generateEmbeddingsBatch(texts);
      
      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1536);
      });
    });

    it('handles empty text gracefully', async () => {
      const embedding = await generateEmbedding('');
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('handles very long text', async () => {
      const longText = 'word '.repeat(10000);
      
      const embedding = await generateEmbedding(longText);
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });

    it('trims whitespace before generating', async () => {
      const text = '  trimmed text  ';
      
      await generateEmbedding(text);
      
      // Verify the API was called with trimmed text
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      expect(mockClient.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'trimmed text',
        })
      );
    });
  });

  describe('Batch Processing', () => {
    it('respects batch size limits', async () => {
      const texts = Array(100).fill('Test text');
      
      await generateEmbeddingsBatch(texts, { batchSize: 20 });
      
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      // Should make 5 calls for 100 items with batchSize 20
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(5);
    });

    it('handles partial batch failures', async () => {
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = createMockOpenAIClient();
      
      // First call succeeds, second fails
      mockClient.embeddings.create
        .mockResolvedValueOnce({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
        })
        .mockRejectedValueOnce(new Error('API Error'));
      
      vi.mocked(OpenAI).mockImplementation(() => mockClient);
      
      const texts = ['text1', 'text2', 'text3', 'text4'];
      
      await expect(
        generateEmbeddingsBatch(texts, { batchSize: 2 })
      ).rejects.toThrow('API Error');
    });

    it('processes batches concurrently', async () => {
      const texts = Array(50).fill('Test');
      
      await generateEmbeddingsBatch(texts, {
        batchSize: 10,
        concurrency: 5,
      });
      
      // Should process faster with concurrency
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(5);
    });

    it('reports progress during batch processing', async () => {
      const onProgress = vi.fn();
      const texts = Array(10).fill('Test');
      
      await generateEmbeddingsBatch(texts, {
        batchSize: 2,
        onProgress,
      });
      
      expect(onProgress).toHaveBeenCalledTimes(5);
      expect(onProgress).toHaveBeenLastCalledWith(10, 10);
    });
  });

  describe('Caching', () => {
    it('caches embeddings', async () => {
      const text = 'Cache test';
      
      await generateEmbedding(text);
      
      // Second call should use cache
      await generateEmbedding(text);
      
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      // Should only call API once
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(1);
    });

    it('retrieves cached embedding', () => {
      const text = 'Cached text';
      const embedding = [0.1, 0.2, 0.3];
      
      setCachedEmbedding(text, embedding);
      const cached = getCachedEmbedding(text);
      
      expect(cached).toEqual(embedding);
    });

    it('returns null for non-cached text', () => {
      const cached = getCachedEmbedding('not cached');
      expect(cached).toBeNull();
    });

    it('respects cache size limit', async () => {
      // Generate embeddings for many unique texts
      for (let i = 0; i < 1100; i++) {
        await generateEmbedding(`unique text ${i}`);
      }
      
      // Cache should have evicted oldest entries
      const veryFirst = getCachedEmbedding('unique text 0');
      expect(veryFirst).toBeNull();
    });

    it('bypasses cache when requested', async () => {
      const text = 'No cache';
      
      await generateEmbedding(text);
      await generateEmbedding(text, { skipCache: true });
      
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('clears cache on request', () => {
      setCachedEmbedding('test', [0.1, 0.2]);
      
      global.embeddingCache?.clear();
      
      expect(getCachedEmbedding('test')).toBeNull();
    });
  });

  describe('Model Configuration', () => {
    it('uses specified model', async () => {
      await generateEmbedding('test', { model: 'text-embedding-3-large' });
      
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      expect(mockClient.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-large',
        })
      );
    });

    it('uses default model when not specified', async () => {
      await generateEmbedding('test');
      
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      expect(mockClient.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-small',
        })
      );
    });

    it('handles dimension parameter for embedding model', async () => {
      await generateEmbedding('test', { 
        model: 'text-embedding-3-large',
        dimensions: 256 
      });
      
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = vi.mocked(OpenAI).mock.results[0].value;
      
      expect(mockClient.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions: 256,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = createMockOpenAIClient();
      mockClient.embeddings.create.mockRejectedValue(new Error('Rate limit exceeded'));
      vi.mocked(OpenAI).mockImplementation(() => mockClient);
      
      await expect(generateEmbedding('test')).rejects.toThrow('Rate limit exceeded');
    });

    it('retries on transient errors', async () => {
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = createMockOpenAIClient();
      
      mockClient.embeddings.create
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
        });
      
      vi.mocked(OpenAI).mockImplementation(() => mockClient);
      
      const embedding = await generateEmbedding('test', { retries: 1 });
      
      expect(embedding).toBeDefined();
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('reports token usage', async () => {
      const onUsage = vi.fn();
      
      await generateEmbedding('test', { onUsage });
      
      expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({
        prompt_tokens: expect.any(Number),
        total_tokens: expect.any(Number),
      }));
    });
  });
});
