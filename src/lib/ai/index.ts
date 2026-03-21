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
 * GOOGLE_API_KEY=AIzaSy...
 * ```
 *
 * @module ai
 * @requires @ai-sdk/google
 * @requires @openrouter/ai-sdk-provider
 * @see {@link https://sdk.vercel.ai/|Vercel AI SDK Documentation}
 * @see {@link https://openrouter.ai/docs|OpenRouter Documentation}
 */

import { createHash } from 'node:crypto';
import { google } from '@ai-sdk/google';
import { openrouter } from '@openrouter/ai-sdk-provider';
import {
  embed,
  embedMany,
  generateText,
  type LanguageModelUsage,
  streamText,
  type UIMessage,
} from 'ai';

// Embedding model configuration (Google Gemini - FREE)
const EMBEDDING_MODEL = 'text-embedding-004';

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  temperature: number;
  maxTokens: number;
  model: string;
  embeddingModel: string;
}

/**
 * BEST OpenRouter FREE Models - Ranked by Performance
 * All available at: https://openrouter.ai/models?max_price=0
 */
export const BEST_FREE_MODELS = {
  // 🥇 TIER 1: Best Overall Performance
  DEEPSEEK_CHAT: 'deepseek/deepseek-chat:free', // Excellent reasoning, fast

  // 🥈 TIER 2: Great Performance
  MISTRAL_7B: 'mistralai/mistral-7b-instruct:free', // Fast, reliable
  LLAMA_3_1_8B: 'meta-llama/llama-3.1-8b-instruct:free', // Meta's best

  // 🥉 TIER 3: Good Alternative
  GEMMA_2_9B: 'google/gemma-2-9b-it:free', // Google's open model
  QWEN_2_5_7B: 'qwen/qwen-2.5-7b-instruct:free', // Alibaba's model

  // 🏅 TIER 4: Experimental
  HERMES_405B: 'nousresearch/hermes-3-llama-3.1-405b:free', // Very capable but slow
  PHI_3_MEDIUM: 'microsoft/phi-3-medium:free', // Microsoft
} as const;

/**
 * Model fallback chain for resilience
 * Automatically tries next model if one fails/rate-limits
 */
export const MODEL_FALLBACK_CHAIN = [
  BEST_FREE_MODELS.DEEPSEEK_CHAT,
  BEST_FREE_MODELS.MISTRAL_7B,
  BEST_FREE_MODELS.LLAMA_3_1_8B,
  BEST_FREE_MODELS.GEMMA_2_9B,
  BEST_FREE_MODELS.QWEN_2_5_7B,
];

export const defaultAIConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: BEST_FREE_MODELS.DEEPSEEK_CHAT, // Best free model
  embeddingModel: EMBEDDING_MODEL,
};

// ==================== Chat Completions (OpenRouter) ====================

export async function streamChatCompletion(messages: UIMessage[], config: Partial<RAGConfig> = {}) {
  const modelConfig = { ...defaultAIConfig, ...config };
  const modelsToTry = [
    modelConfig.model,
    ...MODEL_FALLBACK_CHAIN.filter((m) => m !== modelConfig.model),
  ];

  // Try primary model first, fall back if needed
  let lastError: Error | undefined;

  for (const model of modelsToTry) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = streamText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: openrouter.chat(model) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxTokens,
      });

      // Add model info to result
      return Object.assign(result, { _modelUsed: model });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
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
  messages: UIMessage[],
  config: Partial<RAGConfig> = {}
): Promise<ChatCompletionResult> {
  const modelConfig = { ...defaultAIConfig, ...config };
  const modelsToTry = [
    modelConfig.model,
    ...MODEL_FALLBACK_CHAIN.filter((m) => m !== modelConfig.model),
  ];

  for (const model of modelsToTry) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await generateText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: openrouter.chat(model) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxTokens,
      });

      return { text: result.text, modelUsed: model, usage: result.usage };
    } catch (_error) {}
  }

  throw new Error('All models failed');
}

// ==================== Embeddings (Google Gemini - FREE) ====================

/**
 * Generate embeddings using Google Gemini (FREE via AI Studio)
 * Get API key: https://aistudio.google.com/app/apikey
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });

  return Array.from(result.embedding);
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
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
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

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

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
