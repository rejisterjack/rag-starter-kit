/**
 * Ollama LLM Provider
 * Implementation of the LLMProvider interface using Ollama for local inference
 */

import { ollama } from 'ollama-ai-provider';
import { streamText, generateText } from 'ai';
import {
  type LLMMessage,
  type LLMOptions,
  type LLMResponse,
  type StreamingLLMResponse,
  type LLMProvider,
  type OllamaConfig,
  type LLMTokenUsage,
  LLMError,
  ModelUnavailableError,
} from './types';

// Supported Ollama models
export const OLLAMA_MODELS = {
  LLAMA3: 'llama3',
  LLAMA3_LATEST: 'llama3:latest',
  MISTRAL: 'mistral',
  MISTRAL_LATEST: 'mistral:latest',
  PHI3: 'phi3',
  PHI3_LATEST: 'phi3:latest',
  GEMMA2: 'gemma2',
  GEMMA2_LATEST: 'gemma2:latest',
  CODELLAMA: 'codellama',
} as const;

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model: string;
    size: number;
    digest: string;
    modified_at: string;
  }>;
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: OllamaConfig = { provider: 'ollama' }) {
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.defaultModel = config.defaultModel ?? OLLAMA_MODELS.LLAMA3;
  }

  async generate(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const modelName = options.model ?? this.defaultModel;

    // Check if Ollama is available
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new ModelUnavailableError(
        `Ollama is not available at ${this.baseUrl}. Please ensure Ollama is running.`
      );
    }

    try {
      const result = await generateText({
        model: ollama(modelName) as unknown as Parameters<typeof generateText>[0]['model'],
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
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

    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new ModelUnavailableError(
        `Ollama is not available at ${this.baseUrl}. Please ensure Ollama is running.`
      );
    }

    try {
      const result = streamText({
        model: ollama(modelName) as unknown as Parameters<typeof streamText>[0]['model'],
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
      });

      // Create a promise that resolves with usage when streaming completes
      const usagePromise = Promise.resolve({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }) as Promise<LLMTokenUsage>;

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
   * Check if Ollama server is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models on the Ollama server
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      
      const data = await response.json() as OllamaTagsResponse;
      return data.models.map((m) => m.name);
    } catch (error) {
      throw new LLMError(
        'Failed to list Ollama models',
        'LIST_MODELS_ERROR',
        false,
        error
      );
    }
  }

  /**
   * Pull a model if not already available
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Note: This streams progress updates, but for now we just wait for completion
      // In production, you might want to stream this to the client
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    } catch (error) {
      throw new LLMError(
        `Failed to pull model ${modelName}`,
        'PULL_MODEL_ERROR',
        false,
        error
      );
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => m === modelName || m.startsWith(`${modelName}:`));
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof LLMError) {
      return error;
    }

    const err = error as { message?: string; statusCode?: number };
    const message = err.message ?? 'Unknown error';

    // Handle model not found
    if (message.includes('not found') || message.includes('does not exist')) {
      return new LLMError(
        `Model ${model} not found. Run 'ollama pull ${model}' to download it.`,
        'MODEL_NOT_FOUND',
        false,
        error
      );
    }

    // Handle connection errors
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return new ModelUnavailableError(
        `Cannot connect to Ollama at ${this.baseUrl}`,
        error
      );
    }

    return new LLMError(
      `Ollama error: ${message}`,
      'OLLAMA_ERROR',
      false,
      error
    );
  }
}
