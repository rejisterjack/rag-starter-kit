/**
 * Evaluation Runner
 *
 * Runs a full evaluation against the live RAG pipeline via HTTP,
 * computing retrieval and answer metrics per query and aggregating
 * them into an EvalReport.
 */

import {
  averageAnswerMetrics,
  averageRetrievalMetrics,
  calculateAnswerMetrics,
  calculateRetrievalMetrics,
} from './metrics';
import type { EvalDataset, EvalQuery, EvalReport, EvalResult } from './types';

export interface EvalRunnerConfig {
  apiBaseUrl: string;
  apiKey?: string;
  /** Include answer generation step (calls chat API). Default: true */
  includeAnswer?: boolean;
  /** Concurrency for running queries in parallel. Default: 1 (sequential) */
  concurrency?: number;
}

// =============================================================================
// API response types
// =============================================================================

interface SearchResponseItem {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  score: number;
  page?: number;
  section?: string;
}

interface SearchApiResponse {
  data: SearchResponseItem[];
  meta: {
    query: string;
    total: number;
    threshold: number;
  };
}

interface ChatApiResponse {
  success: boolean;
  data?: {
    answer: string;
    citations: Array<{
      id: number;
      documentId: string;
      documentName: string;
      page?: number;
      score?: number;
      content: string;
    }>;
    metadata: {
      tokensUsed: number;
      latency: number;
      sourceCount: number;
      workspaceId: string;
    };
  };
  error?: string;
  code?: string;
}

// =============================================================================
// Runner
// =============================================================================

export class EvalRunner {
  private config: EvalRunnerConfig;

  constructor(config: EvalRunnerConfig) {
    this.config = {
      includeAnswer: true,
      concurrency: 1,
      ...config,
    };
  }

  /**
   * Execute a full evaluation run against the configured API.
   */
  async run(dataset: EvalDataset): Promise<EvalReport> {
    const results: EvalResult[] = [];
    const concurrency = this.config.concurrency ?? 1;

    // Process queries in batches for controlled concurrency
    for (let i = 0; i < dataset.queries.length; i += concurrency) {
      const batch = dataset.queries.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((query) => this.runQuery(query)));
      results.push(...batchResults);
    }

    // Separate successful and failed results
    const successful = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    // Aggregate metrics
    const allRetrievalMetrics = successful.map((r) => r.retrievalMetrics);
    const allAnswerMetrics = successful
      .map((r) => r.answerMetrics)
      .filter((m): m is NonNullable<typeof m> => m !== undefined);

    const avgLatencyMs =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length
        : 0;

    return {
      datasetName: dataset.name,
      timestamp: new Date().toISOString(),
      totalQueries: results.length,
      successfulQueries: successful.length,
      failedQueries: failed.length,
      avgRetrievalMetrics: averageRetrievalMetrics(allRetrievalMetrics),
      avgAnswerMetrics:
        allAnswerMetrics.length > 0 ? averageAnswerMetrics(allAnswerMetrics) : undefined,
      avgLatencyMs,
      results,
    };
  }

  /**
   * Run evaluation for a single query.
   */
  private async runQuery(query: EvalQuery): Promise<EvalResult> {
    const startTime = Date.now();

    try {
      // Step 1: Search / retrieval
      const searchResult = await this.callSearchApi(query.query);
      const retrievedDocumentIds = searchResult.data.map((r) => r.documentId);
      const sources = searchResult.data.map((r) => ({
        documentId: r.documentId,
        content: r.content,
        similarity: r.score,
      }));

      // Step 2: Compute retrieval metrics
      const retrievalMetrics = calculateRetrievalMetrics(
        retrievedDocumentIds,
        query.expectedDocuments ?? []
      );

      // Step 3: Optionally generate an answer
      let generatedAnswer = '';
      let answerMetrics: EvalResult['answerMetrics'];

      if (this.config.includeAnswer) {
        try {
          const chatResult = await this.callChatApi(query.query);
          generatedAnswer = chatResult.data?.answer ?? '';

          const sourceContents = searchResult.data.map((r) => r.content);
          answerMetrics = calculateAnswerMetrics(
            generatedAnswer,
            query.query,
            sourceContents,
            query.expectedAnswer
          );
        } catch (_chatError: unknown) {
          // Chat failed but retrieval succeeded - still record the retrieval result
          generatedAnswer = '';
          answerMetrics = undefined;
        }
      }

      const latencyMs = Date.now() - startTime;

      return {
        queryId: query.id,
        query: query.query,
        retrievedDocumentIds,
        generatedAnswer,
        sources,
        retrievalMetrics,
        answerMetrics,
        latencyMs,
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;
      return {
        queryId: query.id,
        query: query.query,
        retrievedDocumentIds: [],
        generatedAnswer: '',
        sources: [],
        retrievalMetrics: { precision: 0, recall: 0, f1: 0, mrr: 0, ndcg: 0 },
        answerMetrics: undefined,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Call the search API to retrieve documents.
   */
  private async callSearchApi(query: string): Promise<SearchApiResponse> {
    const url = `${this.config.apiBaseUrl}/api/v1/search`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        limit: 10,
        threshold: 0.5,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Search API returned ${response.status}: ${body}`);
    }

    return (await response.json()) as SearchApiResponse;
  }

  /**
   * Call the chat API to generate an answer.
   */
  private async callChatApi(query: string): Promise<ChatApiResponse> {
    const url = `${this.config.apiBaseUrl}/api/public/chat`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: query,
        config: {
          topK: 5,
          similarityThreshold: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Chat API returned ${response.status}: ${body}`);
    }

    return (await response.json()) as ChatApiResponse;
  }
}
