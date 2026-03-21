import { vi } from 'vitest';
import type { EmbeddingProvider } from '@/lib/ai/embeddings';

/**
 * Mock Google Embedding Provider
 */
export function createMockGoogleProvider(
  overrides?: Partial<EmbeddingProvider>
): EmbeddingProvider {
  return {
    name: 'google',
    modelName: 'text-embedding-004',
    dimensions: 768,
    embedQuery: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
    embedDocuments: vi.fn().mockResolvedValue([Array(768).fill(0.1), Array(768).fill(0.2)]),
    healthCheck: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

/**
 * Mock OpenAI Embedding Provider
 */
export function createMockOpenAIProvider(
  overrides?: Partial<EmbeddingProvider>
): EmbeddingProvider {
  return {
    name: 'openai',
    modelName: 'text-embedding-3-small',
    dimensions: 1536,
    embedQuery: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
    embedDocuments: vi.fn().mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2)]),
    healthCheck: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

/**
 * Mock Ollama Embedding Provider
 */
export function createMockOllamaProvider(
  overrides?: Partial<EmbeddingProvider>
): EmbeddingProvider {
  return {
    name: 'ollama',
    modelName: 'nomic-embed-text',
    dimensions: 768,
    embedQuery: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
    embedDocuments: vi.fn().mockResolvedValue([Array(768).fill(0.1), Array(768).fill(0.2)]),
    healthCheck: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

/**
 * Mock provider that simulates failures
 */
export function createMockFailingProvider(
  errorMessage: string = 'Provider error'
): EmbeddingProvider {
  const error = new Error(errorMessage);
  return {
    name: 'failing',
    modelName: 'failing-model',
    dimensions: 768,
    embedQuery: vi.fn().mockRejectedValue(error),
    embedDocuments: vi.fn().mockRejectedValue(error),
    healthCheck: vi.fn().mockResolvedValue(false),
  };
}

/**
 * Mock provider that simulates rate limiting
 */
export function createMockRateLimitedProvider(): EmbeddingProvider {
  const rateLimitError = new Error('Rate limit exceeded');
  (rateLimitError as unknown as { status: number }).status = 429;

  return {
    name: 'rate-limited',
    modelName: 'rate-limited-model',
    dimensions: 768,
    embedQuery: vi.fn().mockRejectedValue(rateLimitError),
    embedDocuments: vi.fn().mockRejectedValue(rateLimitError),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Mock embedding providers factory
 */
export const mockEmbeddingProviders = {
  google: createMockGoogleProvider(),
  openai: createMockOpenAIProvider(),
  ollama: createMockOllamaProvider(),
  failing: createMockFailingProvider(),
  rateLimited: createMockRateLimitedProvider(),
};

/**
 * Reset all provider mocks
 */
export function resetEmbeddingProviderMocks(): void {
  Object.values(mockEmbeddingProviders).forEach((provider) => {
    vi.mocked(provider.embedQuery).mockClear();
    vi.mocked(provider.embedDocuments).mockClear();
    if (provider.healthCheck) {
      vi.mocked(provider.healthCheck).mockClear();
    }
  });
}
