/**
 * Evaluation Metrics
 *
 * Implements retrieval and answer quality metrics.
 * Reuses and extends the patterns from tests/evaluation/utils.ts.
 */

import type { AnswerMetrics, RetrievalMetrics } from './types';

// =============================================================================
// Retrieval Metrics
// =============================================================================

/**
 * Precision: fraction of retrieved documents that are relevant.
 */
export function calculatePrecision(retrieved: string[], relevant: string[]): number {
  if (retrieved.length === 0) return 0;
  const relevantSet = new Set(relevant);
  const hits = retrieved.filter((id) => relevantSet.has(id));
  return hits.length / retrieved.length;
}

/**
 * Recall: fraction of relevant documents that were retrieved.
 */
export function calculateRecall(retrieved: string[], relevant: string[]): number {
  if (relevant.length === 0) return 0;
  const retrievedSet = new Set(retrieved);
  const hits = relevant.filter((id) => retrievedSet.has(id));
  return hits.length / relevant.length;
}

/**
 * F1: harmonic mean of precision and recall.
 */
export function calculateF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Mean Reciprocal Rank: 1/rank of the first relevant document in the result list.
 */
export function calculateMRR(retrieved: string[], relevant: string[]): number {
  const relevantSet = new Set(relevant);
  for (let i = 0; i < retrieved.length; i++) {
    if (relevantSet.has(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Normalized Discounted Cumulative Gain at position k.
 * Binary relevance: each retrieved doc gets relevance 1 if in relevant set, else 0.
 */
export function calculateNDCG(retrieved: string[], relevant: string[], k?: number): number {
  const cutoff = k ?? retrieved.length;
  const relevantSet = new Set(relevant);

  // Relevance scores for the retrieved list
  const relevanceScores = retrieved.slice(0, cutoff).map((id) => (relevantSet.has(id) ? 1 : 0));

  // DCG
  const dcg = relevanceScores.reduce((sum: number, score: number, i: number) => {
    return sum + score / Math.log2(i + 2); // log2(rank+1), rank is 1-indexed so i+2
  }, 0);

  // Ideal DCG: sort by relevance (all 1s first, then 0s)
  const idealScores = [...relevanceScores].sort((a, b) => b - a);
  const idcg = idealScores.reduce((sum: number, score: number, i: number) => {
    return sum + score / Math.log2(i + 2);
  }, 0);

  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Compute all retrieval metrics at once.
 */
export function calculateRetrievalMetrics(
  retrieved: string[],
  relevant: string[]
): RetrievalMetrics {
  const precision = calculatePrecision(retrieved, relevant);
  const recall = calculateRecall(retrieved, relevant);
  const f1 = calculateF1(precision, recall);
  const mrr = calculateMRR(retrieved, relevant);
  const ndcg = calculateNDCG(retrieved, relevant);

  return { precision, recall, f1, mrr, ndcg };
}

// =============================================================================
// Answer Metrics (heuristic-based)
// =============================================================================

/**
 * Normalize text for comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key information (numbers, currency, dates) from text.
 */
function extractKeyInfo(text: string): string[] {
  const patterns = [
    /\$[\d,]+(?:\.\d+)?\s*(?:million|billion|k)?/gi,
    /\d+(?:\.\d+)?%?/g,
    /\b(?:Q[1-4]|20\d{2})\b/g,
  ];

  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      results.push(...matches);
    }
  }

  return [...new Set(results)];
}

/**
 * Extract factual claims from an answer (sentences with numbers or substantial length).
 */
function extractClaims(answer: string): string[] {
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim());
  return sentences
    .filter((s) => /\d/.test(s) || s.includes('$') || s.includes('%') || s.split(' ').length > 5)
    .map((s) => s.trim().toLowerCase());
}

/**
 * Heuristic faithfulness: fraction of answer claims that are supported by source content.
 */
function calculateFaithfulness(answer: string, sources: string[]): number {
  const claims = extractClaims(answer);
  if (claims.length === 0) return 1;

  const normalizedSources = sources.map((s) => normalizeText(s));
  const supportedClaims = claims.filter((claim) =>
    normalizedSources.some((src) => src.includes(normalizeText(claim)))
  );

  return supportedClaims.length / claims.length;
}

/**
 * Heuristic answer relevance: keyword overlap between answer and query.
 */
function calculateAnswerRelevance(answer: string, query: string): number {
  const normalizedAnswer = normalizeText(answer);
  const normalizedQuery = normalizeText(query);

  // Direct inclusion check
  if (normalizedAnswer.includes(normalizedQuery)) return 1;

  // Token-based Jaccard similarity
  const answerTokens = new Set(normalizedAnswer.split(/\s+/));
  const queryTokens = new Set(normalizedQuery.split(/\s+/));
  const queryContentTokens = new Set([...queryTokens].filter((t) => t.length > 2));

  if (queryContentTokens.size === 0) return 0;

  const overlap = [...queryContentTokens].filter((t) => answerTokens.has(t));
  return Math.min(overlap.length / queryContentTokens.size, 1);
}

/**
 * Heuristic completeness: fraction of expected-answer tokens / key info found in the answer.
 */
function calculateCompleteness(answer: string, expectedAnswer?: string): number {
  if (!expectedAnswer) return 1; // nothing to check against

  const normalizedAnswer = normalizeText(answer);
  const normalizedExpected = normalizeText(expectedAnswer);

  // Check full inclusion
  if (normalizedAnswer.includes(normalizedExpected)) return 1;

  // Check key info coverage
  const keyInfo = extractKeyInfo(expectedAnswer);
  if (keyInfo.length > 0) {
    const found = keyInfo.filter((info) => normalizedAnswer.includes(info.toLowerCase()));
    return found.length / keyInfo.length;
  }

  // Token-level coverage
  const expectedTokens = new Set(normalizedExpected.split(/\s+/));
  const answerTokens = new Set(normalizedAnswer.split(/\s+/));
  const overlap = [...expectedTokens].filter((t) => answerTokens.has(t));
  return expectedTokens.size > 0 ? overlap.length / expectedTokens.size : 0;
}

/**
 * Compute all answer quality metrics.
 */
export function calculateAnswerMetrics(
  answer: string,
  query: string,
  sources: string[],
  expectedAnswer?: string
): AnswerMetrics {
  const faithfulness = calculateFaithfulness(answer, sources);
  const answerRelevance = calculateAnswerRelevance(answer, query);
  const completeness = calculateCompleteness(answer, expectedAnswer);

  return { faithfulness, answerRelevance, completeness };
}

// =============================================================================
// Aggregation helpers
// =============================================================================

/**
 * Average a set of RetrievalMetrics into a single object.
 */
export function averageRetrievalMetrics(metrics: RetrievalMetrics[]): RetrievalMetrics {
  if (metrics.length === 0) {
    return { precision: 0, recall: 0, f1: 0, mrr: 0, ndcg: 0 };
  }
  const sum = metrics.reduce(
    (acc, m) => ({
      precision: acc.precision + m.precision,
      recall: acc.recall + m.recall,
      f1: acc.f1 + m.f1,
      mrr: acc.mrr + m.mrr,
      ndcg: acc.ndcg + m.ndcg,
    }),
    { precision: 0, recall: 0, f1: 0, mrr: 0, ndcg: 0 }
  );
  const n = metrics.length;
  return {
    precision: sum.precision / n,
    recall: sum.recall / n,
    f1: sum.f1 / n,
    mrr: sum.mrr / n,
    ndcg: sum.ndcg / n,
  };
}

/**
 * Average a set of AnswerMetrics into a single object.
 */
export function averageAnswerMetrics(metrics: AnswerMetrics[]): AnswerMetrics {
  if (metrics.length === 0) {
    return { faithfulness: 0, answerRelevance: 0, completeness: 0 };
  }
  const sum = metrics.reduce(
    (acc, m) => ({
      faithfulness: acc.faithfulness + m.faithfulness,
      answerRelevance: acc.answerRelevance + m.answerRelevance,
      completeness: acc.completeness + m.completeness,
    }),
    { faithfulness: 0, answerRelevance: 0, completeness: 0 }
  );
  const n = metrics.length;
  return {
    faithfulness: sum.faithfulness / n,
    answerRelevance: sum.answerRelevance / n,
    completeness: sum.completeness / n,
  };
}
