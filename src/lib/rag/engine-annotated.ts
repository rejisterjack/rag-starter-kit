/**
 * RAG (Retrieval-Augmented Generation) Engine - Annotated
 *
 * This file provides detailed inline documentation for the RAG engine,
 * explaining the complex logic and architectural decisions.
 *
 * What is RAG?
 * ------------
 * RAG combines retrieval systems with LLM generation to produce more
 * accurate, up-to-date, and verifiable responses. Instead of relying
 * solely on the model's training data, RAG retrieves relevant documents
 * from a knowledge base and incorporates them into the generation context.
 *
 * Architecture Overview:
 * ---------------------
 * 1. Ingestion Pipeline: Documents → Chunks → Embeddings → Vector Store
 * 2. Retrieval: Query → Embedding → Similarity Search → Reranking
 * 3. Generation: Context + Query → LLM → Response with Citations
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

/**
 * Default RAG Configuration
 *
 * These defaults are tuned for general-purpose question answering.
 * Adjust based on your use case:
 *
 * - chunkSize: 1000 tokens is a good balance between context window
 *   utilization and retrieval precision. Smaller chunks = more precise
 *   retrieval but less context per chunk.
 *
 * - chunkOverlap: 200 tokens (20%) ensures continuity between chunks.
 *   Critical for maintaining context across chunk boundaries.
 *
 * - topK: 5 chunks provides enough context without overwhelming the
 *   LLM's context window. Increase for complex multi-document queries.
 *
 * - similarityThreshold: 0.7 filters out low-relevance chunks.
 *   Lower = more results but potentially lower quality.
 */
export const defaultRAGConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',
};

// ============================================================================
// RAG Pipeline - Main Entry Point
// ============================================================================

/**
 * Generate a response using the RAG pipeline
 *
 * This function orchestrates the full RAG process:
 *
 * Phase 1: Retrieval
 *   - Convert query to embedding vector
 *   - Search vector database for similar chunks
 *   - Apply similarity threshold filtering
 *   - Rerank results for better relevance
 *
 * Phase 2: Context Building
 *   - Format retrieved chunks into context string
 *   - Truncate to fit within model's context window
 *   - Add source attribution markers
 *
 * Phase 3: Generation
 *   - Build system prompt with context
 *   - Include conversation history
 *   - Send to LLM with streaming support
 *   - Track token usage and latency
 *
 * Why this order matters:
 *   - Retrieval must happen first to get context
 *   - Context building must respect token limits
 *   - Generation needs complete prompt before starting
 *
 * @param query - The RAG query containing user message and config
 * @returns Promise<RAGResponse> - Generated response with metadata
 */
export async function generateRAGResponse(query: RAGQuery): Promise<RAGResponse> {
  // Dynamic imports allow tree-shaking and faster initial load
  const { retrieveSources, buildContext } = await import('./retrieval');
  const { generateChatCompletion } = await import('@/lib/ai');

  const startTime = Date.now();
  const config = { ...defaultRAGConfig, ...query.config };

  try {
    // PHASE 1: RETRIEVAL
    // ------------------
    // Retrieve relevant chunks from the knowledge base.
    // This is the "R" in RAG - the retrieval step.
    //
    // Under the hood, this:
    // 1. Generates embedding for the query
    // 2. Performs vector similarity search (cosine similarity)
    // 3. Applies any query expansion techniques
    // 4. Returns chunks with similarity scores
    const sources = await retrieveSources(query.query, query.userId ?? '', config);

    // PHASE 2: CONTEXT BUILDING
    // -------------------------
    // Transform retrieved chunks into a context string the LLM can use.
    //
    // Key considerations:
    // - Order chunks by relevance (most relevant first)
    // - Add source markers [1], [2] for citation
    // - Respect maxContextLength to avoid token limit errors
    // - Include metadata (document name, page number) for attribution
    const context = buildContext(sources, config.maxContextLength);

    // PHASE 3: GENERATION
    // -------------------
    // Build the complete prompt and send to LLM.
    //
    // Prompt structure:
    // 1. System prompt with RAG instructions and context
    // 2. Conversation history (if any)
    // 3. Current user query
    const systemPrompt = buildRAGSystemPrompt(context, config.systemInstructions);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // Map conversation history to chat format
      // This maintains context across turns in the conversation
      ...(query.history ?? []).map((m): ChatMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content: query.query },
    ];

    // Send to LLM and wait for complete response
    const response = await generateChatCompletion(messages as unknown as UIMessage[], config);

    const latency = Date.now() - startTime;

    // Extract token usage from response for analytics
    const usage: LanguageModelUsage = response.usage;

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
    // Log detailed error for debugging but return generic message to user
    logger.error('RAG pipeline error', {
      error: error instanceof Error ? error.message : 'Unknown',
      query: query.query,
      userId: query.userId,
    });
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Streaming Response Generator
// ============================================================================

/**
 * Stream a RAG response
 *
 * Similar to generateRAGResponse but yields chunks as they're generated
 * for real-time display. This provides better UX for long responses.
 *
 * The generator yields:
 * - 'sources': Retrieved sources (sent first for immediate display)
 * - 'content': Text chunks as they're generated
 * - 'done': Completion signal
 * - 'error': Error information
 *
 * Why streaming matters:
 * - Users perceive faster response times
 * - Can display sources immediately while waiting for LLM
 * - Allows cancellation mid-generation
 *
 * @param query - The RAG query
 * @yields AsyncGenerator with partial results
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
    // PHASE 1: RETRIEVAL (same as non-streaming)
    const sources = await retrieveSources(query.query, query.userId ?? '', config);

    // Yield sources immediately so UI can display them
    // This is a key UX improvement - users see sources before full response
    yield { type: 'sources', sources };

    // PHASE 2: CONTEXT BUILDING (same as non-streaming)
    const context = buildContext(sources, config.maxContextLength);
    const systemPrompt = buildRAGSystemPrompt(context, config.systemInstructions);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(query.history ?? []).map((m): ChatMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content: query.query },
    ];

    // PHASE 3: STREAMING GENERATION
    // ------------------------------
    // Get a streaming response from the LLM
    const stream = await streamChatCompletion(messages as unknown as UIMessage[], config);

    // Yield each chunk as it arrives
    // This allows the UI to display text character-by-character
    for await (const chunk of stream.textStream) {
      yield { type: 'content', content: chunk };
    }

    // Signal completion
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
// System Prompt Builder
// ============================================================================

/**
 * Build a system prompt for RAG with context
 *
 * The system prompt is crucial for RAG quality. It instructs the LLM:
 * 1. How to use the provided context
 * 2. When to cite sources
 * 3. What to do when context is insufficient
 *
 * Prompt engineering notes:
 * - Explicit instructions work better than implicit
 * - Include examples of good citation format
 * - Set clear boundaries ("only use provided context")
 * - Handle edge cases ("say 'I don't know' if...")
 *
 * @param context - Retrieved context from documents
 * @param instructions - Optional custom instructions
 * @returns Complete system prompt string
 */
function buildRAGSystemPrompt(context: string, instructions?: string): string {
  // Base instructions for RAG behavior
  const baseInstructions =
    instructions ??
    `You are a helpful AI assistant. Answer the user's question based on the provided context.
If the context doesn't contain relevant information, say so honestly.
Always cite your sources using [1], [2], etc. when using information from the context.`;

  // No context case - inform user they need to upload documents
  if (!context) {
    return `${baseInstructions}\n\nNo relevant documents were found. Please let the user know they may need to upload documents.`;
  }

  // Full prompt with context
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
// Health Check
// ============================================================================

/**
 * Check if RAG pipeline is healthy
 *
 * Validates all components of the RAG pipeline:
 * - Embedding provider connectivity
 * - Vector store availability
 * - Retrieval functionality
 *
 * Used by health check endpoints and monitoring systems.
 *
 * @returns Health status for each component
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

  // Check vector store (PostgreSQL with pgvector)
  try {
    const { prisma } = await import('@/lib/db');
    await prisma.$queryRaw`SELECT 1`;
    vectorStore = true;
  } catch (error) {
    errors.push(`Vector store error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Retrieval health is dependent on the above
  retrieval = vectorStore && embeddingProvider;

  return {
    healthy: embeddingProvider && vectorStore,
    embeddingProvider,
    vectorStore,
    retrieval,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format chat history for the LLM prompt
 *
 * Converts the internal message format to a text representation
 * that can be included in prompts.
 *
 * Format:
 * Human: [message]
 * Assistant: [message]
 *
 * @param messages - Array of chat messages
 * @returns Formatted history string
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
 *
 * @deprecated Use buildContext from retrieval module
 * @param sources - Retrieved sources
 * @returns Formatted context string
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
 * This is a convenience wrapper around the embedding provider that provides
 * a simplified interface for common operations.
 *
 * Usage:
 * ```typescript
 * const embeddings = createEmbeddings();
 * const vectors = await embeddings.embedDocuments(['text1', 'text2']);
 * const queryVector = await embeddings.embedQuery('search query');
 * ```
 *
 * @returns Object with embedQuery and embedDocuments methods
 */
export function createEmbeddings() {
  const provider = createEmbeddingProviderFromEnv();

  return {
    /**
     * Embed a single query text
     * Optimized for search queries
     */
    embedQuery: async (text: string): Promise<number[]> => {
      return provider.embedQuery(text);
    },

    /**
     * Embed multiple documents
     * Batches requests for efficiency
     */
    embedDocuments: async (texts: string[]): Promise<number[][]> => {
      return provider.embedDocuments(texts);
    },

    /**
     * Get the provider name for logging/debugging
     */
    get providerName(): string {
      return provider.name;
    },

    /**
     * Get the model name being used
     */
    get modelName(): string {
      return provider.modelName;
    },

    /**
     * Get the embedding dimensions
     * Important for vector database schema
     */
    get dimensions(): number {
      return provider.dimensions;
    },
  };
}
