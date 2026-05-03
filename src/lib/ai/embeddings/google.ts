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
 *
 * Quota tracking:
 * - Free tier: 1,500 requests per day
 * - Tracks usage via Redis with daily TTL
 */

import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';
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

// Daily quota configuration
const DAILY_QUOTA_LIMIT = 1400;
const QUOTA_WARNING_THRESHOLD = Math.floor(DAILY_QUOTA_LIMIT * 0.93); // 93% of limit

/**
 * Custom error for quota exceeded
 */
export class EmbeddingQuotaExceededError extends Error {
  constructor(used: number, limit: number) {
    super(`Google Gemini embedding quota exceeded: ${used}/${limit} requests used today`);
    this.name = 'EmbeddingQuotaExceededError';
  }
}

/**
 * Get Redis key for daily quota tracking
 */
function getQuotaKey(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `gemini:embed:${today}`;
}

/**
 * Check and increment embedding quota
 * @returns Current usage count after increment
 * @throws EmbeddingQuotaExceededError if quota exceeded
 */
async function checkAndIncrementQuota(): Promise<number> {
  try {
    const key = getQuotaKey();

    // Increment the counter
    const count = await redis.incr(key);

    // Set TTL on first increment (86400 seconds = 1 day)
    if (count === 1) {
      await redis.expire(key, 86400);
    }

    // Check if we're approaching the limit
    if (count >= DAILY_QUOTA_LIMIT) {
      logger.warn('Gemini embedding quota exceeded', {
        used: count,
        limit: DAILY_QUOTA_LIMIT,
      });
      throw new EmbeddingQuotaExceededError(count, DAILY_QUOTA_LIMIT);
    }

    // Warn if approaching limit
    if (count >= QUOTA_WARNING_THRESHOLD) {
      logger.warn('Gemini embedding quota approaching', {
        used: count,
        limit: DAILY_QUOTA_LIMIT,
        remaining: DAILY_QUOTA_LIMIT - count,
      });
    }

    return count;
  } catch (error) {
    // If it's our quota error, re-throw it
    if (error instanceof EmbeddingQuotaExceededError) {
      throw error;
    }

    // If Redis is unavailable, log warning but don't block embeddings
    logger.warn('Redis quota tracking failed, proceeding without quota check', {
      error: error instanceof Error ? error.message : String(error),
    });

    return 0;
  }
}

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
    // Check quota before making request
    await checkAndIncrementQuota();

    const result = await embed({
      // biome-ignore lint/suspicious/noExplicitAny: AI SDK version compatibility
      model: google.textEmbeddingModel(this.modelName) as any,
      value: text,
    });

    return Array.from(result.embedding);
  }

  /**
   * Embed multiple documents in batches
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Check quota before making request (one batch = one request for quota purposes)
    await checkAndIncrementQuota();

    // Process in batches of 100 (Google's limit)
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const result = await embedMany({
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK version compatibility
        model: google.textEmbeddingModel(this.modelName) as any,
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
    } catch (error: unknown) {
      logger.debug('Google embedding health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
