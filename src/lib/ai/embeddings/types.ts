/**
 * Embedding Provider Types
 * 
 * Common interfaces for all embedding providers.
 */

/**
 * Configuration for embedding providers
 */
export interface EmbeddingConfig {
  /** Provider type: 'google' | 'openai' | 'ollama' */
  provider: 'google' | 'openai' | 'ollama';
  /** Model name */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Batch size for document embedding (default: 100) */
  batchSize?: number;
  /** Maximum retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms (default: 1000) */
  retryDelayMs?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** API key (for OpenAI, Google) */
  apiKey?: string;
  /** Base URL (for Ollama or custom endpoints) */
  baseUrl?: string;
}

/**
 * Embedding Provider Interface
 * 
 * All embedding providers must implement this interface.
 */
export interface EmbeddingProvider {
  /** Provider name */
  readonly name: string;
  /** Model name */
  readonly modelName: string;
  /** Embedding dimensions */
  readonly dimensions: number;
  
  /**
   * Embed a single query string
   * @param text - The text to embed
   * @returns Promise resolving to the embedding vector
   */
  embedQuery(text: string): Promise<number[]>;
  
  /**
   * Embed multiple documents in batches
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding vectors
   */
  embedDocuments(texts: string[]): Promise<number[][]>;
  
  /**
   * Get provider health status
   * @returns Promise resolving to boolean indicating if provider is available
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * Batch embedding result with error handling
 */
export interface BatchEmbeddingResult {
  /** Successful embeddings */
  embeddings: number[][];
  /** Indices of texts that failed to embed */
  failedIndices: number[];
  /** Error messages for failed embeddings */
  errors: string[];
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum tokens per minute */
  tokensPerMinute?: number;
  /** Burst capacity */
  burstCapacity?: number;
}

/**
 * Embedding cache entry
 */
export interface CachedEmbedding {
  /** The embedding vector */
  embedding: number[];
  /** Model used to generate embedding */
  model: string;
  /** Timestamp when embedding was cached */
  cachedAt: Date;
  /** Content hash for cache invalidation */
  contentHash: string;
}

/**
 * Supported OpenAI embedding models
 */
export const OPENAI_MODELS = {
  'text-embedding-3-small': {
    dimensions: 1536,
    description: 'Fast, cost-effective embeddings',
    maxTokens: 8191,
  },
  'text-embedding-3-large': {
    dimensions: 3072,
    description: 'Best quality embeddings',
    maxTokens: 8191,
  },
  'text-embedding-ada-002': {
    dimensions: 1536,
    description: 'Legacy model, use v3 models instead',
    maxTokens: 8191,
  },
} as const;

/**
 * Supported Ollama embedding models
 */
export const OLLAMA_MODELS = {
  'nomic-embed-text': {
    dimensions: 768,
    description: 'High-quality open embeddings',
    maxTokens: 2048,
  },
  'mxbai-embed-large': {
    dimensions: 1024,
    description: 'Large open embeddings with excellent performance',
    maxTokens: 512,
  },
  'all-minilm': {
    dimensions: 384,
    description: 'Fast, lightweight embeddings',
    maxTokens: 512,
  },
} as const;

/**
 * Supported local embedding models (Xenova/Transformers)
 */
export const LOCAL_MODELS = {
  'Xenova/all-MiniLM-L6-v2': {
    dimensions: 384,
    description: 'Fast, lightweight embeddings (default)',
    maxTokens: 512,
  },
  'Xenova/all-MiniLM-L12-v2': {
    dimensions: 384,
    description: 'Better quality, same dimensions',
    maxTokens: 512,
  },
  'Xenova/all-distilroberta-v1': {
    dimensions: 768,
    description: 'Higher quality, larger vectors',
    maxTokens: 512,
  },
  'Xenova/gte-base': {
    dimensions: 768,
    description: 'Optimized for semantic search',
    maxTokens: 512,
  },
} as const;

export type OpenAIModel = keyof typeof OPENAI_MODELS;
export type OllamaModel = keyof typeof OLLAMA_MODELS;
export type LocalModel = keyof typeof LOCAL_MODELS;
