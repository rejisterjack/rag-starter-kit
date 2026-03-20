/**
 * OpenAI LLM Provider
 * Implementation of the LLMProvider interface using OpenAI API via Vercel AI SDK
 */

import { streamText, generateText } from 'ai';
import { openai as openaiProvider } from '@ai-sdk/openai';
import {
  type LLMMessage,
  type LLMOptions,
  type LLMResponse,
  type StreamingLLMResponse,
  type LLMProvider,
  type OpenAIConfig,
  LLMError,
  RateLimitError,
  ModelUnavailableError,
} from './types';

// Supported OpenAI models
export const OPENAI_MODELS = {
  GPT4: 'gpt-4',
  GPT4_TURBO: 'gpt-4-turbo',
  GPT4O: 'gpt-4o',
  GPT4O_MINI: 'gpt-4o-mini',
  GPT35_TURBO: 'gpt-3.5-turbo',
} as const;

const DEFAULT_FALLBACK_MODELS = [
  OPENAI_MODELS.GPT4O,
  OPENAI_MODELS.GPT4O_MINI,
  OPENAI_MODELS.GPT35_TURBO,
];

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private fallbackModels: string[];

  constructor(config: OpenAIConfig = { provider: 'openai' }) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.defaultModel = config.defaultModel ?? OPENAI_MODELS.GPT4O_MINI;
    this.fallbackModels = config.fallbackModels ?? DEFAULT_FALLBACK_MODELS;

    if (!this.apiKey) {
      throw new LLMError(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it in config.',
        'CONFIG_ERROR',
        false
      );
    }
  }

  async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const modelName = options.model ?? this.defaultModel;
    
    try {
      const result = await generateText({
        model: this.createModel(modelName),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
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
        model: this.createModel(modelName),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
      });

      // Create a promise that resolves with usage when streaming completes
      const usagePromise = result.usage.then((usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => ({
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
      })) as Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }>;

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
    const modelsToTry = [primaryModel, ...this.fallbackModels.filter(m => m !== primaryModel)];

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
    const modelsToTry = [primaryModel, ...this.fallbackModels.filter(m => m !== primaryModel)];

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
    return openaiProvider(modelName);
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof LLMError) {
      return error;
    }

    const err = error as { statusCode?: number; message?: string; code?: string };
    const message = err.message ?? 'Unknown error';
    const statusCode = err.statusCode;

    // Handle rate limiting
    if (statusCode === 429 || message.toLowerCase().includes('rate limit')) {
      // Try to extract retry-after from error
      const retryMatch = message.match(/retry after (\d+)/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : undefined;
      
      return new RateLimitError(
        `Rate limit exceeded for model ${model}`,
        retryAfter,
        error
      );
    }

    // Handle model unavailability
    if (statusCode === 503 || message.toLowerCase().includes('unavailable')) {
      return new ModelUnavailableError(
        `Model ${model} is currently unavailable`,
        error
      );
    }

    // Handle context length exceeded
    if (message.toLowerCase().includes('context length') || statusCode === 400) {
      return new LLMError(
        `Context length exceeded for model ${model}`,
        'CONTEXT_LENGTH_EXCEEDED',
        false,
        error
      );
    }

    // Generic API error
    return new LLMError(
      `OpenAI API error: ${message}`,
      err.code ?? 'API_ERROR',
      statusCode === 500 || statusCode === 502 || statusCode === 503,
      error
    );
  }
}
