/**
 * OpenRouter AI Provider Configuration
 *
 * Uses OpenRouter's free tier models for chat completions.
 * OpenRouter provides access to multiple LLMs through a single API.
 *
 * Free models available (verified live 2026-08):
 * - nvidia/nemotron-3.5-lightning:free
 * - nvidia/nemotron-3-super-120b-a12b:free
 * - z-ai/glm-5.2:free
 *
 * Legacy ids (mistral-7b, gemma-2, llama-3.1/3.2, phi-3, zephyr, hermes) were
 * retired by OpenRouter and now return 404 "Not Found" — do not resurrect them.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText, type UIMessage } from 'ai';
import { asModel } from '@/lib/ai/types';
import { APP_URL } from '@/lib/constants';
import type { RAGConfig } from '@/types';

// Create OpenRouter client
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  headers: {
    'HTTP-Referer': APP_URL,
    'X-Title': 'RAG Starter Kit',
  },
});

/**
 * Free models available on OpenRouter
 */
export const FREE_MODELS = {
  // NVIDIA Nemotron 3.5 Lightning — fast, reliable, good general quality
  NEMOTRON_LIGHTNING: 'nvidia/nemotron-3.5-lightning:free',

  // NVIDIA Nemotron 3 Super 120B — larger fallback with strong quality
  NEMOTRON_SUPER: 'nvidia/nemotron-3-super-120b-a12b:free',

  // Z.AI GLM 5.2 — capable, occasionally rate-limited
  GLM_5_2: 'z-ai/glm-5.2:free',
} as const;

/**
 * Default model to use
 */
export const DEFAULT_FREE_MODEL = FREE_MODELS.NEMOTRON_LIGHTNING;

/**
 * Model configuration with context window sizes
 */
export const MODEL_CONFIG: Record<string, { maxTokens: number; contextWindow: number }> = {
  [FREE_MODELS.NEMOTRON_LIGHTNING]: { maxTokens: 8192, contextWindow: 128000 },
  [FREE_MODELS.NEMOTRON_SUPER]: { maxTokens: 8192, contextWindow: 128000 },
  [FREE_MODELS.GLM_5_2]: { maxTokens: 8192, contextWindow: 128000 },
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
    model: asModel<Parameters<typeof streamText>[0]['model']>(openrouter(modelConfig.model)),
    messages: messages as UIMessage[],
    temperature: modelConfig.temperature,
    maxTokens: Math.min(modelConfig.maxTokens, modelLimits.maxTokens),
  });

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
    model: asModel<Parameters<typeof generateText>[0]['model']>(openrouter(modelConfig.model)),
    messages: messages as UIMessage[],
    temperature: modelConfig.temperature,
    maxTokens: Math.min(modelConfig.maxTokens, modelLimits.maxTokens),
  });

  return result;
}

/**
 * Get available free models with descriptions
 */
export function getFreeModelsList() {
  return [
    {
      id: FREE_MODELS.NEMOTRON_LIGHTNING,
      name: 'Nemotron 3.5 Lightning',
      provider: 'NVIDIA',
      description: 'Fast and reliable. Great default for general tasks.',
      contextWindow: 128000,
    },
    {
      id: FREE_MODELS.NEMOTRON_SUPER,
      name: 'Nemotron 3 Super 120B',
      provider: 'NVIDIA',
      description: 'Larger model with strong reasoning quality.',
      contextWindow: 128000,
    },
    {
      id: FREE_MODELS.GLM_5_2,
      name: 'GLM 5.2',
      provider: 'Z.AI',
      description: 'Capable general model, occasionally rate-limited.',
      contextWindow: 128000,
    },
  ];
}

/**
 * Check if API key is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
