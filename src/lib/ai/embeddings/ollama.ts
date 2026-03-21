/**
 * Ollama Embedding Provider
 *
 * Support for local self-hosted embeddings using Ollama.
 * Models: nomic-embed-text, mxbai-embed-large
 * Good for cost-sensitive deployments and privacy.
 */

import { RetryableError, withRetry } from '@/lib/utils/retry';
import {
  type BatchEmbeddingResult,
  type EmbeddingConfig,
  type EmbeddingProvider,
  OLLAMA_MODELS,
  type OllamaModel,
} from './types';

/**
 * Ollama Embedding Provider Implementation
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private config: Required<EmbeddingConfig>;
  private baseUrl: string;
  private lastRequestTime = 0;
  private minRequestInterval: number;

  constructor(config: EmbeddingConfig) {
    this.config = {
      batchSize: 25, // Ollama typically handles smaller batches
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 60000, // Longer timeout for local inference
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      ...config,
    };

    // Validate model
    if (!this.isValidModel(this.config.model)) {
      throw new Error(
        `Invalid Ollama model: ${this.config.model}. ` +
          `Supported models: ${Object.keys(OLLAMA_MODELS).join(', ')}`
      );
    }

    this.baseUrl = this.config.baseUrl ?? 'http://localhost:11434';

    // Rate limiting for local inference (conservative)
    const requestsPerMinute = 60;
    this.minRequestInterval = 60000 / requestsPerMinute;
  }

  get name(): string {
    return 'ollama';
  }

  get modelName(): string {
    return this.config.model;
  }

  get dimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Validate if the model is a supported Ollama model
   */
  private isValidModel(model: string): model is OllamaModel {
    return model in OLLAMA_MODELS;
  }

  /**
   * Rate limiter - prevents overwhelming local Ollama instance
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
   * Make request to Ollama API
   */
  private async makeRequest(endpoint: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Embed a single query string
   */
  async embedQuery(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    // Truncate if needed
    const truncatedText = this.truncateText(
      text,
      OLLAMA_MODELS[this.config.model as OllamaModel].maxTokens
    );

    return withRetry(
      async () => {
        await this.throttle();

        try {
          const response = await this.makeRequest('/api/embeddings', {
            model: this.config.model,
            prompt: truncatedText,
          });

          if (!response.ok) {
            const errorText = await response.text();

            // Check for specific errors
            if (response.status === 404) {
              throw new Error(
                `Model "${this.config.model}" not found. ` + `Run: ollama pull ${this.config.model}`
              );
            }

            if (response.status === 503 || response.status === 504) {
              throw new RetryableError('Ollama is busy, retrying...', true);
            }

            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
          }

          const data = (await response.json()) as { embedding: number[] };

          if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid response from Ollama: missing embedding');
          }

          return data.embedding;
        } catch (error) {
          if (error instanceof RetryableError) {
            throw error;
          }
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              throw new RetryableError('Request timeout', true);
            }
            if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
              throw new RetryableError('Ollama connection failed, is it running?', true);
            }
            if (this.isRetryableError(error)) {
              throw new RetryableError(error.message, true);
            }
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
   * Embed multiple documents in batches
   * Note: Ollama doesn't support batch embedding natively, so we process sequentially
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Filter out empty texts
    const validTexts = texts
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .map((text) =>
        this.truncateText(text, OLLAMA_MODELS[this.config.model as OllamaModel].maxTokens)
      );

    if (validTexts.length === 0) {
      throw new Error('No valid texts to embed');
    }

    // Ollama processes one at a time
    const results: number[][] = [];

    for (const text of validTexts) {
      const embedding = await this.embedQuery(text);
      results.push(embedding);
    }

    return results;
  }

  /**
   * Embed documents with partial failure handling
   */
  async embedDocumentsWithFallback(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings: number[][] = [];
    const failedIndices: number[] = [];
    const errors: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.embedQuery(texts[i] ?? '');
        embeddings.push(embedding);
      } catch (error) {
        failedIndices.push(i);
        errors.push(error instanceof Error ? error.message : 'Unknown error');
        embeddings.push(new Array(this.dimensions).fill(0));
      }
    }

    return { embeddings, failedIndices, errors };
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models ?? [];

      // Check if our model is available
      return models.some((m) => m.name.includes(this.config.model));
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models from Ollama
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? []).map((m) => m.name);
    } catch (error) {
      throw new Error(
        `Failed to list Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Pull a model from Ollama
   */
  async pullModel(modelName?: string): Promise<void> {
    const model = modelName ?? this.config.model;

    try {
      const response = await this.makeRequest('/api/pull', {
        name: model,
        stream: false,
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to pull model "${model}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('busy') ||
      message.includes('temporarily unavailable')
    );
  }
}

/**
 * Create Ollama embedding provider with default config
 */
export function createOllamaProvider(
  model: OllamaModel = 'nomic-embed-text',
  baseUrl?: string
): OllamaEmbeddingProvider {
  return new OllamaEmbeddingProvider({
    provider: 'ollama',
    model,
    dimensions: OLLAMA_MODELS[model].dimensions,
    baseUrl: baseUrl ?? process.env.OLLAMA_BASE_URL,
  });
}
