/**
 * OpenRouter AI Provider Configuration
 *
 * Uses OpenRouter's free tier models for chat completions.
 * OpenRouter provides access to multiple LLMs through a single API.
 *
 * Free models available:
 * - mistralai/mistral-7b-instruct:free
 * - google/gemma-2-9b-it:free
 * - meta-llama/llama-3.1-8b-instruct:free
 * - microsoft/phi-3-mini-128k-instruct:free
 * - nousresearch/hermes-3-llama-3.1-405b:free
 * - huggingface/zephyr-7b-beta:free
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText, type UIMessage } from 'ai';
import type { RAGConfig } from '@/types';

// Create OpenRouter client
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'RAG Starter Kit',
  },
});

/**
 * Free models available on OpenRouter
 */
export const FREE_MODELS = {
  // Mistral 7B - Good balance of quality and speed
  MISTRAL_7B: 'mistralai/mistral-7b-instruct:free',

  // Google's Gemma 2 - Great for general tasks
  GEMMA_2_9B: 'google/gemma-2-9b-it:free',

  // Meta's Llama 3.1 - State-of-the-art open model
  LLAMA_3_1_8B: 'meta-llama/llama-3.1-8b-instruct:free',

  // Microsoft's Phi-3 - Fast and efficient
  PHI_3_MINI: 'microsoft/phi-3-mini-128k-instruct:free',

  // Nous Hermes 3 - Large context window
  HERMES_3_405B: 'nousresearch/hermes-3-llama-3.1-405b:free',

  // HuggingFace Zephyr - Good for chat
  ZEPHYR_7B: 'huggingface/zephyr-7b-beta:free',
} as const;

/**
 * Default model to use (Mistral 7B offers good balance)
 */
export const DEFAULT_FREE_MODEL = FREE_MODELS.MISTRAL_7B;

/**
 * Model configuration with context window sizes
 */
export const MODEL_CONFIG: Record<string, { maxTokens: number; contextWindow: number }> = {
  [FREE_MODELS.MISTRAL_7B]: { maxTokens: 8192, contextWindow: 32768 },
  [FREE_MODELS.GEMMA_2_9B]: { maxTokens: 8192, contextWindow: 8192 },
  [FREE_MODELS.LLAMA_3_1_8B]: { maxTokens: 8192, contextWindow: 128000 },
  [FREE_MODELS.PHI_3_MINI]: { maxTokens: 4096, contextWindow: 128000 },
  [FREE_MODELS.HERMES_3_405B]: { maxTokens: 8192, contextWindow: 128000 },
  [FREE_MODELS.ZEPHYR_7B]: { maxTokens: 4096, contextWindow: 32768 },
};

/**
 * Default configuration for OpenRouter AI operations
 */
export const defaultOpenRouterConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: DEFAULT_FREE_MODEL,
  // Note: Embeddings still use OpenAI or local Ollama
  // OpenRouter doesn't provide free embeddings
  embeddingModel: 'text-embedding-3-small',
};

/**
 * Stream a chat completion with OpenRouter
 */
export async function streamOpenRouterCompletion(
  messages: UIMessage[],
  config: Partial<RAGConfig> = {}
) {
  const modelConfig = { ...defaultOpenRouterConfig, ...config };

  // Get model-specific max tokens
  const modelLimits = MODEL_CONFIG[modelConfig.model] || { maxTokens: 8192 };

  const result = streamText({
    model: openrouter(modelConfig.model),
    messages: messages as UIMessage[],
    temperature: modelConfig.temperature,
    maxOutputTokens: Math.min(modelConfig.maxTokens, modelLimits.maxTokens),
  } as unknown as Parameters<typeof streamText>[0]);

  return result;
}

/**
 * Generate a non-streaming chat completion with OpenRouter
 */
export async function generateOpenRouterCompletion(
  messages: UIMessage[],
  config: Partial<RAGConfig> = {}
) {
  const modelConfig = { ...defaultOpenRouterConfig, ...config };

  // Get model-specific max tokens
  const modelLimits = MODEL_CONFIG[modelConfig.model] || { maxTokens: 8192 };

  const result = generateText({
    model: openrouter(modelConfig.model),
    messages: messages as UIMessage[],
    temperature: modelConfig.temperature,
    maxOutputTokens: Math.min(modelConfig.maxTokens, modelLimits.maxTokens),
  } as unknown as Parameters<typeof generateText>[0]);

  return result;
}

/**
 * Get available free models with descriptions
 */
export function getFreeModelsList() {
  return [
    {
      id: FREE_MODELS.MISTRAL_7B,
      name: 'Mistral 7B Instruct',
      provider: 'Mistral AI',
      description: 'Good balance of quality and speed. Great for general tasks.',
      contextWindow: 32768,
    },
    {
      id: FREE_MODELS.GEMMA_2_9B,
      name: 'Gemma 2 9B',
      provider: 'Google',
      description: 'Excellent for general tasks and reasoning.',
      contextWindow: 8192,
    },
    {
      id: FREE_MODELS.LLAMA_3_1_8B,
      name: 'Llama 3.1 8B Instruct',
      provider: 'Meta',
      description: 'State-of-the-art open model with large context.',
      contextWindow: 128000,
    },
    {
      id: FREE_MODELS.PHI_3_MINI,
      name: 'Phi-3 Mini',
      provider: 'Microsoft',
      description: 'Fast and efficient, great for quick responses.',
      contextWindow: 128000,
    },
    {
      id: FREE_MODELS.HERMES_3_405B,
      name: 'Hermes 3 Llama 3.1 405B',
      provider: 'Nous Research',
      description: 'Large model with extensive knowledge.',
      contextWindow: 128000,
    },
    {
      id: FREE_MODELS.ZEPHYR_7B,
      name: 'Zephyr 7B Beta',
      provider: 'HuggingFace',
      description: 'Optimized for chat conversations.',
      contextWindow: 32768,
    },
  ];
}

/**
 * Check if API key is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
