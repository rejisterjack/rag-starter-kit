/**
 * Google Gemini LLM Provider
 * Uses @ai-sdk/google for Gemini model access
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import {
  LLMError,
  type LLMMessage,
  type LLMOptions,
  type LLMProvider,
  type LLMResponse,
  ModelUnavailableError,
  RateLimitError,
  type StreamingLLMResponse,
} from './types';

export const GEMINI_MODELS = {
  GEMINI_2_FLASH: 'gemini-2.0-flash',
  GEMINI_2_FLASH_LITE: 'gemini-2.0-flash-lite',
  GEMINI_1_5_PRO: 'gemini-1.5-pro',
} as const;

export class GeminiProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private provider: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(config: { apiKey?: string; defaultModel?: string } = {}) {
    this.apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY ?? '';
    this.defaultModel = config.defaultModel ?? GEMINI_MODELS.GEMINI_2_FLASH;

    if (!this.apiKey) {
      throw new LLMError(
        'Google Gemini API key is required. Set GOOGLE_API_KEY or provide your own key.',
        'CONFIG_ERROR',
        false
      );
    }

    this.provider = createGoogleGenerativeAI({ apiKey: this.apiKey });
  }

  async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const modelName = options.model ?? this.defaultModel;

    try {
      const result = await generateText({
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK version compatibility
        model: this.provider(modelName) as any,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
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
        model: this.provider(modelName) as any,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
      });

      const usagePromise = result.usage.then(
        (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => ({
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
        })
      ) as Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }>;

      return { content: result.textStream, usage: usagePromise, model: modelName };
    } catch (error) {
      throw this.handleError(error, modelName);
    }
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof LLMError) return error;

    const err = error as { statusCode?: number; message?: string; code?: string; status?: number };
    const message = err.message ?? 'Unknown error';
    const statusCode = err.statusCode ?? err.status;

    if (
      statusCode === 429 ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('resource exhausted')
    ) {
      return new RateLimitError(`Rate limit exceeded for Gemini model ${model}`, undefined, error);
    }

    if (
      statusCode === 503 ||
      message.toLowerCase().includes('unavailable') ||
      message.toLowerCase().includes('overloaded')
    ) {
      return new ModelUnavailableError(`Gemini model ${model} is unavailable`, error);
    }

    return new LLMError(
      `Gemini API error: ${message}`,
      err.code ?? 'API_ERROR',
      statusCode === 500 || statusCode === 502 || statusCode === 503,
      error
    );
  }
}
