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

import { type FeatureExtractionPipeline, pipeline } from '@xenova/transformers';
import type { EmbeddingProvider } from './types';

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

  private pipeline: FeatureExtractionPipeline | null = null;
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
    try {
      this.pipeline = await pipeline('feature-extraction', this.modelName, {
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

    const output = await this.pipeline(truncatedText, {
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
    const batchSize = 4;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (text) => {
          const truncatedText = this.truncateText(text);
          const output = await this.pipeline?.(truncatedText, {
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
    } catch {
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
