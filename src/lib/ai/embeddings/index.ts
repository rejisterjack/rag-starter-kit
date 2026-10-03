/**
 * Embedding Provider Factory
 *
 * Central export point for all embedding providers.
 * Provides factory function to create appropriate provider based on config.
 *
 * DEFAULT: Google Gemini (free tier via AI Studio)
 * - text-embedding-004: 768 dimensions, high quality
 * - Get API key: https://aistudio.google.com/app/apikey
 */

import { logger } from '@/lib/logger';
import { createGoogleProvider, GOOGLE_MODELS, GoogleEmbeddingProvider } from './google';
import { createOllamaProvider, OllamaEmbeddingProvider } from './ollama';
import { createOpenAIProvider, OpenAIEmbeddingProvider } from './openai';
import {
  type EmbeddingConfig,
  type EmbeddingProvider,
  OLLAMA_MODELS,
  OPENAI_MODELS,
} from './types';

export { createGoogleProvider, GOOGLE_MODELS, GoogleEmbeddingProvider } from './google';
export {
  clearImageEmbeddingCache,
  cosineSimilarity as imageCosineSimilarity,
  generateImageEmbedding,
  generateImageEmbeddings,
  generateTextEmbeddingForImageSearch,
  getImageEmbeddingDimensions,
  healthCheck as imageEmbeddingHealthCheck,
} from './image';
export { createOllamaProvider, OllamaEmbeddingProvider } from './ollama';
export { createOpenAIProvider, OpenAIEmbeddingProvider } from './openai';
// Re-export all types and providers
export * from './types';

/**
 * Provider factory configuration with environment fallbacks
 */
export interface ProviderFactoryConfig {
  /** Provider type - falls back to EMBEDDING_PROVIDER env var, then 'google' */
  provider?: 'google' | 'openai' | 'ollama';
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
export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  switch (config.provider) {
    case 'google':
      return new GoogleEmbeddingProvider(config.model as keyof typeof GOOGLE_MODELS, config.apiKey);
    case 'openai':
      return new OpenAIEmbeddingProvider(config);
    case 'ollama':
      return new OllamaEmbeddingProvider(config);
    default:
      throw new Error(
        `Unknown provider: ${config.provider}. Supported providers: google, openai, ollama`
      );
  }
}

let cachedDefaultProvider: EmbeddingProvider | null = null;

/**
 * Create embedding provider from environment variables
 *
 * When called without overrides, returns a cached singleton to avoid
 * re-creating the provider on every call.
 *
 * Environment variables:
 * - EMBEDDING_PROVIDER: 'google', 'openai', or 'ollama' (default: 'google')
 * - EMBEDDING_MODEL: Model name (default: text-embedding-004 for Google)
 * - OPENAI_API_KEY: OpenAI API key (if using OpenAI)
 * - OLLAMA_BASE_URL: Ollama base URL (if using Ollama)
 */
export function createEmbeddingProviderFromEnv(
  overrides?: ProviderFactoryConfig
): EmbeddingProvider {
  if (!overrides && cachedDefaultProvider) return cachedDefaultProvider;

  const provider =
    overrides?.provider ??
    (process.env.EMBEDDING_PROVIDER as 'google' | 'openai' | 'ollama') ??
    'google';

  let result: EmbeddingProvider;

  switch (provider) {
    case 'google': {
      const model = overrides?.model ?? process.env.EMBEDDING_MODEL ?? 'gemini-embedding-2';

      if (!isValidGoogleModel(model)) {
        throw new Error(
          `Invalid Google model: ${model}. ` + `Supported: ${Object.keys(GOOGLE_MODELS).join(', ')}`
        );
      }

      const apiKey = overrides?.apiKey;

      result = createGoogleProvider(model, apiKey);
      break;
    }

    case 'ollama': {
      const model = overrides?.model ?? process.env.EMBEDDING_MODEL ?? 'nomic-embed-text';

      if (!isValidOllamaModel(model)) {
        throw new Error(
          `Invalid Ollama model: ${model}. ` + `Supported: ${Object.keys(OLLAMA_MODELS).join(', ')}`
        );
      }

      result = createOllamaProvider(model, overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL);
      break;
    }

    case 'openai': {
      const model = overrides?.model ?? process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';

      if (!isValidOpenAIModel(model)) {
        throw new Error(
          `Invalid OpenAI model: ${model}. ` + `Supported: ${Object.keys(OPENAI_MODELS).join(', ')}`
        );
      }

      result = createOpenAIProvider(model, overrides?.apiKey ?? process.env.OPENAI_API_KEY);
      break;
    }

    default:
      throw new Error(`Unknown provider: ${provider}. Supported: google, openai, ollama`);
  }

  if (!overrides) cachedDefaultProvider = result;
  return result;
}

/**
 * Get default provider (Google Gemini - free via AI Studio)
 */
export function getDefaultProvider(): EmbeddingProvider {
  return createGoogleProvider('gemini-embedding-2');
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
  } catch (error: unknown) {
    logger.error('Primary embedding provider failed, using fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
 * Validate Google model name
 */
function isValidGoogleModel(model: string): model is keyof typeof GOOGLE_MODELS {
  return model in GOOGLE_MODELS;
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
  provider: 'google' | 'openai' | 'ollama',
  model: string
): number {
  if (provider === 'google' && isValidGoogleModel(model)) {
    return GOOGLE_MODELS[model].dimensions;
  }
  if (provider === 'openai' && isValidOpenAIModel(model)) {
    return OPENAI_MODELS[model].dimensions;
  }
  if (provider === 'ollama' && isValidOllamaModel(model)) {
    return OLLAMA_MODELS[model].dimensions;
  }
  throw new Error(`Unknown model: ${provider}/${model}`);
}

/**
 * Dimension mapping for each provider/model combination.
 * Used at startup to validate that the configured embedding model's output
 * matches the vector column dimension in the Prisma schema.
 */
const SCHEMA_VECTOR_DIMENSION = 768; // Must match `vector(768)` in prisma/schema.prisma

const PROVIDER_MODEL_DIMENSIONS: Record<string, Record<string, number>> = {
  google: Object.fromEntries(Object.entries(GOOGLE_MODELS).map(([k, v]) => [k, v.dimensions])),
  openai: Object.fromEntries(Object.entries(OPENAI_MODELS).map(([k, v]) => [k, v.dimensions])),
  ollama: Object.fromEntries(Object.entries(OLLAMA_MODELS).map(([k, v]) => [k, v.dimensions])),
};

/**
 * Validate that the configured embedding model's output dimensions match
 * the pgvector column size.
 *
 * Call this at application startup (e.g. in instrumentation.ts or a layout effect).
 * Returns a warning string if there is a mismatch, or null if dimensions are compatible.
 */
export function validateEmbeddingDimensions(
  provider?: 'google' | 'openai' | 'ollama',
  model?: string
): { valid: boolean; message: string | null } {
  const effectiveProvider = provider ?? process.env.EMBEDDING_PROVIDER ?? 'google';
  const effectiveModel = model ?? process.env.EMBEDDING_MODEL;

  const defaults: Record<string, string> = {
    google: 'gemini-embedding-2',
    openai: 'text-embedding-3-small',
    ollama: 'nomic-embed-text',
  };
  const resolvedModel = effectiveModel ?? defaults[effectiveProvider] ?? 'text-embedding-004';

  const providerDims = PROVIDER_MODEL_DIMENSIONS[effectiveProvider];
  if (!providerDims) {
    return {
      valid: false,
      message: `Unknown embedding provider: "${effectiveProvider}". Supported: google, openai, ollama.`,
    };
  }

  const modelDims = providerDims[resolvedModel];
  if (modelDims === undefined) {
    // Unknown model — warn but don't block (could be a custom Ollama model)
    return {
      valid: true,
      message:
        `Unknown model "${resolvedModel}" for provider "${effectiveProvider}". ` +
        `Cannot validate dimensions. Ensure its output matches pgvector (${SCHEMA_VECTOR_DIMENSION}D).`,
    };
  }

  if (modelDims !== SCHEMA_VECTOR_DIMENSION) {
    return {
      valid: false,
      message:
        `Embedding dimension mismatch: "${effectiveProvider}/${resolvedModel}" produces ` +
        `${modelDims}D vectors, but the database schema uses vector(${SCHEMA_VECTOR_DIMENSION}). ` +
        `To fix this:\n` +
        `  1. Change EMBEDDING_PROVIDER/MODEL to a ${SCHEMA_VECTOR_DIMENSION}D model (e.g. google/text-embedding-004 or ollama/nomic-embed-text), OR\n` +
        `  2. Run a migration: ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(${modelDims});\n` +
        `  3. Update SCHEMA_VECTOR_DIMENSION in src/lib/ai/embeddings/index.ts to ${modelDims}.`,
    };
  }

  return { valid: true, message: null };
}
