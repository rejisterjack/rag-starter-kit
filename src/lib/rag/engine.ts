/**
 * RAG Engine
 *
 * Core RAG pipeline orchestration.
 * Coordinates embedding generation, retrieval, and response generation.
 */

import type { LanguageModelUsage, UIMessage } from 'ai';
import { createEmbeddingProviderFromEnv } from '@/lib/ai/embeddings';
import { logger } from '@/lib/logger';
import type { RAGConfig, RAGQuery, RAGResponse, Source } from '@/types';

// Define message type compatible with the AI SDK
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// Configuration
// ============================================================================

export const defaultRAGConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: process.env.DEFAULT_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
};

// ============================================================================
// RAG Pipeline
// ============================================================================

/**
 * Generate a response using the RAG pipeline
 *
 * This function orchestrates the full RAG pipeline:
 * 1. Generate query embedding
 * 2. Retrieve relevant chunks from vector store
 * 3. Build context from sources
 * 4. Generate response with context
 */
export async function generateRAGResponse(query: RAGQuery): Promise<RAGResponse> {
  const { retrieveSources, buildContext } = await import('./retrieval');
  const { generateChatCompletion } = await import('@/lib/ai');

  const startTime = Date.now();
  const config = { ...defaultRAGConfig, ...query.config };

  try {
    // Step 1: Retrieve relevant chunks
    const sources = await retrieveSources(query.query, query.userId ?? '', config);

    // Step 2: Build context from sources
    const context = buildContext(sources, config.maxContextLength);

    // Step 3: Generate response with context
    const systemPrompt = buildRAGSystemPrompt(context, config.systemInstructions);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(query.history ?? []).map((m): ChatMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content: query.query },
    ];

    const response = await generateChatCompletion(messages as unknown as UIMessage[], config);

    const latency = Date.now() - startTime;

    // Extract token usage from response
    const usage: LanguageModelUsage = response.usage;

    // FIXED: Use correct field names from LanguageModelUsage (promptTokens/completionTokens)
    return {
      answer: response.text,
      sources,
      tokensUsed: {
        prompt: usage.promptTokens ?? 0,
        completion: usage.completionTokens ?? 0,
        total: usage.totalTokens ?? 0,
      },
      latency,
    };
  } catch (error) {
    logger.error('RAG pipeline error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Stream a RAG response
 *
 * Similar to generateRAGResponse but streams the output for better UX.
 */
export async function* streamRAGResponse(query: RAGQuery): AsyncGenerator<{
  type: 'sources' | 'content' | 'done' | 'error';
  data?: unknown;
  sources?: Source[];
  content?: string;
  error?: string;
}> {
  const { retrieveSources, buildContext } = await import('./retrieval');
  const { streamChatCompletion } = await import('@/lib/ai');

  const config = { ...defaultRAGConfig, ...query.config };

  try {
    // Step 1: Retrieve sources
    const sources = await retrieveSources(query.query, query.userId ?? '', config);

    yield { type: 'sources', sources };

    // Step 2: Build context
    const context = buildContext(sources, config.maxContextLength);
    const systemPrompt = buildRAGSystemPrompt(context, config.systemInstructions);

    // Step 3: Stream response
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(query.history ?? []).map((m): ChatMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content: query.query },
    ];

    const stream = await streamChatCompletion(messages as unknown as UIMessage[], config);

    for await (const chunk of stream.textStream) {
      yield { type: 'content', content: chunk };
    }

    yield { type: 'done' };
  } catch (error) {
    logger.error('RAG streaming error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a system prompt for RAG with context
 */
function buildRAGSystemPrompt(context: string, instructions?: string): string {
  const baseInstructions =
    instructions ??
    `You are a helpful AI assistant. Answer the user's question based on the provided context.
If the context doesn't contain relevant information, say so honestly.
Always cite your sources using [1], [2], etc. when using information from the context.`;

  if (!context) {
    return `${baseInstructions}\n\nNo relevant documents were found. Please let the user know they may need to upload documents.`;
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

/**
 * Check if RAG pipeline is healthy
 */
export async function checkRAGHealth(): Promise<{
  healthy: boolean;
  embeddingProvider: boolean;
  vectorStore: boolean;
  retrieval: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let embeddingProvider = false;
  let vectorStore = false;
  let retrieval = false;

  // Check embedding provider
  try {
    const { createEmbeddingProviderFromEnv } = await import('@/lib/ai/embeddings');
    const provider = createEmbeddingProviderFromEnv();
    if (provider.healthCheck) {
      embeddingProvider = await provider.healthCheck();
      if (!embeddingProvider) {
        errors.push('Embedding provider health check failed');
      }
    } else {
      embeddingProvider = true;
    }
  } catch (error) {
    errors.push(`Embedding provider error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Check vector store
  try {
    const { prisma } = await import('@/lib/db');
    await prisma.$queryRaw`SELECT 1`;
    vectorStore = true;
  } catch (error) {
    errors.push(`Vector store error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Check retrieval (simplified)
  retrieval = vectorStore && embeddingProvider;

  return {
    healthy: embeddingProvider && vectorStore,
    embeddingProvider,
    vectorStore,
    retrieval,
    errors,
  };
}

/**
 * Format chat history for the LLM prompt
 */
export function formatChatHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  return messages
    .map((msg) => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
    .join('\n');
}

/**
 * Build context string from retrieved sources (legacy version)
 * @deprecated Use buildContext from retrieval module
 */
export function buildContextFromSources(sources: Source[]): string {
  if (sources.length === 0) {
    return '';
  }

  return sources
    .map((source, index) => {
      const meta = source.metadata;
      return `[${index + 1}] From "${meta.documentName}"${meta.page ? `, page ${meta.page}` : ''}:\n${source.content}`;
    })
    .join('\n\n');
}

// ============================================================================
// Embedding Creation Helper
// ============================================================================

/**
 * Create an embedding generator function using the configured embedding provider
 *
 * This is a convenience function that creates an embedding provider from environment
 * variables and returns an object with embedQuery and embedDocuments methods.
 *
 * @returns Object with embedQuery and embedDocuments methods
 *
 * @example
 * ```typescript
 * const embeddings = createEmbeddings();
 * const vectors = await embeddings.embedDocuments(['text1', 'text2']);
 * ```
 */
export function createEmbeddings() {
  const provider = createEmbeddingProviderFromEnv();

  return {
    /**
     * Embed a single query text
     */
    embedQuery: async (text: string): Promise<number[]> => {
      return provider.embedQuery(text);
    },

    /**
     * Embed multiple documents
     */
    embedDocuments: async (texts: string[]): Promise<number[][]> => {
      return provider.embedDocuments(texts);
    },

    /**
     * Get the provider name
     */
    get providerName(): string {
      return provider.name;
    },

    /**
     * Get the model name
     */
    get modelName(): string {
      return provider.modelName;
    },

    /**
     * Get the embedding dimensions
     */
    get dimensions(): number {
      return provider.dimensions;
    },
  };
}
