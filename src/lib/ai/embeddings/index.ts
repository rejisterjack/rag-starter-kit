/**
 * Embedding Provider Factory
 * 
 * Central export point for all embedding providers.
 * Provides factory function to create appropriate provider based on config.
 */

import {
  type EmbeddingProvider,
  type EmbeddingConfig,
  OPENAI_MODELS,
  OLLAMA_MODELS,
} from './types';
import { OpenAIEmbeddingProvider, createOpenAIProvider } from './openai';
import { OllamaEmbeddingProvider, createOllamaProvider } from './ollama';

// Re-export all types and providers
export * from './types';
export { OpenAIEmbeddingProvider, createOpenAIProvider } from './openai';
export { OllamaEmbeddingProvider, createOllamaProvider } from './ollama';

/**
 * Provider factory configuration with environment fallbacks
 */
export interface ProviderFactoryConfig {
  /** Provider type - falls back to EMBEDDING_PROVIDER env var, then 'openai' */
  provider?: 'openai' | 'ollama';
  /** Model name - falls back to EMBEDDING_MODEL env var */
  model?: string;
  /** API key - falls back to provider-specific env var */
  apiKey?: string;
  /** Base URL for API - falls back to provider-specific env var */
  baseUrl?: string;
  /** Batch size for document embedding */
  batchSize?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Request timeout in ms */
  timeoutMs?: number;
}

/**
 * Create an embedding provider based on configuration
 */
export function createEmbeddingProvider(
  config: EmbeddingConfig
): EmbeddingProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIEmbeddingProvider(config);
    case 'ollama':
      return new OllamaEmbeddingProvider(config);
    default:
      throw new Error(
        `Unknown provider: ${config.provider}. ` +
        `Supported providers: openai, ollama`
      );
  }
}

/**
 * Create embedding provider from environment variables
 * 
 * Environment variables:
 * - EMBEDDING_PROVIDER: 'openai' or 'ollama' (default: 'openai')
 * - EMBEDDING_MODEL: Model name (default: text-embedding-3-small for OpenAI, nomic-embed-text for Ollama)
 * - OPENAI_API_KEY: OpenAI API key
 * - OLLAMA_BASE_URL: Ollama base URL (default: http://localhost:11434)
 */
export function createEmbeddingProviderFromEnv(
  overrides?: ProviderFactoryConfig
): EmbeddingProvider {
  const provider = overrides?.provider ?? 
    (process.env.EMBEDDING_PROVIDER as 'openai' | 'ollama') ?? 
    'openai';

  if (provider === 'ollama') {
    const model = overrides?.model ?? 
      process.env.EMBEDDING_MODEL ?? 
      'nomic-embed-text';

    if (!isValidOllamaModel(model)) {
      throw new Error(
        `Invalid Ollama model: ${model}. ` +
        `Supported: ${Object.keys(OLLAMA_MODELS).join(', ')}`
      );
    }

    return createOllamaProvider(
      model,
      overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL
    );
  }

  // Default to OpenAI
  const model = overrides?.model ?? 
    process.env.EMBEDDING_MODEL ?? 
    'text-embedding-3-small';

  if (!isValidOpenAIModel(model)) {
    throw new Error(
      `Invalid OpenAI model: ${model}. ` +
      `Supported: ${Object.keys(OPENAI_MODELS).join(', ')}`
    );
  }

  return createOpenAIProvider(
    model,
    overrides?.apiKey ?? process.env.OPENAI_API_KEY
  );
}

/**
 * Get default provider (OpenAI text-embedding-3-small)
 */
export function getDefaultProvider(): EmbeddingProvider {
  return createOpenAIProvider('text-embedding-3-small');
}

/**
 * Get provider with fallback - tries primary, falls back to secondary on failure
 */
export async function createProviderWithFallback(
  primary: EmbeddingConfig,
  fallback: EmbeddingConfig
): Promise<EmbeddingProvider> {
  try {
    const primaryProvider = createEmbeddingProvider(primary);
    
    // Test if primary is available
    if (await primaryProvider.healthCheck?.()) {
      return primaryProvider;
    }
    
    console.warn(`Primary provider ${primary.provider} unavailable, using fallback`);
  } catch (error) {
    console.warn(`Failed to initialize primary provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return createEmbeddingProvider(fallback);
}

/**
 * Create a cached embedding provider wrapper
 */
export function createCachedProvider(
  provider: EmbeddingProvider,
  cache: {
    get(key: string): Promise<number[] | null>;
    set(key: string, value: number[], ttl?: number): Promise<void>;
  },
  options?: {
    /** Cache TTL in seconds (default: 86400 = 24 hours) */
    ttl?: number;
    /** Hash function for cache keys */
    hashFn?: (text: string) => string;
  }
): EmbeddingProvider {
  const ttl = options?.ttl ?? 86400;
  const hashFn = options?.hashFn ?? defaultHash;

  return {
    name: `${provider.name}-cached`,
    modelName: provider.modelName,
    dimensions: provider.dimensions,

    async embedQuery(text: string): Promise<number[]> {
      const cacheKey = `embed:query:${hashFn(text)}:${provider.modelName}`;
      
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate embedding
      const embedding = await provider.embedQuery(text);
      
      // Cache result
      await cache.set(cacheKey, embedding, ttl);
      
      return embedding;
    },

    async embedDocuments(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      const missingIndices: number[] = [];
      const missingTexts: string[] = [];

      // Check cache for each text
      for (let i = 0; i < texts.length; i++) {
        const cacheKey = `embed:doc:${hashFn(texts[i] ?? '')}:${provider.modelName}`;
        const cached = await cache.get(cacheKey);
        
        if (cached) {
          results[i] = cached;
        } else {
          missingIndices.push(i);
          missingTexts.push(texts[i] ?? '');
        }
      }

      // Generate embeddings for missing texts
      if (missingTexts.length > 0) {
        const newEmbeddings = await provider.embedDocuments(missingTexts);

        // Store results and cache them
        for (let i = 0; i < missingIndices.length; i++) {
          const index = missingIndices[i] ?? 0;
          const embedding = newEmbeddings[i] ?? [];
          results[index] = embedding;

          const cacheKey = `embed:doc:${hashFn(texts[index] ?? '')}:${provider.modelName}`;
          await cache.set(cacheKey, embedding, ttl);
        }
      }

      return results;
    },

    healthCheck: provider.healthCheck?.bind(provider),
  };
}

/**
 * Simple hash function for cache keys
 */
function defaultHash(text: string): string {
  // Simple FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Validate OpenAI model name
 */
function isValidOpenAIModel(model: string): model is keyof typeof OPENAI_MODELS {
  return model in OPENAI_MODELS;
}

/**
 * Validate Ollama model name
 */
function isValidOllamaModel(model: string): model is keyof typeof OLLAMA_MODELS {
  return model in OLLAMA_MODELS;
}

/**
 * Get model dimensions
 */
export function getModelDimensions(
  provider: 'openai' | 'ollama',
  model: string
): number {
  if (provider === 'openai' && isValidOpenAIModel(model)) {
    return OPENAI_MODELS[model].dimensions;
  }
  if (provider === 'ollama' && isValidOllamaModel(model)) {
    return OLLAMA_MODELS[model].dimensions;
  }
  throw new Error(`Unknown model: ${provider}/${model}`);
}
