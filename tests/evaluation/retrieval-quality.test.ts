/**
 * RAG Evaluation Tests
 * 
 * Evaluates the quality of the RAG pipeline using RAGAS-inspired metrics.
 * These tests measure retrieval accuracy, answer relevance, and faithfulness.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { evaluateRetrieval, evaluateAnswer, calculateMetrics } from './utils';
import { runRAGPipeline } from '@/lib/rag/engine';
import { mockPrisma } from '@/tests/utils/mocks/prisma';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Test dataset with ground truth
const testDataset = [
  {
    query: 'What was the total revenue in 2024?',
    expectedDocs: ['annual-report-2024.pdf'],
    expectedAnswer: '$150 million',
    relevantChunks: ['chunk-1', 'chunk-2', 'chunk-3'],
  },
  {
    query: 'How much did Q1 revenue grow compared to Q2?',
    expectedDocs: ['annual-report-2024.pdf', 'quarterly-review.pdf'],
    expectedAnswer: 'Q1: $32M, Q2: $38M',
    relevantChunks: ['chunk-2', 'chunk-5'],
  },
  {
    query: 'What are the main components of operating expenses?',
    expectedDocs: ['annual-report-2024.pdf'],
    expectedAnswer: 'R&D, Sales & Marketing, G&A',
    relevantChunks: ['chunk-4'],
  },
  {
    query: 'What is the company projection for 2025?',
    expectedDocs: ['annual-report-2024.pdf'],
    expectedAnswer: '$200 million revenue target',
    relevantChunks: ['chunk-5'],
  },
  {
    query: 'Who wrote the financial report?',
    expectedDocs: ['annual-report-2024.pdf'],
    expectedAnswer: 'Finance Department',
    relevantChunks: ['chunk-metadata'],
  },
];

describe('Retrieval Quality', () => {
  beforeAll(async () => {
    // Setup: Ensure test documents are indexed
  });

  describe('Recall Metrics', () => {
    it('achieves >80% recall on test set', async () => {
      const results = await Promise.all(
        testDataset.map(async (testCase) => {
          const { context } = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
            returnContext: true,
          });

          const retrievedDocIds = [...new Set(context.map((c: any) => c.documentId))];
          const relevantRetrieved = testCase.expectedDocs.filter(doc =>
            retrievedDocIds.some(id => id.includes(doc.replace('.pdf', '')))
          );

          return {
            query: testCase.query,
            recall: relevantRetrieved.length / testCase.expectedDocs.length,
          };
        })
      );

      const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
      console.log('Recall results:', results);
      console.log('Average Recall:', avgRecall);

      expect(avgRecall).toBeGreaterThanOrEqual(0.8);
    });

    it('achieves >85% precision on test set', async () => {
      const results = await Promise.all(
        testDataset.map(async (testCase) => {
          const { context } = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
            returnContext: true,
          });

          const retrievedDocIds = [...new Set(context.map((c: any) => c.documentId))];
          const relevantRetrieved = retrievedDocIds.filter(id =>
            testCase.expectedDocs.some(doc => id.includes(doc.replace('.pdf', '')))
          );

          const precision = retrievedDocIds.length > 0
            ? relevantRetrieved.length / retrievedDocIds.length
            : 0;

          return {
            query: testCase.query,
            precision,
          };
        })
      );

      const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
      console.log('Precision results:', results);
      console.log('Average Precision:', avgPrecision);

      expect(avgPrecision).toBeGreaterThanOrEqual(0.85);
    });

    it('measures Mean Reciprocal Rank (MRR)', async () => {
      const results = await Promise.all(
        testDataset.map(async (testCase) => {
          const { context } = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
            returnContext: true,
          });

          // Find rank of first relevant document
          const firstRelevantIndex = context.findIndex((c: any) =>
            testCase.expectedDocs.some(doc =>
              c.documentId.includes(doc.replace('.pdf', ''))
            )
          );

          const mrr = firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0;

          return { query: testCase.query, mrr };
        })
      );

      const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;
      console.log('MRR results:', results);
      console.log('Average MRR:', avgMRR);

      expect(avgMRR).toBeGreaterThanOrEqual(0.7);
    });

    it('measures Normalized Discounted Cumulative Gain (NDCG)', async () => {
      const results = await Promise.all(
        testDataset.map(async (testCase) => {
          const { context } = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
            returnContext: true,
          });

          // Assign relevance scores (1 if in expected docs, 0 otherwise)
          const relevanceScores = context.map((c: any) =>
            testCase.expectedDocs.some(doc =>
              c.documentId.includes(doc.replace('.pdf', ''))
            ) ? 1 : 0
          );

          const ndcg = calculateNDCG(relevanceScores);

          return { query: testCase.query, ndcg };
        })
      );

      const avgNDCG = results.reduce((sum, r) => sum + r.ndcg, 0) / results.length;
      console.log('NDCG results:', results);
      console.log('Average NDCG:', avgNDCG);

      expect(avgNDCG).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('Answer Quality', () => {
    it('measures answer relevance', async () => {
      const results = await Promise.all(
        testDataset.map(async (testCase) => {
          const { content } = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
          });

          // Check if answer contains expected information
          const containsExpectedInfo = testCase.expectedAnswer
            .toLowerCase()
            .split(', ')
            .some(part => content.toLowerCase().includes(part.toLowerCase()));

          return {
            query: testCase.query,
            relevant: containsExpectedInfo,
          };
        })
      );

      const relevanceScore = results.filter(r => r.relevant).length / results.length;
      console.log('Answer relevance results:', results);
      console.log('Relevance Score:', relevanceScore);

      expect(relevanceScore).toBeGreaterThanOrEqual(0.9);
    });

    it('measures faithfulness to context', async () => {
      const results = await Promise.all(
        testDataset.slice(0, 3).map(async (testCase) => {
          const { content, context } = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
            returnContext: true,
          });

          // Check if answer claims are supported by context
          const claims = extractClaims(content);
          const supportedClaims = claims.filter(claim =>
            context.some((c: any) =>
              c.content.toLowerCase().includes(claim.toLowerCase())
            )
          );

          const faithfulness = claims.length > 0
            ? supportedClaims.length / claims.length
            : 1;

          return { query: testCase.query, faithfulness };
        })
      );

      const avgFaithfulness = results.reduce((sum, r) => sum + r.faithfulness, 0) / results.length;
      console.log('Faithfulness results:', results);
      console.log('Average Faithfulness:', avgFaithfulness);

      expect(avgFaithfulness).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Latency Metrics', () => {
    it('measures average retrieval latency', async () => {
      const latencies: number[] = [];

      for (const testCase of testDataset) {
        const start = Date.now();
        await runRAGPipeline({
          query: testCase.query,
          workspaceId: 'test-workspace',
        });
        const end = Date.now();
        latencies.push(end - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      console.log('Average Latency:', avgLatency, 'ms');
      console.log('P95 Latency:', p95Latency, 'ms');

      expect(avgLatency).toBeLessThan(5000); // 5 seconds
      expect(p95Latency).toBeLessThan(10000); // 10 seconds
    });

    it('measures time to first token', async () => {
      const testQuery = testDataset[0].query;
      
      const start = Date.now();
      const stream = await runRAGPipeline({
        query: testQuery,
        workspaceId: 'test-workspace',
        stream: true,
      });

      // Wait for first chunk
      const reader = stream.getReader();
      await reader.read();
      const firstTokenTime = Date.now() - start;
      await reader.cancel();

      console.log('Time to first token:', firstTokenTime, 'ms');

      expect(firstTokenTime).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('End-to-End Quality', () => {
    it('measures overall RAG pipeline quality score', async () => {
      const evaluations = await Promise.all(
        testDataset.map(async (testCase) => {
          const result = await runRAGPipeline({
            query: testCase.query,
            workspaceId: 'test-workspace',
            returnContext: true,
          });

          const retrievalScore = evaluateRetrieval(result.context, testCase.relevantChunks);
          const answerScore = evaluateAnswer(result.content, testCase.expectedAnswer);

          return {
            query: testCase.query,
            retrievalScore,
            answerScore,
            overallScore: (retrievalScore + answerScore) / 2,
          };
        })
      );

      const avgOverallScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length;
      console.log('End-to-end evaluations:', evaluations);
      console.log('Average Overall Score:', avgOverallScore);

      expect(avgOverallScore).toBeGreaterThanOrEqual(0.75);
    });
  });
});

// Helper functions
function calculateNDCG(relevanceScores: number[]): number {
  // Calculate DCG
  const dcg = relevanceScores.reduce((sum, score, i) => {
    return sum + score / Math.log2(i + 2);
  }, 0);

  // Calculate ideal DCG
  const idealScores = [...relevanceScores].sort((a, b) => b - a);
  const idcg = idealScores.reduce((sum, score, i) => {
    return sum + score / Math.log2(i + 2);
  }, 0);

  return idcg > 0 ? dcg / idcg : 0;
}

function extractClaims(answer: string): string[] {
  // Simple claim extraction based on sentences with numbers or key facts
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim());
  return sentences.filter(s => 
    /\d/.test(s) || // Contains number
    s.includes('$') || // Contains currency
    s.includes('%') || // Contains percentage
    s.split(' ').length > 5 // Substantial claim
  ).map(s => s.trim());
}
