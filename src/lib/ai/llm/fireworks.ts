import { createOpenAI } from '@ai-sdk/openai';
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

export const FIREWORKS_FREE_MODELS = {
  APRIEL_15B: 'accounts/fireworks/models/apriel-15b-thinker',
  APRIEL_16_15B: 'accounts/fireworks/models/apriel-1-6-15b-thinker',
  DEEPCODER_14B: 'accounts/fireworks/models/deepcoder-14b-preview',
  SARVAM_M: 'accounts/fireworks/models/sarvam-m',
  TOGETHER_MOA: 'accounts/fireworks/models/together-moa-1-turbo',
} as const;

const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1';

export class FireworksProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private provider: ReturnType<typeof createOpenAI>;

  constructor(config: { apiKey?: string; defaultModel?: string } = {}) {
    this.apiKey = config.apiKey ?? process.env.FIREWORKS_API_KEY ?? '';
    this.defaultModel = config.defaultModel ?? FIREWORKS_FREE_MODELS.APRIEL_15B;

    if (!this.apiKey) {
      throw new LLMError(
        'Fireworks API key is required. Set FIREWORKS_API_KEY or get one at https://fireworks.ai',
        'CONFIG_ERROR',
        false
      );
    }

    this.provider = createOpenAI({
      baseURL: FIREWORKS_BASE_URL,
      apiKey: this.apiKey,
    });
  }

  async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const modelName = options.model ?? this.defaultModel;

    try {
      const result = await generateText({
        model: this.provider(modelName),
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
        model: this.provider(modelName),
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

    if (statusCode === 429 || message.toLowerCase().includes('rate limit')) {
      return new RateLimitError(
        `Rate limit exceeded for Fireworks model ${model}`,
        undefined,
        error
      );
    }

    if (statusCode === 503 || message.toLowerCase().includes('unavailable')) {
      return new ModelUnavailableError(`Fireworks model ${model} is unavailable`, error);
    }

    return new LLMError(
      `Fireworks API error: ${message}`,
      err.code ?? 'API_ERROR',
      statusCode === 500 || statusCode === 502 || statusCode === 503,
      error
    );
  }
}
