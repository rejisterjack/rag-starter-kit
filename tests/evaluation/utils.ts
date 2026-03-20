/**
 * RAG Evaluation Utilities
 *
 * Helper functions for evaluating RAG pipeline quality.
 */

export interface RetrievalResult {
  id: string;
  documentId: string;
  content: string;
  similarity?: number;
  rank?: number;
}

export interface EvaluationResult {
  query: string;
  retrievalScore: number;
  answerScore: number;
  overallScore: number;
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    mrr: number;
  };
}

/**
 * Evaluate retrieval quality
 */
export function evaluateRetrieval(
  retrieved: RetrievalResult[],
  relevantIds: string[],
  topK: number = 5
): number {
  const topRetrieved = retrieved.slice(0, topK);
  const retrievedIds = topRetrieved.map((r) => r.id);

  const relevantRetrieved = retrievedIds.filter((id) => relevantIds.includes(id));

  const precision = retrievedIds.length > 0 ? relevantRetrieved.length / retrievedIds.length : 0;

  const recall = relevantIds.length > 0 ? relevantRetrieved.length / relevantIds.length : 0;

  // F1 score
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Mean Reciprocal Rank
  let mrr = 0;
  for (const relevantId of relevantIds) {
    const rank = retrievedIds.indexOf(relevantId);
    if (rank !== -1) {
      mrr = Math.max(mrr, 1 / (rank + 1));
    }
  }

  // Combined score (weighted average)
  return f1 * 0.5 + mrr * 0.3 + precision * 0.2;
}

/**
 * Evaluate answer quality against expected answer
 */
export function evaluateAnswer(generated: string, expected: string): number {
  const normalizedGenerated = normalizeText(generated);
  const normalizedExpected = normalizeText(expected);

  // Check for exact or partial matches
  if (normalizedGenerated.includes(normalizedExpected)) {
    return 1.0;
  }

  // Token-based similarity
  const generatedTokens = new Set(normalizedGenerated.split(/\s+/));
  const expectedTokens = new Set(normalizedExpected.split(/\s+/));

  const intersection = new Set([...generatedTokens].filter((x) => expectedTokens.has(x)));

  const union = new Set([...generatedTokens, ...expectedTokens]);

  const jaccardSimilarity = intersection.size / union.size;

  // Check for key information presence
  const keyInfo = extractKeyInfo(expected);
  const foundKeyInfo = keyInfo.filter((info) => normalizedGenerated.includes(info.toLowerCase()));

  const keyInfoScore = keyInfo.length > 0 ? foundKeyInfo.length / keyInfo.length : 0;

  // Combined score
  return jaccardSimilarity * 0.4 + keyInfoScore * 0.6;
}

/**
 * Calculate comprehensive metrics
 */
export function calculateMetrics(evaluations: EvaluationResult[]): {
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  avgMRR: number;
  overallScore: number;
} {
  const metrics = {
    avgPrecision: 0,
    avgRecall: 0,
    avgF1: 0,
    avgMRR: 0,
    overallScore: 0,
  };

  if (evaluations.length === 0) return metrics;

  evaluations.forEach((e) => {
    metrics.avgPrecision += e.metrics.precision;
    metrics.avgRecall += e.metrics.recall;
    metrics.avgF1 += e.metrics.f1;
    metrics.avgMRR += e.metrics.mrr;
    metrics.overallScore += e.overallScore;
  });

  const count = evaluations.length;
  metrics.avgPrecision /= count;
  metrics.avgRecall /= count;
  metrics.avgF1 /= count;
  metrics.avgMRR /= count;
  metrics.overallScore /= count;

  return metrics;
}

/**
 * Generate evaluation report
 */
export function generateReport(
  metrics: ReturnType<typeof calculateMetrics>,
  evaluations: EvaluationResult[]
): string {
  const lines = [
    '# RAG Pipeline Evaluation Report',
    '',
    '## Overall Metrics',
    `- Average Precision: ${(metrics.avgPrecision * 100).toFixed(2)}%`,
    `- Average Recall: ${(metrics.avgRecall * 100).toFixed(2)}%`,
    `- Average F1 Score: ${(metrics.avgF1 * 100).toFixed(2)}%`,
    `- Average MRR: ${(metrics.avgMRR * 100).toFixed(2)}%`,
    `- Overall Quality Score: ${(metrics.overallScore * 100).toFixed(2)}%`,
    '',
    '## Detailed Results',
    '',
  ];

  evaluations.forEach((e, i) => {
    lines.push(`### Query ${i + 1}: ${e.query}`);
    lines.push(`- Retrieval Score: ${(e.retrievalScore * 100).toFixed(2)}%`);
    lines.push(`- Answer Score: ${(e.answerScore * 100).toFixed(2)}%`);
    lines.push(`- Overall: ${(e.overallScore * 100).toFixed(2)}%`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key information (numbers, currency, dates) from text
 */
function extractKeyInfo(text: string): string[] {
  const patterns = [
    /\$[\d,]+(?:\.\d+)?\s*(?:million|billion|k)?/gi, // Currency
    /\d+(?:\.\d+)?%?/g, // Numbers and percentages
    /\b(?:Q[1-4]|20\d{2})\b/g, // Quarters and years
  ];

  const results: string[] = [];
  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      results.push(...matches);
    }
  });

  return [...new Set(results)];
}

/**
 * Benchmark retrieval performance
 */
export async function benchmarkRetrieval(
  queries: string[],
  retrievalFn: (query: string) => Promise<RetrievalResult[]>
): Promise<{
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}> {
  const latencies: number[] = [];

  for (const query of queries) {
    const start = performance.now();
    await retrievalFn(query);
    const end = performance.now();
    latencies.push(end - start);
  }

  const sorted = latencies.sort((a, b) => a - b);
  const n = sorted.length;

  return {
    avgLatency: latencies.reduce((a, b) => a + b, 0) / n,
    p50Latency: sorted[Math.floor(n * 0.5)],
    p95Latency: sorted[Math.floor(n * 0.95)],
    p99Latency: sorted[Math.floor(n * 0.99)],
  };
}

/**
 * Create confusion matrix for retrieval evaluation
 */
export function createConfusionMatrix(
  retrieved: RetrievalResult[],
  relevantIds: string[],
  allDocIds: string[]
): {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
} {
  const retrievedIds = new Set(retrieved.map((r) => r.id));
  const relevantSet = new Set(relevantIds);
  const allSet = new Set(allDocIds);

  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;

  for (const docId of allSet) {
    const isRetrieved = retrievedIds.has(docId);
    const isRelevant = relevantSet.has(docId);

    if (isRetrieved && isRelevant) tp++;
    else if (isRetrieved && !isRelevant) fp++;
    else if (!isRetrieved && !isRelevant) tn++;
    else if (!isRetrieved && isRelevant) fn++;
  }

  return { truePositives: tp, falsePositives: fp, trueNegatives: tn, falseNegatives: fn };
}
