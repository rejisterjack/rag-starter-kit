/**
 * Langfuse Integration
 * 
 * Provides observability for the RAG pipeline:
 * - Trace RAG pipeline execution
 * - Track latency per component
 * - Monitor retrieval quality
 * - Cost tracking
 * 
 * Note: This is a wrapper around Langfuse SDK.
 * Install with: npm install langfuse
 */

import type { Source } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  environment?: string;
}

export interface RAGTrace {
  traceId: string;
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface RAGSpan {
  spanId: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, unknown>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
}

export interface RAGGeneration {
  generationId: string;
  traceId: string;
  name: string;
  model: string;
  prompt: string;
  completion?: string;
  startTime: Date;
  endTime?: Date;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
}

export interface RAGEvent {
  eventId: string;
  traceId: string;
  name: string;
  startTime: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Langfuse Client Wrapper
// ============================================================================

export class LangfuseClient {
  private client: unknown | null = null;
  private enabled: boolean = false;
  private config?: LangfuseConfig;

  constructor(config?: LangfuseConfig) {
    if (config) {
      this.config = config;
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid requiring langfuse as a hard dependency
      const { Langfuse } = await import('langfuse');
      
      if (!this.config) {
        console.warn('Langfuse config not provided');
        return;
      }

      this.client = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.baseUrl,
        environment: this.config.environment ?? process.env.NODE_ENV,
      });

      this.enabled = true;
      console.log('Langfuse client initialized');
    } catch (error) {
      console.warn('Failed to initialize Langfuse:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if Langfuse is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Create a new trace
   */
  async createTrace(params: {
    name: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RAGTrace | null> {
    if (!this.isEnabled() || !this.client) return null;

    try {
      const trace = (this.client as { trace: (p: typeof params) => unknown }).trace(params);
      
      return {
        traceId: (trace as { id: string }).id,
        name: params.name,
        userId: params.userId,
        sessionId: params.sessionId,
        metadata: params.metadata,
      };
    } catch (error) {
      console.error('Failed to create Langfuse trace:', error);
      return null;
    }
  }

  /**
   * Create a span within a trace
   */
  async createSpan(
    traceId: string,
    params: {
      name: string;
      parentId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<RAGSpan | null> {
    if (!this.isEnabled() || !this.client) return null;

    try {
      const span = (this.client as { 
        span: (p: { traceId: string } & typeof params) => unknown 
      }).span({
        traceId,
        ...params,
      });

      return {
        spanId: (span as { id: string }).id,
        traceId,
        parentId: params.parentId,
        name: params.name,
        startTime: new Date(),
        metadata: params.metadata,
      };
    } catch (error) {
      console.error('Failed to create Langfuse span:', error);
      return null;
    }
  }

  /**
   * End a span
   */
  async endSpan(
    _spanId: string,
    _params?: {
      metadata?: Record<string, unknown>;
      level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
    }
  ): Promise<void> {
    if (!this.isEnabled() || !this.client) return;

    try {
      // Langfuse SDK handles span ending automatically in most cases
      // This is a placeholder for manual span management if needed
    } catch (error) {
      console.error('Failed to end Langfuse span:', error);
    }
  }

  /**
   * Log a generation (LLM call)
   */
  async logGeneration(
    traceId: string,
    params: {
      name: string;
      model: string;
      prompt: string;
      completion?: string;
      tokenUsage?: { prompt: number; completion: number; total: number };
      startTime: Date;
      endTime?: Date;
    }
  ): Promise<RAGGeneration | null> {
    if (!this.isEnabled() || !this.client) return null;

    try {
      const generation = (this.client as {
        generation: (p: { traceId: string } & typeof params) => unknown;
      }).generation({
        traceId,
        ...params,
      });

      return {
        generationId: (generation as { id: string }).id,
        traceId,
        name: params.name,
        model: params.model,
        prompt: params.prompt,
        completion: params.completion,
        startTime: params.startTime,
        endTime: params.endTime,
        tokenUsage: params.tokenUsage,
      };
    } catch (error) {
      console.error('Failed to log Langfuse generation:', error);
      return null;
    }
  }

  /**
   * Log an event
   */
  async logEvent(
    traceId: string,
    params: {
      name: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    if (!this.isEnabled() || !this.client) return;

    try {
      (this.client as { event: (p: { traceId: string } & typeof params) => void }).event({
        traceId,
        ...params,
      });
    } catch (error) {
      console.error('Failed to log Langfuse event:', error);
    }
  }

  /**
   * Score a trace or generation
   */
  async score(
    traceId: string,
    params: {
      name: string;
      value: number;
      comment?: string;
    }
  ): Promise<void> {
    if (!this.isEnabled() || !this.client) return;

    try {
      (this.client as { score: (p: { traceId: string } & typeof params) => void }).score({
        traceId,
        ...params,
      });
    } catch (error) {
      console.error('Failed to score Langfuse trace:', error);
    }
  }

  /**
   * Flush all pending events
   */
  async flush(): Promise<void> {
    if (!this.isEnabled() || !this.client) return;

    try {
      await (this.client as { flush: () => Promise<void> }).flush();
    } catch (error) {
      console.error('Failed to flush Langfuse:', error);
    }
  }
}

// ============================================================================
// RAG Pipeline Tracing Helper
// ============================================================================

export class RAGPipelineTracer {
  private langfuse: LangfuseClient;
  private currentTrace: RAGTrace | null = null;

  constructor(config?: LangfuseConfig) {
    this.langfuse = new LangfuseClient(config);
  }

  /**
   * Start tracing a RAG pipeline execution
   */
  async startTrace(params: {
    query: string;
    userId?: string;
    sessionId?: string;
    workspaceId?: string;
  }): Promise<string | null> {
    const trace = await this.langfuse.createTrace({
      name: 'rag_pipeline',
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: {
        query: params.query,
        workspaceId: params.workspaceId,
      },
    });

    if (trace) {
      this.currentTrace = trace;
      return trace.traceId;
    }

    return null;
  }

  /**
   * Trace the retrieval phase
   */
  async traceRetrieval<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    const traceId = this.currentTrace?.traceId;
    if (!traceId) return fn();

    const startTime = Date.now();
    // const span = await this.langfuse.createSpan(traceId, {
    //   name: 'retrieval',
    //   metadata,
    // });

    try {
      const result = await fn();
      
      await this.langfuse.logEvent(traceId, {
        name: 'retrieval_complete',
        metadata: {
          duration: Date.now() - startTime,
          ...(Array.isArray(result) && { chunksRetrieved: result.length }),
        },
      });

      return result;
    } catch (error) {
      await this.langfuse.logEvent(traceId, {
        name: 'retrieval_error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Trace the generation phase
   */
  async traceGeneration<T extends { content: string; usage?: { promptTokens: number; completionTokens: number } }>(
    fn: () => Promise<T>,
    params: {
      model: string;
      prompt: string;
    }
  ): Promise<T> {
    const traceId = this.currentTrace?.traceId;
    if (!traceId) return fn();

    const startTime = new Date();

    try {
      const result = await fn();
      const endTime = new Date();

      await this.langfuse.logGeneration(traceId, {
        name: 'generation',
        model: params.model,
        prompt: params.prompt,
        completion: result.content,
        startTime,
        endTime,
        tokenUsage: result.usage
          ? {
              prompt: result.usage.promptTokens,
              completion: result.usage.completionTokens,
              total: result.usage.promptTokens + result.usage.completionTokens,
            }
          : undefined,
      });

      return result;
    } catch (error) {
      await this.langfuse.logEvent(traceId, {
        name: 'generation_error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Score the retrieval quality
   */
  async scoreRetrieval(sources: Source[]): Promise<void> {
    const traceId = this.currentTrace?.traceId;
    if (!traceId) return;

    const avgSimilarity =
      sources.reduce((sum, s) => sum + (s.similarity ?? 0), 0) /
      (sources.length || 1);

    await this.langfuse.score(traceId, {
      name: 'retrieval_quality',
      value: avgSimilarity,
      comment: `Retrieved ${sources.length} chunks with avg similarity ${avgSimilarity.toFixed(3)}`,
    });
  }

  /**
   * End the trace
   */
  async endTrace(metadata?: Record<string, unknown>): Promise<void> {
    const traceId = this.currentTrace?.traceId;
    if (!traceId) return;

    await this.langfuse.logEvent(traceId, {
      name: 'pipeline_complete',
      metadata,
    });

    await this.langfuse.flush();
    this.currentTrace = null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Langfuse client from environment variables
 */
export function createLangfuseClientFromEnv(): LangfuseClient {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    console.warn('Langfuse credentials not configured');
    return new LangfuseClient();
  }

  return new LangfuseClient({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}

/**
 * Create RAG pipeline tracer from environment
 */
export function createRAGTracerFromEnv(): RAGPipelineTracer {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return new RAGPipelineTracer();
  }

  return new RAGPipelineTracer({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}

// ============================================================================
// Export
// ============================================================================

// Types are already exported above
