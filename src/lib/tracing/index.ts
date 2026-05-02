/**
 * OpenTelemetry Tracing Configuration
 *
 * Provides distributed tracing for:
 * - Embedding operations
 * - RAG retrieval
 * - LLM generation
 * - Database queries
 */

import { type Span, SpanStatusCode, type Tracer, trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry SDK
let sdk: NodeSDK | null = null;

export function initTracing(): void {
  if (sdk) return;
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT === 'false') {
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? Object.fromEntries(
          process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map(
            (h) => h.split('=') as [string, string]
          )
        )
      : undefined,
  });

  sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'rag-starter-kit',
      [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
  });

  sdk.start();
}

export function shutdownTracing(): Promise<void> {
  if (!sdk) return Promise.resolve();
  return sdk.shutdown().then(() => {});
}

// Get tracer instance
export function getTracer(name = 'rag-starter-kit'): Tracer {
  return trace.getTracer(name);
}

// Instrument an async function with a span
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Specific instrumentation helpers for RAG operations
export const tracing = {
  // Embedding operations
  async embedDocuments(documents: string[], fn: () => Promise<number[][]>): Promise<number[][]> {
    return withSpan('embeddings.documents', async (span) => {
      span.setAttribute('embedding.count', documents.length);
      span.setAttribute('embedding.model', process.env.EMBEDDING_MODEL || 'text-embedding-004');
      const startTime = Date.now();
      const result = await fn();
      span.setAttribute('embedding.duration_ms', Date.now() - startTime);
      return result;
    });
  },

  // RAG retrieval with enhanced metrics
  async retrieveSources(
    query: string,
    topK: number,
    fn: () => Promise<unknown[]>
  ): Promise<unknown[]> {
    return withSpan('rag.retrieve', async (span) => {
      span.setAttribute('rag.query_length', query.length);
      span.setAttribute('rag.top_k', topK);
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;

      span.setAttribute('rag.results_count', result.length);
      span.setAttribute('rag.duration_ms', duration);

      // Calculate average similarity score if available
      interface RetrievalResult {
        similarity?: number;
        [key: string]: unknown;
      }

      if (result.length > 0 && 'similarity' in (result[0] as RetrievalResult)) {
        const avgSimilarity =
          result.reduce((sum: number, r: RetrievalResult) => sum + (r.similarity ?? 0), 0) /
          result.length;
        span.setAttribute('rag.avg_similarity', avgSimilarity);
      }

      return result;
    });
  },

  // RAG answer quality metrics
  async measureAnswerQuality(
    query: string,
    answer: string,
    sources: unknown[],
    fn: () => Promise<{ relevanceScore: number; faithfulnessScore: number }>
  ): Promise<{ relevanceScore: number; faithfulnessScore: number }> {
    return withSpan('rag.answer_quality', async (span) => {
      span.setAttribute('rag.query_length', query.length);
      span.setAttribute('rag.answer_length', answer.length);
      span.setAttribute('rag.sources_count', sources.length);

      const result = await fn();

      span.setAttribute('rag.relevance_score', result.relevanceScore);
      span.setAttribute('rag.faithfulness_score', result.faithfulnessScore);

      return result;
    });
  },

  // Reranking
  async rerank(
    query: string,
    documents: unknown[],
    fn: () => Promise<unknown[]>
  ): Promise<unknown[]> {
    return withSpan('rag.rerank', async (span) => {
      span.setAttribute('rerank.query_length', query.length);
      span.setAttribute('rerank.documents_count', documents.length);
      const startTime = Date.now();
      const result = await fn();
      span.setAttribute('rerank.duration_ms', Date.now() - startTime);
      return result;
    });
  },

  // LLM generation
  async generate(
    model: string,
    messageCount: number,
    fn: () => Promise<{
      content: string;
      usage?: { promptTokens: number; completionTokens: number };
    }>
  ): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
    return withSpan('llm.generate', async (span) => {
      span.setAttribute('llm.model', model);
      span.setAttribute('llm.message_count', messageCount);
      const startTime = Date.now();
      const result = await fn();
      span.setAttribute('llm.duration_ms', Date.now() - startTime);
      span.setAttribute('llm.response_length', result.content.length);
      if (result.usage) {
        span.setAttribute('llm.tokens.prompt', result.usage.promptTokens);
        span.setAttribute('llm.tokens.completion', result.usage.completionTokens);
        span.setAttribute(
          'llm.tokens.total',
          result.usage.promptTokens + result.usage.completionTokens
        );
      }
      return result;
    });
  },

  // Database operations
  async queryDb(operation: string, table: string, fn: () => Promise<unknown>): Promise<unknown> {
    return withSpan('db.query', async (span) => {
      span.setAttribute('db.operation', operation);
      span.setAttribute('db.table', table);
      const startTime = Date.now();
      const result = await fn();
      span.setAttribute('db.duration_ms', Date.now() - startTime);
      return result;
    });
  },

  // Chat completion streaming
  async streamGenerate(model: string, fn: (span: Span) => Promise<void>): Promise<void> {
    return withSpan('llm.stream', async (span) => {
      span.setAttribute('llm.model', model);
      span.setAttribute('llm.streaming', true);
      await fn(span);
    });
  },
};
