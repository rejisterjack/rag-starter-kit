/**
 * OpenAI Embedding Provider
 *
 * Supports text-embedding-3-small (1536 dims, fast)
 * and text-embedding-3-large (3072 dims, best quality).
 * Includes batch processing, rate limiting, and retry logic.
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { RetryableError, withRetry } from '@/lib/utils/retry';
import {
  type BatchEmbeddingResult,
  type EmbeddingConfig,
  type EmbeddingProvider,
  OPENAI_MODELS,
  type OpenAIModel,
} from './types';

/**
 * OpenAI Embedding Provider Implementation
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private embeddings: OpenAIEmbeddings;
  private config: Required<EmbeddingConfig>;
  private lastRequestTime = 0;
  private minRequestInterval: number;

  constructor(config: EmbeddingConfig) {
    this.config = {
      batchSize: 100,
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: '',
      ...config,
    };

    // Validate model
    if (!this.isValidModel(this.config.model)) {
      throw new Error(
        `Invalid OpenAI model: ${this.config.model}. ` +
          `Supported models: ${Object.keys(OPENAI_MODELS).join(', ')}`
      );
    }

    // Calculate minimum interval between requests (requests per minute -> ms)
    // OpenAI's rate limit: 3000 RPM for text-embedding-3-small
    const requestsPerMinute = 3000;
    this.minRequestInterval = 60000 / requestsPerMinute;

    this.embeddings = new OpenAIEmbeddings({
      model: this.config.model,
      apiKey: this.config.apiKey,
      batchSize: this.config.batchSize,
      timeout: this.config.timeoutMs,
      configuration: this.config.baseUrl ? { baseURL: this.config.baseUrl } : undefined,
    });
  }

  get name(): string {
    return 'openai';
  }

  get modelName(): string {
    return this.config.model;
  }

  get dimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Validate if the model is a supported OpenAI model
   */
  private isValidModel(model: string): model is OpenAIModel {
    return model in OPENAI_MODELS;
  }

  /**
   * Rate limiter - ensures we don't exceed rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Embed a single query string with retry logic
   */
  async embedQuery(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    // Truncate if needed (OpenAI has token limits)
    const truncatedText = this.truncateText(
      text,
      OPENAI_MODELS[this.config.model as OpenAIModel].maxTokens
    );

    return withRetry(
      async () => {
        await this.throttle();

        try {
          const result = await this.embeddings.embedQuery(truncatedText);
          return result;
        } catch (error) {
          // Check if it's a rate limit error
          if (this.isRateLimitError(error)) {
            throw new RetryableError('Rate limit exceeded', true);
          }
          // Check if it's a retryable error
          if (this.isRetryableError(error)) {
            throw new RetryableError(
              error instanceof Error ? error.message : 'Unknown error',
              true
            );
          }
          throw error;
        }
      },
      {
        maxRetries: this.config.maxRetries,
        delayMs: this.config.retryDelayMs,
        backoffMultiplier: 2,
        maxDelayMs: 30000,
      }
    );
  }

  /**
   * Embed multiple documents in batches with retry logic
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Filter out empty texts and truncate
    const validTexts = texts
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .map((text) =>
        this.truncateText(text, OPENAI_MODELS[this.config.model as OpenAIModel].maxTokens)
      );

    if (validTexts.length === 0) {
      throw new Error('No valid texts to embed');
    }

    // Process in batches
    const results: number[][] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < validTexts.length; i += batchSize) {
      const batch = validTexts.slice(i, i + batchSize);

      const batchResult = await withRetry(
        async () => {
          await this.throttle();

          try {
            return await this.embeddings.embedDocuments(batch);
          } catch (error) {
            if (this.isRateLimitError(error)) {
              throw new RetryableError('Rate limit exceeded', true);
            }
            if (this.isRetryableError(error)) {
              throw new RetryableError(
                error instanceof Error ? error.message : 'Unknown error',
                true
              );
            }
            throw error;
          }
        },
        {
          maxRetries: this.config.maxRetries,
          delayMs: this.config.retryDelayMs,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
        }
      );

      results.push(...batchResult);
    }

    return results;
  }

  /**
   * Embed documents with partial failure handling
   * Returns successful embeddings and tracks failures
   */
  async embedDocumentsWithFallback(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings: number[][] = [];
    const failedIndices: number[] = [];
    const errors: string[] = [];

    // Process one by one to handle partial failures
    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.embedQuery(texts[i] ?? '');
        embeddings.push(embedding);
      } catch (error) {
        failedIndices.push(i);
        errors.push(error instanceof Error ? error.message : 'Unknown error');
        // Push zero vector as placeholder to maintain index alignment
        embeddings.push(new Array(this.dimensions).fill(0));
      }
    }

    return { embeddings, failedIndices, errors };
  }

  /**
   * Check if provider is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embedQuery('health check');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Truncate text to fit within token limit
   * Rough estimate: 1 token ≈ 4 characters for English text
   */
  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')
      );
    }
    return false;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('socket hang up') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504')
      );
    }
    return false;
  }
}

/**
 * Create OpenAI embedding provider with default config
 */
export function createOpenAIProvider(
  model: OpenAIModel = 'text-embedding-3-small',
  apiKey?: string
): OpenAIEmbeddingProvider {
  return new OpenAIEmbeddingProvider({
    provider: 'openai',
    model,
    dimensions: OPENAI_MODELS[model].dimensions,
    apiKey: apiKey ?? process.env.OPENAI_API_KEY,
  });
}
