/**
 * Evaluation Types
 *
 * Type definitions for the RAG evaluation framework.
 * Covers datasets, metrics, per-query results, and aggregate reports.
 */

export interface EvalQuery {
  id: string;
  query: string;
  expectedDocuments?: string[]; // document IDs that should be retrieved
  expectedAnswer?: string; // ground truth answer
  tags?: string[];
}

export interface EvalDataset {
  name: string;
  description?: string;
  queries: EvalQuery[];
}

export interface RetrievalMetrics {
  precision: number;
  recall: number;
  f1: number;
  mrr: number; // Mean Reciprocal Rank
  ndcg: number; // Normalized Discounted Cumulative Gain
}

export interface AnswerMetrics {
  faithfulness: number; // 0-1, is the answer supported by sources
  answerRelevance: number; // 0-1, does the answer address the query
  completeness: number; // 0-1, does it cover expected topics
}

export interface EvalResult {
  queryId: string;
  query: string;
  retrievedDocumentIds: string[];
  generatedAnswer: string;
  sources: Array<{ documentId: string; content: string; similarity: number }>;
  retrievalMetrics: RetrievalMetrics;
  answerMetrics?: AnswerMetrics;
  latencyMs: number;
  error?: string;
}

export interface EvalReport {
  datasetName: string;
  timestamp: string;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgRetrievalMetrics: RetrievalMetrics;
  avgAnswerMetrics?: AnswerMetrics;
  avgLatencyMs: number;
  results: EvalResult[];
}
