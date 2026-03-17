import { openai } from '@ai-sdk/openai';
import { streamText, generateText, type Message } from 'ai';

import type { RAGConfig } from '@/types';

/**
 * Default configuration for AI operations
 */
export const defaultAIConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',
};

/**
 * Stream a chat completion with the AI
 */
export async function streamChatCompletion(
  messages: Message[],
  config: Partial<RAGConfig> = {}
) {
  const modelConfig = { ...defaultAIConfig, ...config };

  return streamText({
    model: openai(modelConfig.model),
    messages,
    temperature: modelConfig.temperature,
    maxTokens: modelConfig.maxTokens,
  });
}

/**
 * Generate a non-streaming chat completion
 */
export async function generateChatCompletion(
  messages: Message[],
  config: Partial<RAGConfig> = {}
) {
  const modelConfig = { ...defaultAIConfig, ...config };

  return generateText({
    model: openai(modelConfig.model),
    messages,
    temperature: modelConfig.temperature,
    maxTokens: modelConfig.maxTokens,
  });
}

/**
 * Calculate approximate token count for text
 * This is a rough estimate - actual token count may vary by model
 */
export function estimateTokens(text: string): number {
  // Average ratio is roughly 4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Rough conversion back to characters
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + '...';
}

/**
 * Build a system prompt for RAG with context
 */
export function buildRAGSystemPrompt(context: string, instructions?: string): string {
  const baseInstructions = instructions ?? `You are a helpful AI assistant. Answer the user's question based on the provided context.
If the context doesn't contain relevant information, say so honestly.
Always cite your sources using [1], [2], etc. when using information from the context.`;

  if (!context) {
    return baseInstructions;
  }

  return `${baseInstructions}

Context:
${context}

Instructions:
- Answer based only on the context provided above
- Cite sources using [1], [2], etc.
- If the context doesn't contain the answer, say "I don't have enough information to answer that question."
- Be concise but thorough`;
}

// ============================================================================
// Re-export Embedding Providers
// ============================================================================

/**
 * @deprecated Use createEmbeddingProviderFromEnv from '@/lib/ai/embeddings' instead
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { createEmbeddingProviderFromEnv } = await import('./embeddings');
  const provider = createEmbeddingProviderFromEnv();
  return provider.embedDocuments(texts);
}

/**
 * @deprecated Use createEmbeddingProviderFromEnv from '@/lib/ai/embeddings' instead
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { createEmbeddingProviderFromEnv } = await import('./embeddings');
  const provider = createEmbeddingProviderFromEnv();
  return provider.embedQuery(text);
}

// Re-export all embedding modules
export * from './embeddings';
