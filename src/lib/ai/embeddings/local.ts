/**
 * Local Embedding Provider (Xenova/Transformers)
 *
 * Completely free embedding provider that runs locally using Transformers.js.
 * Uses ONNX models for efficient CPU inference - no GPU required.
 *
 * Models available:
 * - Xenova/all-MiniLM-L6-v2 (default): 384 dimensions, fast, good quality
 * - Xenova/all-MiniLM-L12-v2: 384 dimensions, slightly better quality
 * - Xenova/all-distilroberta-v1: 768 dimensions, higher quality
 * - Xenova/gte-base: 768 dimensions, excellent for semantic search
 */

import { logger } from '@/lib/logger';
import type { EmbeddingProvider } from './types';

/**
 * Dynamically load @xenova/transformers so the module still boots when the
 * optional dependency is not installed (e.g. unsupported platforms).
 */
type TransformersModule = typeof import('@xenova/transformers');

let transformersModule: TransformersModule | null = null;
let transformersLoadAttempted = false;

async function loadTransformers(): Promise<TransformersModule | null> {
  if (transformersLoadAttempted) return transformersModule;
  transformersLoadAttempted = true;
  try {
    transformersModule = await import('@xenova/transformers');
    return transformersModule;
  } catch {
    logger.warn(
      '@xenova/transformers could not be loaded. Local embedding provider will be unavailable. ' +
        'Install the optional dependency with: bun add @xenova/transformers'
    );
    return null;
  }
}

/**
 * Supported local embedding models
 */
export const LOCAL_MODELS = {
  'Xenova/all-MiniLM-L6-v2': {
    dimensions: 384,
    description: 'Fast, lightweight embeddings (default)',
    maxTokens: 512,
    quantized: true,
  },
  'Xenova/all-MiniLM-L12-v2': {
    dimensions: 384,
    description: 'Better quality, same dimensions',
    maxTokens: 512,
    quantized: true,
  },
  'Xenova/all-distilroberta-v1': {
    dimensions: 768,
    description: 'Higher quality, larger vectors',
    maxTokens: 512,
    quantized: true,
  },
  'Xenova/gte-base': {
    dimensions: 768,
    description: 'Optimized for semantic search',
    maxTokens: 512,
    quantized: true,
  },
} as const;

export type LocalModel = keyof typeof LOCAL_MODELS;

/**
 * Local Embedding Provider using Transformers.js
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly modelName: string;
  readonly dimensions: number;

  // Pipeline is dynamically loaded from @xenova/transformers; typed as unknown until initialized
  private pipeline: unknown = null;
  private readonly maxTokens: number;
  private readonly quantized: boolean;
  private initializing: Promise<void> | null = null;

  constructor(model: LocalModel = 'Xenova/all-MiniLM-L6-v2') {
    const modelInfo = LOCAL_MODELS[model];
    if (!modelInfo) {
      throw new Error(
        `Invalid local model: ${model}. ` + `Supported: ${Object.keys(LOCAL_MODELS).join(', ')}`
      );
    }

    this.modelName = model;
    this.dimensions = modelInfo.dimensions;
    this.maxTokens = modelInfo.maxTokens;
    this.quantized = modelInfo.quantized;
  }

  /**
   * Initialize the embedding pipeline (lazy loading)
   */
  private async initialize(): Promise<void> {
    if (this.pipeline) return;

    if (this.initializing) {
      await this.initializing;
      return;
    }

    this.initializing = this.doInitialize();
    await this.initializing;
  }

  private async doInitialize(): Promise<void> {
    const transformers = await loadTransformers();
    if (!transformers) {
      throw new Error(
        '@xenova/transformers is not installed. Local embeddings are unavailable. ' +
          'Install it with: bun add @xenova/transformers'
      );
    }
    try {
      this.pipeline = await transformers.pipeline('feature-extraction', this.modelName, {
        quantized: this.quantized,
        revision: 'main',
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize local embedding model ${this.modelName}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Embed a single query string
   */
  async embedQuery(text: string): Promise<number[]> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    // Truncate text if too long
    const truncatedText = this.truncateText(text);

    type PipelineFn = (
      text: string,
      opts: Record<string, unknown>
    ) => Promise<{ data: Float32Array }>;
    const pipe = this.pipeline as PipelineFn;
    const output = await pipe(truncatedText, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data as Float32Array);
  }

  /**
   * Embed multiple documents in batches
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    const embeddings: number[][] = [];

    // Process in small batches to avoid memory issues
    type PipelineFn = (
      text: string,
      opts: Record<string, unknown>
    ) => Promise<{ data: Float32Array }>;
    const pipe = this.pipeline as PipelineFn;
    const batchSize = 4;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (text) => {
          const truncatedText = this.truncateText(text);
          const output = await pipe(truncatedText, {
            pooling: 'mean',
            normalize: true,
          });
          if (!output) {
            throw new Error('Pipeline output is undefined');
          }
          return Array.from(output.data as Float32Array);
        })
      );
      embeddings.push(...batchResults);
    }

    return embeddings;
  }

  /**
   * Check if the provider is ready
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return this.pipeline !== null;
    } catch (error: unknown) {
      logger.debug('Local embedding provider health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Truncate text to max token limit (approximate)
   * Using ~4 characters per token as a rough estimate
   */
  private truncateText(text: string): string {
    const maxChars = this.maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }
}

/**
 * Create a local embedding provider
 */
export function createLocalProvider(
  model: LocalModel = 'Xenova/all-MiniLM-L6-v2'
): LocalEmbeddingProvider {
  return new LocalEmbeddingProvider(model);
}

/**
 * Validate local model name
 */
export function isValidLocalModel(model: string): model is LocalModel {
  return model in LOCAL_MODELS;
}

/**
 * Get model info
 */
export function getLocalModelInfo(model: LocalModel) {
  return LOCAL_MODELS[model];
}
