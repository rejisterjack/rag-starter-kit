/**
 * RAG Metrics & Analytics
 *
 * Tracks and analyzes RAG pipeline performance, retrieval accuracy,
 * and user engagement metrics.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Source } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface RAGEvent {
  query: string;
  conversationId: string;
  workspaceId: string;
  userId: string;
  retrievedChunks: Array<{
    chunkId: string;
    documentId: string;
    similarity: number;
    rank: number;
  }>;
  response: string;
  latencyMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  queryType?: string;
  confidence?: number;
  reranked?: boolean;
}

export interface RAGMetrics {
  totalQueries: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  avgTokenUsage: number;
  retrievalAccuracy: number;
  userSatisfaction: number;
}

export enum MetricType {
  QUERY_CLASSIFICATION = 'query_classification',
  RETRIEVAL_LATENCY = 'retrieval_latency',
  GENERATION_LATENCY = 'generation_latency',
  TOTAL_LATENCY = 'total_latency',
  TOKEN_USAGE = 'token_usage',
  RETRIEVAL_ACCURACY = 'retrieval_accuracy',
  USER_SATISFACTION = 'user_satisfaction',
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface RetrievalQualityMetrics {
  avgSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  topKAccuracy: number;
  mrr: number; // Mean Reciprocal Rank
  ndcg: number; // Normalized Discounted Cumulative Gain
}

// ============================================================================
// Event Tracking
// ============================================================================

/**
 * Track a RAG pipeline execution event
 */
export async function trackRAGMetrics(event: RAGEvent): Promise<void> {
  try {
    await prisma.rAGEvent.create({
      data: {
        query: event.query,
        conversationId: event.conversationId,
        workspaceId: event.workspaceId,
        userId: event.userId,
        // responseLength field not in schema
        latencyMs: event.latencyMs,
        // Token fields not in schema - using totalTokens only
        totalTokens: event.tokenUsage.total,
        model: event.model,
        queryType: event.queryType ?? 'retrieve',
        confidence: event.confidence,
        reranked: event.reranked ?? false,
        retrievedChunks: {
          create: event.retrievedChunks.map((chunk) => ({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            similarity: chunk.similarity,
            rank: chunk.rank,
          })),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to track RAG metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Track a simplified RAG event (for quick logging)
 */
export async function trackSimpleRAGEvent(data: {
  query: string;
  conversationId: string;
  workspaceId: string;
  userId: string;
  sources: Source[];
  latency: number;
  tokenUsage: { prompt: number; completion: number; total: number };
  model: string;
}): Promise<void> {
  await trackRAGMetrics({
    query: data.query,
    conversationId: data.conversationId,
    workspaceId: data.workspaceId,
    userId: data.userId,
    retrievedChunks: data.sources.map((s, index) => ({
      chunkId: s.id,
      documentId: s.metadata.documentId,
      similarity: s.similarity ?? 0,
      rank: index + 1,
    })),
    response: '', // Not storing full response in simple tracking
    latencyMs: data.latency,
    tokenUsage: data.tokenUsage,
    model: data.model,
  });
}

// ============================================================================
// Metrics Retrieval
// ============================================================================

/**
 * Get RAG metrics for a workspace
 */
export async function getRAGMetrics(
  workspaceId: string,
  timeframe: DateRange
): Promise<RAGMetrics> {
  const events = await prisma.rAGEvent.findMany({
    where: {
      workspaceId,
      createdAt: {
        gte: timeframe.start,
        lte: timeframe.end,
      },
    },
    include: {
      retrievedChunks: true,
    },
  });

  if (events.length === 0) {
    return {
      totalQueries: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      avgTokenUsage: 0,
      retrievalAccuracy: 0,
      userSatisfaction: 0,
    };
  }

  const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
  const tokenUsages = events.map((e) => e.totalTokens);

  return {
    totalQueries: events.length,
    avgLatency: avg(latencies),
    p95Latency: percentile(latencies, 0.95),
    p99Latency: percentile(latencies, 0.99),
    avgTokenUsage: avg(tokenUsages),
    retrievalAccuracy: calculateRetrievalAccuracy(events),
    userSatisfaction: await calculateUserSatisfaction(workspaceId, timeframe),
  };
}

/**
 * Get retrieval quality metrics
 */
export async function getRetrievalQuality(
  workspaceId: string,
  timeframe: DateRange
): Promise<RetrievalQualityMetrics> {
  const chunks = await prisma.retrievedChunk.findMany({
    where: {
      event: {
        workspaceId,
        createdAt: {
          gte: timeframe.start,
          lte: timeframe.end,
        },
      },
    },
  });

  if (chunks.length === 0) {
    return {
      avgSimilarity: 0,
      minSimilarity: 0,
      maxSimilarity: 0,
      topKAccuracy: 0,
      mrr: 0,
      ndcg: 0,
    };
  }

  const similarities = chunks.map((c) => c.similarity);
  const ranks = chunks.map((c) => c.rank);

  return {
    avgSimilarity: avg(similarities),
    minSimilarity: Math.min(...similarities),
    maxSimilarity: Math.max(...similarities),
    topKAccuracy: calculateTopKAccuracy(chunks),
    mrr: calculateMRR(ranks),
    ndcg: calculateNDCG(chunks),
  };
}

/**
 * Get retrieval accuracy score
 */
export async function getRetrievalAccuracy(
  workspaceId: string,
  timeframe: DateRange
): Promise<number> {
  const quality = await getRetrievalQuality(workspaceId, timeframe);
  return quality.topKAccuracy;
}

// ============================================================================
// Dashboard Metrics
// ============================================================================

/**
 * Get metrics for the analytics dashboard
 */
export async function getDashboardMetrics(
  workspaceId: string,
  days: number = 30
): Promise<{
  overview: {
    totalQueries: number;
    uniqueUsers: number;
    avgResponseTime: number;
    totalTokens: number;
  };
  trends: Array<{
    date: string;
    queries: number;
    avgLatency: number;
  }>;
  topQueries: Array<{
    query: string;
    count: number;
    avgLatency: number;
  }>;
  modelUsage: Array<{
    model: string;
    count: number;
    tokens: number;
  }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const events = await prisma.rAGEvent.findMany({
    where: {
      workspaceId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Overview metrics
  const uniqueUsers = new Set(events.map((e) => e.userId)).size;
  const totalTokens = events.reduce((sum, e) => sum + e.totalTokens, 0);

  // Daily trends
  const trendsMap = new Map<string, { queries: number; latencies: number[] }>();
  for (const event of events) {
    const date = event.createdAt.toISOString().split('T')[0];
    const existing = trendsMap.get(date) ?? { queries: 0, latencies: [] };
    existing.queries++;
    existing.latencies.push(event.latencyMs);
    trendsMap.set(date, existing);
  }

  const trends = Array.from(trendsMap.entries()).map(([date, data]) => ({
    date,
    queries: data.queries,
    avgLatency: avg(data.latencies),
  }));

  // Top queries (group similar queries)
  const queryCounts = new Map<string, { count: number; latencies: number[] }>();
  for (const event of events) {
    const normalized = normalizeQuery(event.query);
    const existing = queryCounts.get(normalized) ?? { count: 0, latencies: [] };
    existing.count++;
    existing.latencies.push(event.latencyMs);
    queryCounts.set(normalized, existing);
  }

  const topQueries = Array.from(queryCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([query, data]) => ({
      query,
      count: data.count,
      avgLatency: avg(data.latencies),
    }));

  // Model usage
  const modelMap = new Map<string, { count: number; tokens: number }>();
  for (const event of events) {
    const existing = modelMap.get(event.model) ?? { count: 0, tokens: 0 };
    existing.count++;
    existing.tokens += event.totalTokens;
    modelMap.set(event.model, existing);
  }

  const modelUsage = Array.from(modelMap.entries()).map(([model, data]) => ({
    model,
    count: data.count,
    tokens: data.tokens,
  }));

  return {
    overview: {
      totalQueries: events.length,
      uniqueUsers,
      avgResponseTime: events.length > 0 ? avg(events.map((e) => e.latencyMs)) : 0,
      totalTokens,
    },
    trends,
    topQueries,
    modelUsage,
  };
}

// ============================================================================
// Simple Metric Recording
// ============================================================================

export async function recordMetric({
  type,
  value,
  labels,
}: {
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
}): Promise<void> {
  try {
    await prisma.metric.create({
      data: {
        type,
        value,
        labels: labels ?? {},
        timestamp: new Date(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to record metric', {
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil(sortedValues.length * p) - 1;
  return sortedValues[Math.max(0, index)];
}

function calculateRetrievalAccuracy(
  events: Array<{ retrievedChunks: Array<{ similarity: number }> }>
): number {
  if (events.length === 0) return 0;

  // Calculate based on average similarity of top retrieved chunks
  let totalAccuracy = 0;
  for (const event of events) {
    if (event.retrievedChunks.length === 0) continue;
    const topSimilarities = event.retrievedChunks.slice(0, 3).map((c) => c.similarity);
    totalAccuracy += avg(topSimilarities);
  }

  return totalAccuracy / events.length;
}

async function calculateUserSatisfaction(
  workspaceId: string,
  timeframe: DateRange
): Promise<number> {
  // This would integrate with user feedback
  // For now, use heuristics based on query patterns
  const events = await prisma.rAGEvent.findMany({
    where: {
      workspaceId,
      createdAt: {
        gte: timeframe.start,
        lte: timeframe.end,
      },
    },
  });

  if (events.length === 0) return 0;

  // Heuristic: Low latency and follow-up queries indicate satisfaction
  const avgLatency = avg(events.map((e) => e.latencyMs));
  const latencyScore = Math.max(0, 1 - avgLatency / 10000); // 10s threshold

  return Math.round(latencyScore * 100) / 100;
}

function calculateTopKAccuracy(chunks: Array<{ similarity: number; rank: number }>): number {
  if (chunks.length === 0) return 0;

  // Consider top-3 chunks with similarity > 0.7 as accurate
  const topChunks = chunks.filter((c) => c.rank <= 3);
  const accurateChunks = topChunks.filter((c) => c.similarity > 0.7);

  return topChunks.length > 0 ? accurateChunks.length / topChunks.length : 0;
}

function calculateMRR(ranks: number[]): number {
  if (ranks.length === 0) return 0;
  // Mean Reciprocal Rank: average of 1/rank for first relevant item
  return ranks.reduce((sum, r) => sum + 1 / r, 0) / ranks.length;
}

function calculateNDCG(chunks: Array<{ similarity: number; rank: number }>): number {
  if (chunks.length === 0) return 0;

  // Simplified NDCG calculation
  const dcgs = chunks.map((c) => (2 ** c.similarity - 1) / Math.log2(c.rank + 1));
  const idcgs = chunks
    .sort((a, b) => b.similarity - a.similarity)
    .map((c, i) => (2 ** c.similarity - 1) / Math.log2(i + 2));

  const dcg = dcgs.reduce((sum, v) => sum + v, 0);
  const idcg = idcgs.reduce((sum, v) => sum + v, 0);

  return idcg > 0 ? dcg / idcg : 0;
}

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

// ============================================================================
// Export
// ============================================================================

// Types are already exported above
