/**
 * Error Handling & Fallbacks
 * Resilient RAG chain with automatic fallback handling
 */

import type { LLMError, LLMMessage, LLMOptions, LLMProvider, LLMResponse } from '@/lib/ai/llm';
import { RAGChain, type RAGChainParams, type RAGResponse, type StreamEvent } from './chain';

// =============================================================================
// Types
// =============================================================================

export interface FallbackConfig {
  primaryModel: string;
  fallbackModels: string[];
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

export interface ResilientRAGResponse extends RAGResponse {
  modelUsed: string;
  attempts: number;
  fallbackUsed: boolean;
}

export interface ErrorContext {
  operation: string;
  params: unknown;
  attempt: number;
  timestamp: Date;
}

export type ErrorHandler = (error: LLMError, context: ErrorContext) => Promise<boolean>; // Return true to retry

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  primaryModel: 'gpt-4o-mini',
  fallbackModels: ['gpt-4o', 'gpt-3.5-turbo'],
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
};

// =============================================================================
// Resilient RAG Chain
// =============================================================================

export class ResilientRAGChain extends RAGChain {
  private fallbackConfig: FallbackConfig;
  private errorHandlers: ErrorHandler[] = [];

  constructor(llmProvider: LLMProvider, fallbackConfig?: Partial<FallbackConfig>) {
    super(llmProvider);
    this.fallbackConfig = { ...DEFAULT_FALLBACK_CONFIG, ...fallbackConfig };
  }

  /**
   * Generate with automatic fallback to alternative models
   */
  async generateWithFallback(params: RAGChainParams): Promise<ResilientRAGResponse> {
    const modelsToTry = [this.fallbackConfig.primaryModel, ...this.fallbackConfig.fallbackModels];

    let lastError: Error | undefined;
    let attempts = 0;

    for (const model of modelsToTry) {
      attempts++;

      try {
        const response = await this.invoke({
          ...params,
          config: {
            ...params.config,
            model,
          },
        });

        return {
          ...response,
          modelUsed: model,
          attempts,
          fallbackUsed: model !== this.fallbackConfig.primaryModel,
        };
      } catch (error) {
        console.warn(`Model ${model} failed:`, error);
        lastError = error as Error;

        // Check if this is a retryable error
        if (!this.isRetryableError(error)) {
          break;
        }

        // Try error handlers
        const shouldRetry = await this.handleError(error as LLMError, {
          operation: 'generateWithFallback',
          params,
          attempt: attempts,
          timestamp: new Date(),
        });

        if (!shouldRetry) {
          break;
        }

        // Add delay before retry
        if (attempts < modelsToTry.length) {
          await this.delay(this.calculateDelay(attempts));
        }
      }
    }

    throw new ResilientRAGError(
      `All models exhausted after ${attempts} attempts. Last error: ${lastError?.message}`,
      'ALL_MODELS_FAILED',
      { attempts, lastError }
    );
  }

  /**
   * Stream with automatic fallback
   */
  async *streamWithFallback(params: RAGChainParams): AsyncGenerator<StreamEvent> {
    const modelsToTry = [this.fallbackConfig.primaryModel, ...this.fallbackConfig.fallbackModels];

    let attempts = 0;

    for (const model of modelsToTry) {
      attempts++;

      try {
        yield {
          type: 'generating',
          data: { model, attempt: attempts },
        };

        const stream = this.stream({
          ...params,
          config: {
            ...params.config,
            model,
          },
        });

        for await (const event of stream) {
          // Add model info to events
          if (event.type === 'done') {
            yield {
              ...event,
              data: {
                ...(event.data as Record<string, unknown>),
                modelUsed: model,
                attempts,
                fallbackUsed: model !== this.fallbackConfig.primaryModel,
              },
            };
          } else {
            yield event;
          }
        }

        return;
      } catch (error) {
        console.warn(`Stream with model ${model} failed:`, error);

        if (!this.isRetryableError(error) || attempts >= modelsToTry.length) {
          yield {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              code: 'STREAM_FAILED',
              attempts,
            },
          };
          throw error;
        }

        yield {
          type: 'generating',
          data: {
            model,
            attempt: attempts,
            retrying: true,
            nextModel: modelsToTry[attempts],
          },
        };

        await this.delay(this.calculateDelay(attempts));
      }
    }
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Update fallback configuration
   */
  updateFallbackConfig(config: Partial<FallbackConfig>): void {
    this.fallbackConfig = { ...this.fallbackConfig, ...config };
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Check for rate limit or model unavailable errors by message patterns
      if (
        message.includes('rate limit') ||
        message.includes('rate_limit') ||
        message.includes('model unavailable') ||
        message.includes('model_unavailable')
      ) {
        return true;
      }
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('429')
      );
    }
    return false;
  }

  private async handleError(error: LLMError, context: ErrorContext): Promise<boolean> {
    for (const handler of this.errorHandlers) {
      try {
        const shouldRetry = await handler(error, context);
        if (!shouldRetry) {
          return false;
        }
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }
    return true;
  }

  private calculateDelay(attempt: number): number {
    const baseDelay = this.fallbackConfig.retryDelayMs;

    if (this.fallbackConfig.exponentialBackoff) {
      return baseDelay * 2 ** (attempt - 1);
    }

    return baseDelay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Resilient RAG Error
// =============================================================================

export class ResilientRAGError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: {
      attempts: number;
      lastError?: Error;
    }
  ) {
    super(message);
    this.name = 'ResilientRAGError';
  }
}

// =============================================================================
// Retry Wrapper
// =============================================================================

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelayMs = 1000, shouldRetry = () => true, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      const delay = retryDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// =============================================================================
// Fallback Provider Wrapper
// =============================================================================

/**
 * Wrap an LLM provider with automatic fallback
 */
export class FallbackLLMProvider implements LLMProvider {
  private currentProviderIndex = 0;

  constructor(
    private providers: LLMProvider[],
    config?: { maxRetriesPerProvider?: number; switchOnError?: boolean }
  ) {
    if (providers.length === 0) {
      throw new Error('At least one provider is required');
    }
    // Store config to be used in future enhancements
    void config;
  }

  async generate(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    return this.executeWithFallback((provider) => provider.generate(messages, options));
  }

  async stream(
    messages: LLMMessage[],
    options?: LLMOptions
  ): Promise<{
    content: AsyncIterable<string>;
    usage: Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }>;
    model: string;
  }> {
    return this.executeWithFallback((provider) => provider.stream(messages, options));
  }

  private async executeWithFallback<T>(
    operation: (provider: LLMProvider) => Promise<T>
  ): Promise<T> {
    const errors: Error[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];

      try {
        const result = await operation(provider);
        this.currentProviderIndex = providerIndex;
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        console.warn(`Provider ${providerIndex} failed:`, err.message);
      }
    }

    throw new ResilientRAGError(
      `All providers failed: ${errors.map((e) => e.message).join('; ')}`,
      'ALL_PROVIDERS_FAILED',
      { attempts: errors.length }
    );
  }
}

// =============================================================================
// Circuit Breaker
// =============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  open: boolean;
}

export class CircuitBreaker {
  private state: Map<string, CircuitBreakerState> = new Map();
  private _config: { failureThreshold: number; resetTimeoutMs: number };

  constructor(config?: { failureThreshold?: number; resetTimeoutMs?: number }) {
    this._config = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.isOpen(key)) {
      throw new Error(`Circuit breaker is open for ${key}`);
    }

    try {
      const result = await fn();
      this.recordSuccess(key);
      return result;
    } catch (error) {
      this.recordFailure(key);
      throw error;
    }
  }

  private isOpen(key: string): boolean {
    const state = this.state.get(key);

    if (!state) return false;
    if (!state.open) return false;

    // Check if enough time has passed to try again
    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    if (timeSinceLastFailure > this._config.resetTimeoutMs) {
      state.open = false;
      state.failures = 0;
      return false;
    }

    return true;
  }

  private recordFailure(key: string): void {
    const state = this.state.get(key) ?? {
      failures: 0,
      lastFailureTime: 0,
      open: false,
    };

    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this._config.failureThreshold) {
      state.open = true;
      console.warn(`Circuit breaker opened for ${key}`);
    }

    this.state.set(key, state);
  }

  private recordSuccess(key: string): void {
    const state = this.state.get(key);
    if (state) {
      state.failures = 0;
      state.open = false;
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a resilient RAG chain with fallback configuration
 */
export function createResilientRAGChain(
  llmProvider: LLMProvider,
  fallbackConfig?: Partial<FallbackConfig>
): ResilientRAGChain {
  return new ResilientRAGChain(llmProvider, fallbackConfig);
}

/**
 * Create a fallback provider that cycles through multiple providers
 */
export function createFallbackProvider(
  providers: LLMProvider[],
  config?: { maxRetriesPerProvider?: number; switchOnError?: boolean }
): FallbackLLMProvider {
  return new FallbackLLMProvider(providers, config);
}

/**
 * Create a circuit breaker for protecting LLM calls
 */
export function createCircuitBreaker(config?: {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}): CircuitBreaker {
  return new CircuitBreaker(config);
}
