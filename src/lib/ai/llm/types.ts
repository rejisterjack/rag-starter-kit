/**
 * LLM Provider Types
 * Core type definitions for LLM provider abstraction
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  streaming?: boolean;
}

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMTokenUsage;
  model: string;
  finishReason: string;
}

export interface StreamingLLMResponse {
  content: AsyncIterable<string>;
  usage: Promise<LLMTokenUsage>;
  model: string;
}

export interface LLMProvider {
  /**
   * Generate a non-streaming response
   */
  generate(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;

  /**
   * Generate a streaming response
   */
  stream(messages: LLMMessage[], options?: LLMOptions): Promise<StreamingLLMResponse>;
}

// Provider configuration types
export interface OpenAIConfig {
  provider: 'openai';
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fallbackModels?: string[];
}

export interface OpenRouterConfig {
  provider: 'openrouter';
  apiKey?: string;
  defaultModel?: string;
  referer?: string;
  title?: string;
}

export interface OllamaConfig {
  provider: 'ollama';
  baseUrl?: string;
  defaultModel?: string;
}

export type LLMConfig = OpenAIConfig | OpenRouterConfig | OllamaConfig;

// Error types
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class RateLimitError extends LLMError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    originalError?: unknown
  ) {
    super(message, 'RATE_LIMIT', true, originalError);
    this.name = 'RateLimitError';
  }
}

export class ModelUnavailableError extends LLMError {
  constructor(
    message: string = 'Model unavailable',
    originalError?: unknown
  ) {
    super(message, 'MODEL_UNAVAILABLE', true, originalError);
    this.name = 'ModelUnavailableError';
  }
}
