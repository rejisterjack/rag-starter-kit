/**
 * Google Gemini Embedding Provider
 *
 * Uses Google's Gemini API via Vercel AI SDK.
 * Free tier available through Google AI Studio.
 *
 * Models:
 * - text-embedding-004 (latest, 768 dimensions)
 * - embedding-001 (legacy, 768 dimensions)
 *
 * Get API key: https://aistudio.google.com/app/apikey
 */

import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import type { EmbeddingProvider } from './types';

/**
 * Supported Google embedding models
 */
export const GOOGLE_MODELS = {
  'text-embedding-004': {
    dimensions: 768,
    description: 'Latest Gemini embedding model',
    maxTokens: 2048,
  },
  'embedding-001': {
    dimensions: 768,
    description: 'Legacy embedding model',
    maxTokens: 2048,
  },
} as const;

export type GoogleModel = keyof typeof GOOGLE_MODELS;

/**
 * Google Gemini Embedding Provider
 */
export class GoogleEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'google';
  readonly modelName: string;
  readonly dimensions: number;

  constructor(model: GoogleModel = 'text-embedding-004', _apiKey?: string, _baseUrl?: string) {
    const modelInfo = GOOGLE_MODELS[model];
    if (!modelInfo) {
      throw new Error(
        `Invalid Google model: ${model}. ` + `Supported: ${Object.keys(GOOGLE_MODELS).join(', ')}`
      );
    }

    this.modelName = model;
    this.dimensions = modelInfo.dimensions;
  }

  /**
   * Embed a single query string
   */
  async embedQuery(text: string): Promise<number[]> {
    const result = await embed({
      model: google.textEmbeddingModel(this.modelName),
      value: text,
    });

    return Array.from(result.embedding);
  }

  /**
   * Embed multiple documents in batches
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Process in batches of 100 (Google's limit)
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const result = await embedMany({
        model: google.textEmbeddingModel(this.modelName),
        values: batch,
      });

      embeddings.push(...result.embeddings.map((e) => Array.from(e)));
    }

    return embeddings;
  }

  /**
   * Check if the provider is ready
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embedQuery('test');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a Google embedding provider
 */
export function createGoogleProvider(
  model: GoogleModel = 'text-embedding-004',
  apiKey?: string
): GoogleEmbeddingProvider {
  return new GoogleEmbeddingProvider(model, apiKey);
}

/**
 * Validate Google model name
 */
export function isValidGoogleModel(model: string): model is GoogleModel {
  return model in GOOGLE_MODELS;
}

/**
 * Get model info
 */
export function getGoogleModelInfo(model: GoogleModel) {
  return GOOGLE_MODELS[model];
}
