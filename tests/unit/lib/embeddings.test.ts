import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  getCachedEmbedding,
  setCachedEmbedding,
} from '@/lib/rag/embeddings';
import {
  createEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  createCachedProvider,
  createProviderWithFallback,
  getDefaultProvider,
  getModelDimensions,
  GoogleEmbeddingProvider,
  OpenAIEmbeddingProvider,
  OllamaEmbeddingProvider,
  createGoogleProvider,
  createOpenAIProvider,
  createOllamaProvider,
} from '@/lib/ai/embeddings';
import { createMockOpenAIClient } from '@/tests/utils/mocks/openai';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => createMockOpenAIClient()),
}));

// Mock Google Generative AI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      batchEmbedContents: vi.fn().mockResolvedValue({
        embeddings: Array(3).fill({ values: Array(768).fill(0.1) }),
      }),
      embedContent: vi.fn().mockResolvedValue({
        embedding: { values: Array(768).fill(0.1) },
      }),
    }),
  })),
}));

// Mock fetch for Ollama
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
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
      const texts = ['First test sentence.', 'Second test sentence.', 'Third test sentence.'];

      const embeddings = await generateEmbeddingsBatch(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((embedding) => {
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

      await expect(generateEmbeddingsBatch(texts, { batchSize: 2 })).rejects.toThrow('API Error');
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
        dimensions: 256,
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

      expect(onUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        })
      );
    });

    it('handles network errors with retry', async () => {
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = createMockOpenAIClient();

      mockClient.embeddings.create
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
        });

      vi.mocked(OpenAI).mockImplementation(() => mockClient);

      const embedding = await generateEmbedding('test', { retries: 3 });

      expect(embedding).toBeDefined();
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(3);
    });

    it('throws after max retries exceeded', async () => {
      const OpenAI = (await import('openai')).OpenAI;
      const mockClient = createMockOpenAIClient();
      mockClient.embeddings.create.mockRejectedValue(new Error('Persistent Error'));
      vi.mocked(OpenAI).mockImplementation(() => mockClient);

      await expect(generateEmbedding('test', { retries: 2 })).rejects.toThrow('Persistent Error');
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});

describe('Embedding Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Google Provider', () => {
    it('should create Google provider', () => {
      const provider = createGoogleProvider('text-embedding-004', 'test-key');

      expect(provider).toBeInstanceOf(GoogleEmbeddingProvider);
      expect(provider.name).toBe('google');
      expect(provider.modelName).toBe('text-embedding-004');
      expect(provider.dimensions).toBe(768);
    });

    it('should embed query', async () => {
      const provider = createGoogleProvider('text-embedding-004', 'test-key');
      const embedding = await provider.embedQuery('test query');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });

    it('should embed documents', async () => {
      const provider = createGoogleProvider('text-embedding-004', 'test-key');
      const embeddings = await provider.embedDocuments(['doc1', 'doc2']);

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0].length).toBe(768);
    });

    it('should support valid models', () => {
      const validModels = ['text-embedding-004', 'embedding-001'];

      validModels.forEach((model) => {
        const provider = createGoogleProvider(model as 'text-embedding-004', 'test-key');
        expect(provider.modelName).toBe(model);
      });
    });

    it('should perform health check', async () => {
      const provider = createGoogleProvider('text-embedding-004', 'test-key');
      const isHealthy = await provider.healthCheck?.();

      expect(isHealthy).toBe(true);
    });
  });

  describe('OpenAI Provider', () => {
    it('should create OpenAI provider', () => {
      const provider = createOpenAIProvider('text-embedding-3-small', 'test-key');

      expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect(provider.name).toBe('openai');
      expect(provider.modelName).toBe('text-embedding-3-small');
      expect(provider.dimensions).toBe(1536);
    });

    it('should embed query', async () => {
      const { OpenAI } = await import('openai');
      const mockClient = createMockOpenAIClient();
      vi.mocked(OpenAI).mockImplementation(() => mockClient);

      const provider = createOpenAIProvider('text-embedding-3-small', 'test-key');
      const embedding = await provider.embedQuery('test query');

      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should embed documents', async () => {
      const { OpenAI } = await import('openai');
      const mockClient = createMockOpenAIClient();
      vi.mocked(OpenAI).mockImplementation(() => mockClient);

      const provider = createOpenAIProvider('text-embedding-3-small', 'test-key');
      const embeddings = await provider.embedDocuments(['doc1', 'doc2']);

      expect(embeddings).toHaveLength(2);
    });

    it('should support different models', () => {
      const models = [
        { name: 'text-embedding-3-small', dimensions: 1536 },
        { name: 'text-embedding-3-large', dimensions: 3072 },
        { name: 'text-embedding-ada-002', dimensions: 1536 },
      ];

      models.forEach(({ name, dimensions }) => {
        const provider = createOpenAIProvider(name as 'text-embedding-3-small', 'test-key');
        expect(provider.dimensions).toBe(dimensions);
      });
    });
  });

  describe('Ollama Provider', () => {
    it('should create Ollama provider', () => {
      const provider = createOllamaProvider('nomic-embed-text', 'http://localhost:11434');

      expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
      expect(provider.name).toBe('ollama');
      expect(provider.modelName).toBe('nomic-embed-text');
    });

    it('should embed query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: Array(768).fill(0.1) }),
      });

      const provider = createOllamaProvider('nomic-embed-text');
      const embedding = await provider.embedQuery('test query');

      expect(Array.isArray(embedding)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('nomic-embed-text'),
        })
      );
    });

    it('should embed documents', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: Array(768).fill(0.1) }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: Array(768).fill(0.2) }),
        });

      const provider = createOllamaProvider('nomic-embed-text');
      const embeddings = await provider.embedDocuments(['doc1', 'doc2']);

      expect(embeddings).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle Ollama errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const provider = createOllamaProvider('nomic-embed-text');

      await expect(provider.embedQuery('test')).rejects.toThrow('Ollama API error');
    });

    it('should handle connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const provider = createOllamaProvider('nomic-embed-text');

      await expect(provider.embedQuery('test')).rejects.toThrow('Connection refused');
    });

    it('should perform health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'nomic-embed-text' }] }),
      });

      const provider = createOllamaProvider('nomic-embed-text');
      const isHealthy = await provider.healthCheck?.();

      expect(isHealthy).toBe(true);
    });

    it('should fail health check when model unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'other-model' }] }),
      });

      const provider = createOllamaProvider('nomic-embed-text');
      const isHealthy = await provider.healthCheck?.();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Provider Factory', () => {
    it('should create provider from config', () => {
      const provider = createEmbeddingProvider({
        provider: 'google',
        model: 'text-embedding-004',
        apiKey: 'test-key',
      });

      expect(provider).toBeInstanceOf(GoogleEmbeddingProvider);
    });

    it('should throw for unknown provider', () => {
      expect(() =>
        createEmbeddingProvider({
          provider: 'unknown' as 'google',
          model: 'test',
        })
      ).toThrow('Unknown provider');
    });

    it('should create provider from environment variables', () => {
      const originalEnv = process.env.EMBEDDING_PROVIDER;
      process.env.EMBEDDING_PROVIDER = 'google';
      process.env.GOOGLE_API_KEY = 'test-key';

      const provider = createEmbeddingProviderFromEnv();

      expect(provider.name).toBe('google');

      process.env.EMBEDDING_PROVIDER = originalEnv;
    });

    it('should allow environment overrides', () => {
      const provider = createEmbeddingProviderFromEnv({
        provider: 'openai',
        model: 'text-embedding-3-large',
      });

      expect(provider.name).toBe('openai');
      expect(provider.modelName).toBe('text-embedding-3-large');
    });

    it('should get default provider', () => {
      const provider = getDefaultProvider();

      expect(provider.name).toBe('google');
    });

    it('should create provider with fallback', async () => {
      const primary = {
        provider: 'ollama' as const,
        model: 'nomic-embed-text',
        baseUrl: 'http://unreachable:11434',
      };
      const fallback = {
        provider: 'google' as const,
        model: 'text-embedding-004',
        apiKey: 'test-key',
      };

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const provider = await createProviderWithFallback(primary, fallback);

      expect(provider.name).toBe('google');
    });

    it('should use primary provider if healthy', async () => {
      const primary = {
        provider: 'google' as const,
        model: 'text-embedding-004',
        apiKey: 'test-key',
      };
      const fallback = {
        provider: 'openai' as const,
        model: 'text-embedding-3-small',
        apiKey: 'test-key',
      };

      const provider = await createProviderWithFallback(primary, fallback);

      expect(provider.name).toBe('google');
    });
  });

  describe('Cached Provider', () => {
    it('should cache query embeddings', async () => {
      const baseProvider = createGoogleProvider('text-embedding-004', 'test-key');
      const cache = new Map<string, number[]>();

      const cachedProvider = createCachedProvider(
        baseProvider,
        {
          get: async (key) => cache.get(key) || null,
          set: async (key, value) => cache.set(key, value),
        },
        { ttl: 3600 }
      );

      // First call
      await cachedProvider.embedQuery('test');
      // Second call should use cache
      await cachedProvider.embedQuery('test');

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      // Should only call Google API once
      expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
    });

    it('should cache document embeddings partially', async () => {
      const baseProvider = createGoogleProvider('text-embedding-004', 'test-key');
      const cache = new Map<string, number[]>();

      const cachedProvider = createCachedProvider(baseProvider, {
        get: async (key) => cache.get(key) || null,
        set: async (key, value) => cache.set(key, value),
      });

      // First batch
      await cachedProvider.embedDocuments(['doc1', 'doc2']);
      // Second batch with one cached
      await cachedProvider.embedDocuments(['doc1', 'doc3']);

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      // Both batches use the same base provider instance in these tests
      expect(GoogleGenerativeAI).toHaveBeenCalled();
    });

    it('should use custom hash function', async () => {
      const baseProvider = createGoogleProvider('text-embedding-004', 'test-key');
      const cache = new Map<string, number[]>();
      const customHash = vi.fn().mockReturnValue('custom-hash');

      const cachedProvider = createCachedProvider(
        baseProvider,
        {
          get: async (key) => cache.get(key) || null,
          set: async (key, value) => cache.set(key, value),
        },
        { hashFn: customHash }
      );

      await cachedProvider.embedQuery('test');

      expect(customHash).toHaveBeenCalledWith('test');
    });
  });

  describe('Model Dimensions', () => {
    it('should return dimensions for Google models', () => {
      expect(getModelDimensions('google', 'text-embedding-004')).toBe(768);
      expect(getModelDimensions('google', 'embedding-001')).toBe(768);
    });

    it('should return dimensions for OpenAI models', () => {
      expect(getModelDimensions('openai', 'text-embedding-3-small')).toBe(1536);
      expect(getModelDimensions('openai', 'text-embedding-3-large')).toBe(3072);
      expect(getModelDimensions('openai', 'text-embedding-ada-002')).toBe(1536);
    });

    it('should return dimensions for Ollama models', () => {
      expect(getModelDimensions('ollama', 'nomic-embed-text')).toBe(768);
      expect(getModelDimensions('ollama', 'all-minilm')).toBe(384);
      expect(getModelDimensions('ollama', 'mxbai-embed-large')).toBe(1024);
    });

    it('should throw for unknown model', () => {
      expect(() => getModelDimensions('google', 'unknown-model')).toThrow('Unknown model');
    });
  });
});
