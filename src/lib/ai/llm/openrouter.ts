/**
 * OpenRouter LLM Provider
 * Implementation of the LLMProvider interface using OpenRouter API via Vercel AI SDK
 * Supports free models from various providers (Mistral, Meta, Google, etc.)
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText } from 'ai';
import {
  LLMError,
  type LLMMessage,
  type LLMOptions,
  type LLMProvider,
  type LLMResponse,
  ModelUnavailableError,
  type OpenRouterConfig,
  RateLimitError,
  type StreamingLLMResponse,
} from './types';

/**
 * Free OpenRouter models - these cost $0
 * All available at: https://openrouter.ai/models?max_price=0
 */
export const OPENROUTER_FREE_MODELS = {
  // Mistral - Good balance of quality and speed
  MISTRAL_7B: 'mistralai/mistral-7b-instruct:free',

  // Google - Strong performance
  GEMMA_2_9B: 'google/gemma-2-9b-it:free',

  // Meta - Open source, good quality
  LLAMA_3_1_8B: 'meta-llama/llama-3.1-8b-instruct:free',
  LLAMA_3_2_1B: 'meta-llama/llama-3.2-1b-instruct:free',
  LLAMA_3_2_3B: 'meta-llama/llama-3.2-3b-instruct:free',

  // DeepSeek - Strong reasoning
  DEEPSEEK_CHAT: 'meta-llama/llama-3.3-70b-instruct:free',

  // Nous Research - Very capable but slower
  HERMES_405B: 'nousresearch/hermes-3-llama-3.1-405b:free',

  // Microsoft - Solid performance
  PHI_3_MINI: 'microsoft/phi-3-mini:free',
  PHI_3_MEDIUM: 'microsoft/phi-3-medium:free',

  // Qwen - Alibaba's model
  QWEN_2_5_7B: 'qwen/qwen-2.5-7b-instruct:free',
} as const;

// Default fallback models (prioritize speed and availability)
const DEFAULT_FALLBACK_MODELS = [
  OPENROUTER_FREE_MODELS.MISTRAL_7B,
  OPENROUTER_FREE_MODELS.LLAMA_3_1_8B,
  OPENROUTER_FREE_MODELS.GEMMA_2_9B,
];

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private fallbackModels: string[];
  private referer?: string;
  private title?: string;
  private provider: ReturnType<typeof createOpenRouter>;

  constructor(config: OpenRouterConfig = { provider: 'openrouter' }) {
    this.apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    this.defaultModel =
      config.defaultModel ?? process.env.DEFAULT_MODEL ?? OPENROUTER_FREE_MODELS.MISTRAL_7B;
    this.fallbackModels = DEFAULT_FALLBACK_MODELS.filter((m) => m !== this.defaultModel);
    this.referer = config.referer ?? process.env.OPENROUTER_REFERER;
    this.title = config.title ?? process.env.OPENROUTER_TITLE;

    if (!this.apiKey) {
      throw new LLMError(
        'OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable or pass it in config. Get one at https://openrouter.ai/keys',
        'CONFIG_ERROR',
        false
      );
    }

    // Create provider with custom headers
    const headers: Record<string, string> = {};
    if (this.referer) headers['HTTP-Referer'] = this.referer;
    if (this.title) headers['X-Title'] = this.title;

    this.provider = createOpenRouter({
      apiKey: this.apiKey,
      ...(Object.keys(headers).length > 0 && { headers }),
    });
  }

  async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const modelName = options.model ?? this.defaultModel;

    try {
      const result = await generateText({
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK version compatibility
        model: this.createModel(modelName) as any,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
      });

      return {
        content: result.text,
        usage: {
          promptTokens: (result.usage as { promptTokens?: number })?.promptTokens ?? 0,
          completionTokens: (result.usage as { completionTokens?: number })?.completionTokens ?? 0,
          totalTokens: (result.usage as { totalTokens?: number })?.totalTokens ?? 0,
        },
        model: modelName,
        finishReason: result.finishReason ?? 'unknown',
      };
    } catch (error) {
      throw this.handleError(error, modelName);
    }
  }

  async stream(messages: LLMMessage[], options: LLMOptions = {}): Promise<StreamingLLMResponse> {
    const modelName = options.model ?? this.defaultModel;

    try {
      const result = streamText({
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK version compatibility
        model: this.createModel(modelName) as any,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
      });

      // Create a promise that resolves with usage when streaming completes
      const usagePromise = result.usage.then(
        (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => ({
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
        })
      ) as Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }>;

      return {
        content: result.textStream,
        usage: usagePromise,
        model: modelName,
      };
    } catch (error) {
      throw this.handleError(error, modelName);
    }
  }

  /**
   * Generate with automatic fallback to alternative models on rate limit
   */
  async generateWithFallback(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const primaryModel = options.model ?? this.defaultModel;
    const modelsToTry = [primaryModel, ...this.fallbackModels.filter((m) => m !== primaryModel)];

    let lastError: Error | undefined;

    for (const model of modelsToTry) {
      try {
        const result = await this.generate(messages, { ...options, model });
        // Track which model was actually used
        return {
          ...result,
          model,
        };
      } catch (error) {
        if (error instanceof RateLimitError) {
          // Rate limit hit - trying fallback
          lastError = error;
          continue;
        }
        if (error instanceof ModelUnavailableError) {
          // Model unavailable - trying fallback
          lastError = error;
          continue;
        }
        // For non-retryable errors, throw immediately
        throw error;
      }
    }

    throw new LLMError(
      `All models exhausted. Last error: ${lastError?.message}`,
      'ALL_MODELS_FAILED',
      false,
      lastError
    );
  }

  /**
   * Stream with automatic fallback to alternative models on rate limit
   */
  async streamWithFallback(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): Promise<StreamingLLMResponse> {
    const primaryModel = options.model ?? this.defaultModel;
    const modelsToTry = [primaryModel, ...this.fallbackModels.filter((m) => m !== primaryModel)];

    let lastError: Error | undefined;

    for (const model of modelsToTry) {
      try {
        const result = await this.stream(messages, { ...options, model });
        return {
          ...result,
          model,
        };
      } catch (error) {
        if (error instanceof RateLimitError || error instanceof ModelUnavailableError) {
          // Model failed - trying fallback
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
        throw error;
      }
    }

    throw new LLMError(
      `All models exhausted. Last error: ${lastError?.message}`,
      'ALL_MODELS_FAILED',
      false,
      lastError
    );
  }

  private createModel(modelName: string) {
    // Ensure the model name uses the :free suffix for free models
    const finalModelName = modelName.includes(':') ? modelName : `${modelName}:free`;

    // Use chat() method which returns a proper LanguageModel
    return this.provider.chat(finalModelName);
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof LLMError) {
      return error;
    }

    const err = error as { statusCode?: number; message?: string; code?: string; status?: number };
    const message = err.message ?? 'Unknown error';
    const statusCode = err.statusCode ?? err.status;

    // Handle rate limiting (429)
    if (statusCode === 429 || message.toLowerCase().includes('rate limit')) {
      // Try to extract retry-after from error
      const retryMatch = message.match(/retry after (\d+)/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : undefined;

      return new RateLimitError(
        `Rate limit exceeded for model ${model}. OpenRouter free models have rate limits.`,
        retryAfter,
        error
      );
    }

    // Handle model unavailability (503)
    if (statusCode === 503 || message.toLowerCase().includes('unavailable')) {
      return new ModelUnavailableError(`Model ${model} is currently unavailable`, error);
    }

    // Handle context length exceeded
    if (
      message.toLowerCase().includes('context length') ||
      message.toLowerCase().includes('too many tokens')
    ) {
      return new LLMError(
        `Context length exceeded for model ${model}`,
        'CONTEXT_LENGTH_EXCEEDED',
        false,
        error
      );
    }

    // Handle authentication errors
    if (
      statusCode === 401 ||
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('invalid api key')
    ) {
      return new LLMError(
        'OpenRouter API key is invalid. Please check your OPENROUTER_API_KEY.',
        'AUTH_ERROR',
        false,
        error
      );
    }

    // Generic API error
    return new LLMError(
      `OpenRouter API error: ${message}`,
      err.code ?? 'API_ERROR',
      statusCode === 500 || statusCode === 502 || statusCode === 503,
      error
    );
  }
}
