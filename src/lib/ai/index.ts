/**
 * @fileoverview AI Module - Complete AI provider integration
 *
 * Provides a unified interface for LLM chat completions and text embeddings.
 * Default configuration uses free tiers of OpenRouter (chat) and Google Gemini (embeddings),
 * with automatic fallback chains for reliability.
 *
 * ## Supported Providers
 *
 * ### Chat/Completion (LLM)
 * - **OpenRouter** - Access to multiple free models (DeepSeek, Mistral, Llama)
 * - **OpenAI** - GPT-4, GPT-3.5-turbo
 * - **Ollama** - Self-hosted local models
 *
 * ### Embeddings
 * - **Google Gemini** - Free tier (1,500 req/day), 768 dimensions
 * - **OpenAI** - text-embedding-3 series
 * - **Local** - Transformers.js on-device
 *
 * ## Quick Start
 *
 * ```typescript
 * import { streamChatCompletion, generateEmbedding } from '@/lib/ai';
 *
 * // Stream a chat response
 * const stream = await streamChatCompletion([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Generate embeddings
 * const embedding = await generateEmbedding('Your text here');
 * ```
 *
 * ## Configuration
 *
 * Set environment variables in `.env`:
 * ```
 * OPENROUTER_API_KEY=sk-or-v1-...
 * ```
 *
 * @module ai
 * @requires @ai-sdk/google
 * @requires @openrouter/ai-sdk-provider
 * @see {@link https://sdk.vercel.ai/|Vercel AI SDK Documentation}
 * @see {@link https://openrouter.ai/docs|OpenRouter Documentation}
 */

import { createHash } from 'node:crypto';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import {
  embed,
  embedMany,
  generateText,
  type LanguageModelUsage,
  type LanguageModelV1,
  streamText,
  type UIMessage,
} from 'ai';
import { asEmbeddingModel } from '@/lib/ai/types';
import { logger } from '@/lib/logger';
import { estimateTokens } from '@/lib/rag/token-budget';
import { embeddingCircuitBreaker } from '@/lib/resilience/external-services';
import type { RAGConfig } from '@/types';

// Embedding model configuration (Google Gemini - FREE)
const EMBEDDING_MODEL = 'text-embedding-004';

// Validate Google API key at module load time
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error(
    'GOOGLE_GENERATIVE_AI_API_KEY is required for embeddings. ' +
      'Get a free key at https://aistudio.google.com/app/apikey'
  );
}
const googleAI = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

// Groq provider — ultra-fast LPU inference (free tier with rate limits)
// Get API key: https://console.groq.com/keys
const groq = process.env.GROQ_API_KEY
  ? createOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

// NVIDIA NIM provider — high-quality models via DGX Cloud (free tier with rate limits)
// Get API key: https://build.nvidia.com/settings/api-keys
const nvidia = process.env.NVIDIA_API_KEY
  ? createOpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  : null;

// Cerebras provider — fastest inference on the planet (~2200 tok/s, 1M tokens/day free)
// Get API key: https://cloud.cerebras.ai
const cerebras = process.env.CEREBRAS_API_KEY
  ? createOpenAI({
      apiKey: process.env.CEREBRAS_API_KEY,
      baseURL: 'https://api.cerebras.ai/v1',
    })
  : null;

// SambaNova provider — fast Llama & DeepSeek models (free tier)
// Get API key: https://cloud.sambanova.ai
const sambanova = process.env.SAMBANOVA_API_KEY
  ? createOpenAI({
      apiKey: process.env.SAMBANOVA_API_KEY,
      baseURL: 'https://api.sambanova.ai/v1',
    })
  : null;

// Mistral provider — Codestral + Mistral Large (free experiment plan)
// Get API key: https://console.mistral.ai
const mistral = process.env.MISTRAL_API_KEY
  ? createOpenAI({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: 'https://api.mistral.ai/v1',
    })
  : null;

/**
 * BEST OpenRouter FREE Models - Ranked by Performance
 * All available at: https://openrouter.ai/models?max_price=0
 * Last verified: 2026-05-05
 */
export const BEST_FREE_MODELS = {
  // 🥇 TIER 1: Best Overall Performance (confirmed working)
  PRIMARY_CHAT: 'google/gemma-3-12b-it:free', // Fast, reliable, Google AI Studio

  // 🥈 TIER 2: Great Performance
  GPT_OSS_120B: 'openai/gpt-oss-120b:free', // OpenAI OSS — very capable
  GPT_OSS_20B: 'openai/gpt-oss-20b:free', // Smaller, faster OSS variant

  // 🥉 TIER 3: Good Alternatives
  GEMMA_3_27B: 'google/gemma-3-27b-it:free', // Google, larger Gemma variant
  LLAMA_3_3_70B: 'meta-llama/llama-3.3-70b-instruct:free', // Meta's best free model

  // 🏅 TIER 4: Fallback options
  LLAMA_3_2_3B: 'meta-llama/llama-3.2-3b-instruct:free', // Small but fast
  HERMES_405B: 'nousresearch/hermes-3-llama-3.1-405b:free', // Very capable but slow
} as const;

/**
 * Groq free models — ultra-fast LPU inference
 * Requires GROQ_API_KEY from https://console.groq.com/keys
 */
export const GROQ_MODELS = {
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  LLAMA_4_SCOUT: 'meta-llama/llama-4-scout-17b-16e-instruct',
  QWEN3_32B: 'qwen/qwen3-32b',
  GEMMA_2_9B: 'gemma2-9b-it',
  MIXTRAL_8x7B: 'mixtral-8x7b-32768',
  LLAMA_3_1_8B: 'llama-3.1-8b-instant',
} as const;

/**
 * NVIDIA NIM free models — high-quality reasoning on DGX Cloud
 * Requires NVIDIA_API_KEY from https://build.nvidia.com/settings/api-keys
 */
export const NVIDIA_MODELS = {
  NEMOTRON_70B: 'nvidia/llama-3.1-nemotron-70b-instruct',
  DEEPSEEK_R1: 'deepseek-ai/deepseek-r1',
  LLAMA_3_1_70B: 'meta/llama-3.1-70b-instruct',
  LLAMA_3_1_8B: 'meta/llama-3.1-8b-instruct',
  MIXTRAL_8x22B: 'mistralai/mixtral-8x22b-instruct-v0.1',
  NEMOTRON_NANO: 'nvidia/nemotron-nano-9b-v2',
} as const;

/**
 * Cerebras free models — fastest inference on the planet (~2200 tok/s)
 * 1M tokens/day free, no credit card required.
 * Get API key: https://cloud.cerebras.ai
 */
export const CEREBRAS_MODELS = {
  LLAMA_3_1_8B: 'llama3.1-8b',
  LLAMA_4_SCOUT: 'llama-4-scout-17b-16e-instruct',
  GPT_OSS_120B: 'gpt-oss-120b',
  QWEN_2_5_CODER_32B: 'qwen-2.5-coder-32b',
} as const;

/**
 * SambaNova free models — fast Llama & DeepSeek models
 * Free tier, no credit card required.
 * Get API key: https://cloud.sambanova.ai
 */
export const SAMBANOVA_MODELS = {
  DEEPSEEK_V3_1: 'DeepSeek-V3.1',
  LLAMA_4_MAVERICK: 'Llama-4-Maverick-17B-128E',
  LLAMA_3_3_70B: 'Meta-Llama-3.3-70B-Instruct',
  DEEPSEEK_R1: 'DeepSeek-R1',
} as const;

/**
 * Mistral free models — Codestral + Mistral Large (free experiment plan)
 * Phone verification required, no credit card.
 * Get API key: https://console.mistral.ai
 */
export const MISTRAL_MODELS = {
  MISTRAL_LARGE: 'mistral-large-latest',
  CODESTRAL: 'codestral-latest',
  MISTRAL_SMALL: 'mistral-small-latest',
  MISTRAL_NEMO: 'open-mistral-nemo',
} as const;

/**
 * Task-specific model assignments for optimal free-tier utilization.
 * Routes each AI task to the best provider based on speed, quality, and rate limits.
 *
 * Strategy:
 * - Chat (user-facing): Groq (fastest streaming) → SambaNova (smartest) → NVIDIA → Mistral
 * - Fast tasks (expansion, compression): Cerebras (~2200 tok/s, saves rate limits)
 * - HyDE (needs quality): SambaNova DeepSeek V3.1 → Groq
 * - Reranking: Cohere Rerank API (purpose-built)
 * - Embeddings: Google Gemini (free, high quality)
 */
export const TASK_MODELS = {
  // Fast internal tasks (query expansion, compression, sub-queries)
  FAST_TASK: `cerebras/${CEREBRAS_MODELS.LLAMA_3_1_8B}`,
  FAST_TASK_FALLBACK_1: `groq/${GROQ_MODELS.LLAMA_3_1_8B}`,
  FAST_TASK_FALLBACK_2: BEST_FREE_MODELS.LLAMA_3_2_3B,

  // HyDE (needs quality hypothetical documents)
  HYDE: `sambanova/${SAMBANOVA_MODELS.DEEPSEEK_V3_1}`,
  HYDE_FALLBACK_1: `groq/${GROQ_MODELS.LLAMA_3_3_70B}`,
  HYDE_FALLBACK_2: BEST_FREE_MODELS.PRIMARY_CHAT,
} as const;

export type AITask = 'fast' | 'hyde' | 'chat';

/**
 * Get the ordered list of models to try for a given task type.
 * For 'chat', delegates to dynamic model discovery.
 */
export async function getModelsForTask(task: AITask): Promise<string[]> {
  switch (task) {
    case 'fast':
      return [
        TASK_MODELS.FAST_TASK,
        TASK_MODELS.FAST_TASK_FALLBACK_1,
        TASK_MODELS.FAST_TASK_FALLBACK_2,
      ];
    case 'hyde':
      return [TASK_MODELS.HYDE, TASK_MODELS.HYDE_FALLBACK_1, TASK_MODELS.HYDE_FALLBACK_2];
    case 'chat': {
      const { getModelsForStreaming } = await import('./model-discovery');
      const result = await getModelsForStreaming('chat');
      return result.modelsToTry;
    }
  }
}

/**
 * Model fallback chain for resilience
 * Automatically tries next model if one fails/rate-limits.
 * Prioritizes providers with dedicated API keys for best performance.
 */
export const MODEL_FALLBACK_CHAIN = [
  // Groq: ultra-fast LPU inference — best for real-time streaming
  `groq/${GROQ_MODELS.LLAMA_3_3_70B}`,
  `groq/${GROQ_MODELS.LLAMA_4_SCOUT}`,
  // SambaNova: DeepSeek V3.1 — top open-source quality
  `sambanova/${SAMBANOVA_MODELS.DEEPSEEK_V3_1}`,
  `sambanova/${SAMBANOVA_MODELS.LLAMA_3_3_70B}`,
  // NVIDIA: Nemotron 70B — high-quality reasoning on DGX Cloud
  `nvidia-nim/${NVIDIA_MODELS.NEMOTRON_70B}`,
  `nvidia-nim/${NVIDIA_MODELS.DEEPSEEK_R1}`,
  // Mistral: Large — strong general + multilingual
  `mistral/${MISTRAL_MODELS.MISTRAL_LARGE}`,
  // Cerebras: fastest inference (~2200 tok/s)
  `cerebras/${CEREBRAS_MODELS.LLAMA_4_SCOUT}`,
  `cerebras/${CEREBRAS_MODELS.GPT_OSS_120B}`,
  // OpenRouter: always available free models (fallback)
  BEST_FREE_MODELS.PRIMARY_CHAT,
  BEST_FREE_MODELS.GPT_OSS_120B,
  BEST_FREE_MODELS.GPT_OSS_20B,
  BEST_FREE_MODELS.GEMMA_3_27B,
  BEST_FREE_MODELS.LLAMA_3_3_70B,
  BEST_FREE_MODELS.LLAMA_3_2_3B,
];

export const defaultAIConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: (process.env.DEFAULT_MODEL as RAGConfig['model']) || 'auto', // Dynamic — resolved via model discovery
  embeddingModel: EMBEDDING_MODEL,
};

// ==================== Chat Completions (OpenRouter) ====================

export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  config: Partial<RAGConfig> = {}
) {
  const modelConfig = { ...defaultAIConfig, ...config };
  const { getModelsForStreaming } = await import('./model-discovery');
  const { modelsToTry: discoveredModels } = await getModelsForStreaming('chat');

  // Skip 'auto' — it's a placeholder meaning "use discovered models"
  const requestedModel = modelConfig.model !== 'auto' ? modelConfig.model : null;
  const modelsToTry = [
    ...(requestedModel ? [requestedModel] : []),
    ...discoveredModels.filter((m) => m !== requestedModel),
  ];

  let lastError: Error | undefined;

  for (const model of modelsToTry) {
    try {
      const languageModel = resolveModel(model);
      if (!languageModel) continue;

      const result = streamText({
        model: languageModel,
        messages: messages as Parameters<typeof streamText>[0]['messages'],
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      });

      return Object.assign(result, { _modelUsed: model });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('Model failed during streaming, trying fallback', {
        model,
        error: lastError.message,
      });
    }
  }

  throw lastError ?? new Error('All models failed');
}

export interface ChatCompletionResult {
  text: string;
  modelUsed: string;
  usage: LanguageModelUsage;
}

export async function generateChatCompletion(
  messages: Array<{ role: string; content: string }>,
  config: Partial<RAGConfig> = {}
): Promise<ChatCompletionResult> {
  const modelConfig = { ...defaultAIConfig, ...config };
  const { getModelsForStreaming } = await import('./model-discovery');
  const { modelsToTry: discoveredModels } = await getModelsForStreaming('chat');

  // Skip 'auto' — it's a placeholder meaning "use discovered models"
  const requestedModel = modelConfig.model !== 'auto' ? modelConfig.model : null;
  const modelsToTry = [
    ...(requestedModel ? [requestedModel] : []),
    ...discoveredModels.filter((m) => m !== requestedModel),
  ];

  for (const model of modelsToTry) {
    try {
      const languageModel = resolveModel(model);
      if (!languageModel) continue;

      const result = await generateText({
        model: languageModel,
        messages: messages as Parameters<typeof generateText>[0]['messages'],
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      });

      return { text: result.text, modelUsed: model, usage: result.usage };
    } catch (error) {
      logger.warn('Model failed during generation, trying fallback', {
        model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error('All models failed');
}

// ==================== Task-Based Model Routing ====================

/**
 * Generate a chat completion using the optimal model for a specific task type.
 * Uses task-specific model chains instead of the main fallback chain.
 */
export async function generateTaskCompletion(
  task: AITask,
  messages: Array<{ role: string; content: string }>,
  config: Partial<RAGConfig> = {}
): Promise<ChatCompletionResult> {
  const modelsToTry = await getModelsForTask(task);

  for (const model of modelsToTry) {
    try {
      const languageModel = resolveModel(model);
      if (!languageModel) continue;

      const result = await generateText({
        model: languageModel,
        messages: messages as Parameters<typeof generateText>[0]['messages'],
        temperature: config.temperature ?? (task === 'fast' ? 0.5 : 0.7),
        maxTokens: config.maxTokens ?? (task === 'fast' ? 300 : 2000),
      });

      return { text: result.text, modelUsed: model, usage: result.usage };
    } catch (error) {
      logger.warn('Task model failed, trying fallback', {
        task,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(`All models failed for task: ${task}`);
}

// ==================== Model Routing ====================

/**
 * Resolve a model ID to the appropriate AI SDK language model instance.
 * Routes to the correct provider based on model prefix.
 */
export function resolveModel(modelId: string): LanguageModelV1 | null {
  // Groq models (prefix: "groq/")
  if (modelId.startsWith('groq/')) {
    if (!groq) return null;
    return groq(modelId.slice(5));
  }

  // NVIDIA NIM models (prefix: "nvidia-nim/")
  if (modelId.startsWith('nvidia-nim/')) {
    if (!nvidia) return null;
    return nvidia(modelId.slice(11));
  }

  // Cerebras models (prefix: "cerebras/")
  if (modelId.startsWith('cerebras/')) {
    if (!cerebras) return null;
    return cerebras(modelId.slice(9));
  }

  // SambaNova models (prefix: "sambanova/")
  if (modelId.startsWith('sambanova/')) {
    if (!sambanova) return null;
    return sambanova(modelId.slice(10));
  }

  // Mistral models (prefix: "mistral/")
  if (modelId.startsWith('mistral/')) {
    if (!mistral) return null;
    return mistral(modelId.slice(8));
  }

  // Default: OpenRouter
  return openrouter(modelId);
}

// ==================== Embeddings (Google Gemini - FREE) ====================

/**
 * Generate embeddings using Google Gemini (FREE via AI Studio)
 * Get API key: https://aistudio.google.com/app/apikey
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddingCircuitBreaker.execute(async () => {
    const result = await embed({
      model: asEmbeddingModel<Parameters<typeof embed>[0]['model']>(
        googleAI.textEmbeddingModel(EMBEDDING_MODEL)
      ),
      value: text,
    });

    return Array.from(result.embedding);
  });
}

/**
 * Generate embeddings for multiple texts using Google Gemini
 * Processes in batches of 100 (Google's limit)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const batchSize = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const result = await embedMany({
      model: asEmbeddingModel<Parameters<typeof embed>[0]['model']>(
        googleAI.textEmbeddingModel(EMBEDDING_MODEL)
      ),
      values: batch,
    });

    embeddings.push(...result.embeddings.map((e) => Array.from(e)));
  }

  return embeddings;
}

/**
 * Generate cache key for embeddings
 */
export function generateEmbeddingCacheKey(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ==================== RAG System Prompt ====================

export interface RAGContext {
  content: string;
  source: string;
  score: number;
}

export function buildRAGSystemPrompt(context: RAGContext[], query: string): string {
  const contextBlocks = context
    .map((ctx, i) =>
      `
[Source ${i + 1}] ${ctx.source} (Relevance: ${(ctx.score * 100).toFixed(1)}%)
${ctx.content}
    `.trim()
    )
    .join('\n\n---\n\n');

  return `You are a helpful AI assistant answering questions based on the provided documents.

User Query: ${query}

Relevant Document Context:
${contextBlocks}

Instructions:
- Answer the user's query using ONLY the information from the provided documents above.
- If the documents don't contain enough information, say so clearly.
- Always cite your sources using [Source X] format when referencing information.
- Be concise but thorough in your response.`;
}

// ==================== Token Estimation ====================
// Note: estimateTokens is now imported from token-budget.ts for consistency
// See Fix #6 - Unified token estimation

export { estimateTokens };

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedChars = maxTokens * 4;
  if (text.length <= estimatedChars) return text;
  return `${text.slice(0, estimatedChars)}...`;
}

// ==================== Similarity Calculation ====================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar documents given a query embedding
 */
export function findSimilarDocuments(
  queryEmbedding: number[],
  documentEmbeddings: Array<{
    id: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }>,
  topK: number = 5,
  threshold: number = 0.7
): Array<{ id: string; score: number; metadata?: Record<string, unknown> }> {
  const similarities = documentEmbeddings.map((doc) => ({
    id: doc.id,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
    metadata: doc.metadata,
  }));

  return similarities
    .filter((doc) => doc.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ==================== Re-export types ====================

export type { UIMessage };
