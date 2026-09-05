import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @ai-sdk/google before importing anything that uses it
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue({
    textEmbeddingModel: vi.fn().mockReturnValue('mock-model'),
  }),
}));

// Mock the ai SDK embed/embedMany functions
const mockEmbed = vi.fn().mockResolvedValue({ embedding: Array(768).fill(0.1) });
const mockEmbedMany = vi.fn().mockResolvedValue({
  embeddings: [Array(768).fill(0.1), Array(768).fill(0.2)],
});

vi.mock('ai', () => ({
  embed: (...args: unknown[]) => mockEmbed(...args),
  embedMany: (...args: unknown[]) => mockEmbedMany(...args),
}));

// Mock Redis to prevent connection errors
vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock LangChain OpenAI for the OpenAI provider
vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
    embedDocuments: vi.fn().mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2)]),
  })),
}));

// Mock the resilience module
vi.mock('@/lib/resilience/external-services', () => ({
  embeddingCircuitBreaker: {
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
  },
}));

import {
  createCachedProvider,
  createEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  createGoogleProvider,
  createOllamaProvider,
  createOpenAIProvider,
  createProviderWithFallback,
  GoogleEmbeddingProvider,
  getDefaultProvider,
  getModelDimensions,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from '@/lib/ai/embeddings';

// Set required env vars before tests
process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';

describe('Embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue({ embedding: Array(768).fill(0.1) });
    mockEmbedMany.mockResolvedValue({
      embeddings: [Array(768).fill(0.1), Array(768).fill(0.2)],
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [{ values: Array(768).fill(0.1) }, { values: Array(768).fill(0.2) }],
      }),
      text: async () => '',
    } as Response);
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
      const validModels = [
        'text-embedding-004',
        'gemini-embedding-001',
        'gemini-embedding-2',
      ] as const;

      for (const model of validModels) {
        const provider = createGoogleProvider(model, 'test-key');
        expect(provider.modelName).toBe(model);
      }
    });

    it('should throw for invalid model', () => {
      expect(() =>
        createGoogleProvider('invalid-model' as 'text-embedding-004', 'test-key')
      ).toThrow('Invalid Google model');
    });

    it('should throw for missing API key', () => {
      const original = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      expect(() => createGoogleProvider('text-embedding-004')).toThrow('API key');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = original;
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
      const provider = createOpenAIProvider('text-embedding-3-small', 'test-key');
      const embedding = await provider.embedQuery('test query');

      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should embed documents', async () => {
      const provider = createOpenAIProvider('text-embedding-3-small', 'test-key');
      const embeddings = await provider.embedDocuments(['doc1', 'doc2']);

      expect(embeddings).toHaveLength(2);
    });

    it('should support different models', () => {
      const models: Array<{
        name: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
        dimensions: number;
      }> = [
        { name: 'text-embedding-3-small', dimensions: 1536 },
        { name: 'text-embedding-3-large', dimensions: 3072 },
        { name: 'text-embedding-ada-002', dimensions: 1536 },
      ];

      for (const { name, dimensions } of models) {
        const provider = createOpenAIProvider(name, 'test-key');
        expect(provider.dimensions).toBe(dimensions);
      }
    });

    it('should throw for empty text', async () => {
      const provider = createOpenAIProvider('text-embedding-3-small', 'test-key');
      await expect(provider.embedQuery('')).rejects.toThrow('empty text');
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
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: Array(768).fill(0.1) }),
      });
      vi.spyOn(global, 'fetch').mockImplementation(mockFetch);

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

    it('should handle Ollama errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      const provider = createOllamaProvider('nomic-embed-text');

      await expect(provider.embedQuery('test')).rejects.toThrow('Ollama API error');
    });

    it('should perform health check', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'nomic-embed-text' }] }),
      } as Response);

      const provider = createOllamaProvider('nomic-embed-text');
      const isHealthy = await provider.healthCheck?.();

      expect(isHealthy).toBe(true);
    });

    it('should fail health check when model unavailable', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'other-model' }] }),
      } as Response);

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
        dimensions: 768,
        apiKey: 'test-key',
      });

      expect(provider).toBeInstanceOf(GoogleEmbeddingProvider);
    });

    it('should throw for unknown provider', () => {
      expect(() =>
        createEmbeddingProvider({
          provider: 'unknown' as 'google',
          model: 'test',
          dimensions: 768,
        })
      ).toThrow('Unknown provider');
    });

    it('should create provider from environment variables', () => {
      const originalEnv = process.env.EMBEDDING_PROVIDER;
      process.env.EMBEDDING_PROVIDER = 'google';

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
        dimensions: 768,
        baseUrl: 'http://unreachable:11434',
      };
      const fallback = {
        provider: 'google' as const,
        model: 'text-embedding-004',
        dimensions: 768,
        apiKey: 'test-key',
      };

      // Mock fetch to fail for Ollama health check
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection refused'));

      const provider = await createProviderWithFallback(primary, fallback);

      expect(provider.name).toBe('google');
    });

    it('should use primary provider if healthy', async () => {
      const primary = {
        provider: 'google' as const,
        model: 'text-embedding-004',
        dimensions: 768,
        apiKey: 'test-key',
      };
      const fallback = {
        provider: 'openai' as const,
        model: 'text-embedding-3-small',
        dimensions: 1536,
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
      const fetchSpy = vi.spyOn(global, 'fetch');

      const cachedProvider = createCachedProvider(
        baseProvider,
        {
          get: async (key) => cache.get(key) || null,
          set: async (key, value) => cache.set(key, value),
        },
        { ttl: 3600 }
      );

      await cachedProvider.embedQuery('test');
      await cachedProvider.embedQuery('test');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should cache document embeddings partially', async () => {
      const baseProvider = createGoogleProvider('text-embedding-004', 'test-key');
      const cache = new Map<string, number[]>();
      const fetchSpy = vi.spyOn(global, 'fetch');

      const cachedProvider = createCachedProvider(baseProvider, {
        get: async (key) => cache.get(key) || null,
        set: async (key, value) => cache.set(key, value),
      });

      await cachedProvider.embedDocuments(['doc1', 'doc2']);
      await cachedProvider.embedDocuments(['doc1', 'doc3']);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
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
      expect(getModelDimensions('google', 'gemini-embedding-001')).toBe(3072);
      expect(getModelDimensions('google', 'gemini-embedding-2')).toBe(768);
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
