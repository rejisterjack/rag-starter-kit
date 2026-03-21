/**
 * @fileoverview RAG Chain - Core RAG pipeline implementation
 *
 * This module orchestrates the complete Retrieval-Augmented Generation pipeline,
 * including document retrieval, context building, prompt construction, and
 * response generation. It provides both synchronous and streaming interfaces.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const chain = createRAGChain(llmProvider);
 * const response = await chain.query({
 *   query: "What are the key findings?",
 *   workspaceId: "ws_123",
 *   userId: "user_456"
 * });
 *
 * // Streaming usage
 * for await (const event of chain.stream({
 *   query: "Explain this document",
 *   workspaceId: "ws_123",
 *   userId: "user_456"
 * })) {
 *   if (event.type === 'token') {
 *     console.log(event.data); // Streamed token
 *   }
 * }
 * ```
 *
 * @module rag/chain
 * @see {@link module:rag/retrieval} for retrieval implementation
 * @see {@link module:ai/llm} for LLM provider interface
 */

import type { LLMMessage, LLMOptions, LLMProvider } from '@/lib/ai/llm';
import { buildSystemPromptWithContext } from '@/lib/ai/prompts/templates';
import type { RAGConfig, Source } from '@/types';
import { buildContext, retrieveSources } from './retrieval';

// =============================================================================
// Types
// =============================================================================

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  page?: number;
  score: number;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  sources?: Source[];
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  confidence: number;
  model: string;
}

export interface StreamEvent {
  type: 'retrieved' | 'generating' | 'token' | 'sources' | 'done' | 'error';
  data: unknown;
}

export interface RAGChainParams {
  query: string;
  workspaceId: string;
  conversationId?: string;
  history?: Message[];
  config?: Partial<RAGConfig>;
}

export interface PromptBuilder {
  buildSystemPrompt(context: string, config?: Partial<RAGConfig>): string;
  buildMessages(params: {
    query: string;
    context: string;
    history: Message[];
    config?: Partial<RAGConfig>;
  }): LLMMessage[];
}

export interface RetrievalEngine {
  retrieve(query: string, userId: string, config?: Partial<RAGConfig>): Promise<Source[]>;
}

// =============================================================================
// Default Prompt Builder
// =============================================================================

class DefaultPromptBuilder implements PromptBuilder {
  buildSystemPrompt(context: string, config?: Partial<RAGConfig>): string {
    const style = config?.temperature && config.temperature < 0.5 ? 'concise' : 'balanced';
    return buildSystemPromptWithContext(context, { style });
  }

  buildMessages(params: {
    query: string;
    context: string;
    history: Message[];
    config?: Partial<RAGConfig>;
  }): LLMMessage[] {
    const { query, context, history, config } = params;

    const systemPrompt = this.buildSystemPrompt(context, config);

    // Convert history to LLM messages (limit to last 6 for context window)
    const historyMessages: LLMMessage[] = history.slice(-6).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    return [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: query },
    ];
  }
}

// =============================================================================
// Default Retrieval Engine
// =============================================================================

class DefaultRetrievalEngine implements RetrievalEngine {
  async retrieve(query: string, userId: string, config?: Partial<RAGConfig>): Promise<Source[]> {
    return retrieveSources(query, userId, config);
  }
}

// =============================================================================
// RAG Chain
// =============================================================================

export class RAGChain {
  private retrievalEngine: RetrievalEngine;
  private promptBuilder: PromptBuilder;

  constructor(
    private llmProvider: LLMProvider,
    retrievalEngine?: RetrievalEngine,
    promptBuilder?: PromptBuilder
  ) {
    this.retrievalEngine = retrievalEngine ?? new DefaultRetrievalEngine();
    this.promptBuilder = promptBuilder ?? new DefaultPromptBuilder();
  }

  /**
   * Execute the RAG pipeline and return a complete response
   */
  async invoke(params: RAGChainParams): Promise<RAGResponse> {
    const { query, workspaceId, history = [], config = {} } = params;
    // Step 1: Retrieve relevant chunks
    const sources = await this.retrievalEngine.retrieve(query, workspaceId, config);

    // Step 2: Build context from sources
    const context = buildContext(sources);

    // Step 3: Build messages
    const messages = this.promptBuilder.buildMessages({
      query,
      context,
      history,
      config,
    });

    // Step 4: Generate response
    const llmOptions: LLMOptions = {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };

    const response = await this.llmProvider.generate(messages, llmOptions);

    // Calculate confidence based on source relevance
    const confidence = this.calculateConfidence(sources);

    return {
      answer: response.content,
      sources,
      usage: response.usage,
      confidence,
      model: response.model,
    };
  }

  /**
   * Execute the RAG pipeline with streaming
   */
  async *stream(params: RAGChainParams): AsyncGenerator<StreamEvent> {
    const { query, workspaceId, history = [], config = {} } = params;

    try {
      // Step 1: Retrieve relevant chunks
      const sources = await this.retrievalEngine.retrieve(query, workspaceId, config);

      // Yield retrieved event
      yield {
        type: 'retrieved',
        data: {
          sources,
          count: sources.length,
        },
      };

      // Step 2: Build context
      const context = buildContext(sources);

      // Step 3: Build messages
      const messages = this.promptBuilder.buildMessages({
        query,
        context,
        history,
        config,
      });

      // Step 4: Start generation
      yield {
        type: 'generating',
        data: { model: config.model },
      };

      // Step 5: Stream response
      const llmOptions: LLMOptions = {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: true,
      };

      const streamResponse = await this.llmProvider.stream(messages, llmOptions);

      // Yield tokens as they arrive
      for await (const token of streamResponse.content) {
        yield {
          type: 'token',
          data: { token },
        };
      }

      // Step 6: Yield sources and completion
      const usage = await streamResponse.usage;
      const confidence = this.calculateConfidence(sources);

      yield {
        type: 'sources',
        data: {
          sources,
          usage,
          confidence,
          model: streamResponse.model,
        },
      };

      yield {
        type: 'done',
        data: {
          sources,
          usage,
          confidence,
          model: streamResponse.model,
        },
      };
    } catch (error) {
      yield {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          code:
            error instanceof Error && 'code' in error
              ? (error as { code: string }).code
              : 'UNKNOWN',
        },
      };
      throw error;
    }
  }

  /**
   * Calculate confidence score based on retrieved sources
   */
  private calculateConfidence(sources: Source[]): number {
    if (sources.length === 0) {
      return 0;
    }

    // Calculate average similarity score
    const avgSimilarity = sources.reduce((sum, s) => sum + (s.similarity ?? 0), 0) / sources.length;

    // Confidence factors:
    // 1. Average similarity (0-1)
    // 2. Number of sources (diminishing returns after 3)
    // 3. Diversity (prefer sources from different documents)

    const sourceCountFactor = Math.min(sources.length / 3, 1);

    const documentIds = new Set(sources.map((s) => s.metadata.documentId));
    const diversityFactor = Math.min(documentIds.size / 2, 1);

    // Weighted combination
    const confidence = avgSimilarity * 0.5 + sourceCountFactor * 0.25 + diversityFactor * 0.25;

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Create a new chain with custom components
   */
  withComponents(components: {
    retrievalEngine?: RetrievalEngine;
    promptBuilder?: PromptBuilder;
    llmProvider?: LLMProvider;
  }): RAGChain {
    return new RAGChain(
      components.llmProvider ?? this.llmProvider,
      components.retrievalEngine ?? this.retrievalEngine,
      components.promptBuilder ?? this.promptBuilder
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a RAG chain with the default configuration
 */
export function createRAGChain(llmProvider: LLMProvider): RAGChain {
  return new RAGChain(llmProvider);
}

/**
 * Create a RAG chain with custom retrieval and prompt builders
 */
export function createCustomRAGChain(
  llmProvider: LLMProvider,
  retrievalEngine: RetrievalEngine,
  promptBuilder: PromptBuilder
): RAGChain {
  return new RAGChain(llmProvider, retrievalEngine, promptBuilder);
}

// =============================================================================
// Re-exports
// =============================================================================

export { DefaultPromptBuilder, DefaultRetrievalEngine };
