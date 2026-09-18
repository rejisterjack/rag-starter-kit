/**
 * Analytics Dashboard Service
 *
 * Service class for aggregating analytics data with caching support.
 * Provides methods for time-series data, usage stats, quality metrics, and cost analysis.
 */

import { unstable_cache } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import type { DateRange } from './rag-metrics';
import {
  getRAGMetrics,
  getRetrievalQuality,
  type RAGMetrics,
  type RetrievalQualityMetrics,
} from './rag-metrics';
import {
  getModelUsage,
  getUserTokenUsages,
  projectMonthlyCost,
  type UserTokenUsage,
} from './token-tracking';

// =============================================================================
// Types
// =============================================================================

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface TimeSeriesPoint {
  timestamp: string;
  chatCount: number;
  tokenUsage: number;
  latency: number;
  errorRate: number;
}

export interface TimeSeriesData {
  points: TimeSeriesPoint[];
  granularity: Granularity;
  from: string;
  to: string;
}

export interface UsageStats {
  totalChats: number;
  totalMessages: number;
  totalTokens: number;
  avgLatency: number;
  topUsers: Array<{
    userId: string;
    name: string | null;
    email: string;
    messageCount: number;
    tokenUsage: number;
  }>;
  activeDocuments: Array<{
    documentId: string;
    documentName: string;
    queryCount: number;
    lastAccessed: Date;
  }>;
}

export interface QualityMetrics {
  avgRelevanceScore: number;
  citationAccuracy: number;
  retrievalPrecision: number;
  queryClassification: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  toolUsage: Array<{
    tool: string;
    count: number;
    successRate: number;
  }>;
  ragMetrics: RAGMetrics;
  retrievalQuality: RetrievalQualityMetrics;
}

export interface CostBreakdown {
  byModel: Array<{
    model: string;
    tokens: number;
    cost: number;
    percentage: number;
  }>;
  byUser: Array<{
    userId: string;
    name: string | null;
    email: string;
    tokens: number;
    cost: number;
  }>;
  byWorkspace: Array<{
    workspaceId: string;
    name: string;
    tokens: number;
    cost: number;
  }>;
  tokenBreakdown: {
    prompt: number;
    completion: number;
    total: number;
  };
  projection: {
    currentSpend: number;
    projectedSpend: number;
    dailyAverage: number;
    daysRemaining: number;
  };
}

export interface RealtimeMetrics {
  activeChats: number;
  recentErrors: Array<{
    id: string;
    timestamp: Date;
    error: string;
    endpoint: string;
  }>;
  liveTokenUsage: {
    tokensThisMinute: number;
    tokensThisHour: number;
    currentRate: number; // tokens per second
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// =============================================================================
// Dashboard Service Class
// =============================================================================

export class DashboardService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  // private readonly shortTTL = 30 * 1000; // 30 seconds for real-time data (reserved for future use)

  // ===========================================================================
  // Time Series Data
  // ===========================================================================

  /**
   * Get time-series metrics for a workspace
   */
  async getTimeSeriesData(
    workspaceId: string | undefined,
    from: Date,
    to: Date,
    granularity: Granularity = 'day'
  ): Promise<TimeSeriesData> {
    const cacheKey = `timeseries:${workspaceId ?? 'all'}:${from.toISOString()}:${to.toISOString()}:${granularity}`;

    // Check cache
    const cached = this.getFromCache<TimeSeriesData>(cacheKey);
    if (cached) return cached;

    const truncUnit =
      granularity === 'hour'
        ? 'hour'
        : granularity === 'week'
          ? 'week'
          : granularity === 'month'
            ? 'month'
            : 'day';

    const workspaceFilter = workspaceId
      ? Prisma.sql`AND "workspaceId" = ${workspaceId}`
      : Prisma.empty;

    const [eventBuckets, errorBuckets] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          bucket: Date;
          chat_count: number;
          token_usage: number;
          avg_latency: number;
        }>
      >`
        SELECT date_trunc(${truncUnit}, "createdAt") AS bucket,
               count(*)::int AS chat_count,
               coalesce(sum("totalTokens"), 0)::int AS token_usage,
               coalesce(avg("latencyMs"), 0)::float AS avg_latency
        FROM rag_events
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        ${workspaceFilter}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      prisma.$queryRaw<Array<{ bucket: Date; error_count: number }>>`
        SELECT date_trunc(${truncUnit}, "createdAt") AS bucket,
               count(*)::int AS error_count
        FROM audit_logs
        WHERE severity = 'ERROR'
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
        ${workspaceFilter}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ]);

    const eventMap = new Map(eventBuckets.map((row) => [row.bucket.toISOString(), row]));
    const errorMap = new Map(
      errorBuckets.map((row) => [row.bucket.toISOString(), row.error_count])
    );

    // Group by time buckets
    const buckets = this.createTimeBuckets(from, to, granularity);
    const points: TimeSeriesPoint[] = [];

    for (const bucket of buckets) {
      const bucketKey = bucket.start.toISOString();
      const aggregated = eventMap.get(bucketKey);
      const chatCount = aggregated?.chat_count ?? 0;
      const tokenUsage = aggregated?.token_usage ?? 0;
      const avgLatency = aggregated?.avg_latency ?? 0;
      const errorCount = errorMap.get(bucketKey) ?? 0;
      const errorRate = chatCount > 0 ? (errorCount / chatCount) * 100 : 0;

      points.push({
        timestamp: bucket.start.toISOString(),
        chatCount,
        tokenUsage,
        latency: Math.round(avgLatency),
        errorRate: Math.round(errorRate * 100) / 100,
      });
    }

    const result: TimeSeriesData = {
      points,
      granularity,
      from: from.toISOString(),
      to: to.toISOString(),
    };

    // Cache result
    this.setCache(cacheKey, result, this.defaultTTL);

    return result;
  }

  // ===========================================================================
  // Usage Statistics
  // ===========================================================================

  /**
   * Get comprehensive usage statistics
   */
  async getUsageStats(
    workspaceId: string | undefined,
    from?: Date,
    to?: Date
  ): Promise<UsageStats> {
    const cacheKey = `usage:${workspaceId ?? 'all'}:${from?.toISOString() ?? 'all'}:${to?.toISOString() ?? 'all'}`;

    const cached = this.getFromCache<UsageStats>(cacheKey);
    if (cached) return cached;

    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.gte = from;
      if (to) dateFilter.createdAt.lte = to;
    }

    // Build where clauses
    const chatWhere = workspaceId
      ? { workspaceId, ...dateFilter }
      : dateFilter.createdAt
        ? { createdAt: dateFilter.createdAt }
        : {};

    const messageWhere = workspaceId
      ? {
          chat: { workspaceId },
          ...(dateFilter.createdAt && { createdAt: dateFilter.createdAt }),
        }
      : dateFilter.createdAt
        ? { createdAt: dateFilter.createdAt }
        : {};

    // Get counts
    const [totalChats, totalMessages, ragEvents] = await Promise.all([
      prisma.chat.count({ where: chatWhere }),
      prisma.message.count({ where: messageWhere }),
      prisma.rAGEvent.findMany({
        where: workspaceId
          ? { workspaceId, ...(dateFilter.createdAt && { createdAt: dateFilter.createdAt }) }
          : dateFilter.createdAt
            ? { createdAt: dateFilter.createdAt }
            : {},
        select: { totalTokens: true, latencyMs: true },
      }),
    ]);

    const totalTokens = ragEvents.reduce(
      (sum: number, e: { totalTokens: number }) => sum + e.totalTokens,
      0
    );
    const avgLatency =
      ragEvents.length > 0
        ? ragEvents.reduce((sum: number, e: { latencyMs: number }) => sum + e.latencyMs, 0) /
          ragEvents.length
        : 0;

    // Get top users
    const topUsers = await this.getTopUsers(workspaceId, from, to);

    // Get active documents
    const activeDocuments = await this.getActiveDocuments(workspaceId, from, to);

    const result: UsageStats = {
      totalChats,
      totalMessages,
      totalTokens,
      avgLatency: Math.round(avgLatency),
      topUsers,
      activeDocuments,
    };

    this.setCache(cacheKey, result, this.defaultTTL);

    return result;
  }

  // ===========================================================================
  // Quality Metrics
  // ===========================================================================

  /**
   * Get RAG quality metrics
   */
  async getQualityMetrics(
    workspaceId: string | undefined,
    from?: Date,
    to?: Date
  ): Promise<QualityMetrics> {
    const cacheKey = `quality:${workspaceId ?? 'all'}:${from?.toISOString() ?? 'all'}:${to?.toISOString() ?? 'all'}`;

    const cached = this.getFromCache<QualityMetrics>(cacheKey);
    if (cached) return cached;

    const dateRange: DateRange = {
      start: from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: to ?? new Date(),
    };

    // Build where clause for query classification
    const where: {
      createdAt?: { gte: Date; lte: Date };
      workspaceId?: string;
    } = {};

    if (from || to) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Get query classification distribution
    const queryTypes = await prisma.rAGEvent.groupBy({
      by: ['queryType'],
      where,
      _count: { queryType: true },
    });

    const totalQueries = queryTypes.reduce(
      (sum: number, qt: { _count: { queryType: number } }) => sum + qt._count.queryType,
      0
    );

    const queryClassification = queryTypes.map((qt) => ({
      type: qt.queryType ?? 'unknown',
      count: qt._count.queryType,
      percentage:
        totalQueries > 0 ? Math.round((qt._count.queryType / totalQueries) * 1000) / 10 : 0,
    }));

    // Get tool usage from audit logs
    const toolEvents = await prisma.auditLog.findMany({
      where: {
        event: 'AGENT_TOOL_CALLED',
        ...(workspaceId && { workspaceId }),
        ...(from && { createdAt: { gte: from } }),
        ...(to && { createdAt: { lte: to } }),
      },
      select: { metadata: true, createdAt: true },
    });

    const toolMap = new Map<string, { count: number; successes: number }>();
    for (const event of toolEvents) {
      const metadata = event.metadata as { tool?: string; success?: boolean } | null;
      const tool = metadata?.tool ?? 'unknown';
      const existing = toolMap.get(tool) ?? { count: 0, successes: 0 };
      existing.count++;
      if (metadata?.success) existing.successes++;
      toolMap.set(tool, existing);
    }

    const toolUsage = Array.from(toolMap.entries()).map(([tool, data]) => ({
      tool,
      count: data.count,
      successRate: data.count > 0 ? Math.round((data.successes / data.count) * 1000) / 10 : 0,
    }));

    // Get RAG metrics and retrieval quality (only if workspaceId provided)
    let ragMetrics: RAGMetrics = {
      totalQueries: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      avgTokenUsage: 0,
      retrievalAccuracy: 0,
      userSatisfaction: 0,
    };

    let retrievalQuality: RetrievalQualityMetrics = {
      avgSimilarity: 0,
      minSimilarity: 0,
      maxSimilarity: 0,
      topKAccuracy: 0,
      mrr: 0,
      ndcg: 0,
    };

    if (workspaceId) {
      [ragMetrics, retrievalQuality] = await Promise.all([
        getRAGMetrics(workspaceId, dateRange),
        getRetrievalQuality(workspaceId, dateRange),
      ]);
    }

    // Calculate citation accuracy (based on retrieved chunks with high similarity)
    const chunks = await prisma.retrievedChunk.findMany({
      where: {
        event: {
          ...(workspaceId && { workspaceId }),
          ...(from && { createdAt: { gte: from } }),
          ...(to && { createdAt: { lte: to } }),
        },
      },
      select: { similarity: true },
    });

    const citationAccuracy =
      chunks.length > 0
        ? chunks.filter((c: { similarity: number }) => c.similarity > 0.8).length / chunks.length
        : 0;

    const result: QualityMetrics = {
      avgRelevanceScore: retrievalQuality.avgSimilarity,
      citationAccuracy: Math.round(citationAccuracy * 1000) / 10,
      retrievalPrecision: retrievalQuality.topKAccuracy,
      queryClassification,
      toolUsage,
      ragMetrics,
      retrievalQuality,
    };

    this.setCache(cacheKey, result, this.defaultTTL);

    return result;
  }

  // ===========================================================================
  // Cost Analysis
  // ===========================================================================

  /**
   * Get comprehensive cost analysis
   */
  async getCostAnalysis(
    workspaceId: string | undefined,
    from?: Date,
    to?: Date
  ): Promise<CostBreakdown> {
    const cacheKey = `cost:${workspaceId ?? 'all'}:${from?.toISOString() ?? 'all'}:${to?.toISOString() ?? 'all'}`;

    const cached = this.getFromCache<CostBreakdown>(cacheKey);
    if (cached) return cached;

    // Get model usage
    let modelUsage: Array<{
      model: string;
      totalTokens: number;
      estimatedCost: number;
      requestCount: number;
    }> = [];

    if (workspaceId) {
      modelUsage = await getModelUsage(workspaceId, from, to);
    } else {
      // Aggregate across all workspaces using groupBy (avoid N+1 full table scans)
      const grouped = await prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: {
          ...(from && { createdAt: { gte: from } }),
          ...(to && { createdAt: { lte: to } }),
        },
        _sum: { tokensTotal: true },
        _count: { _all: true },
      });

      modelUsage = grouped.map((row) => ({
        model: row.endpoint || 'default',
        totalTokens: row._sum.tokensTotal ?? 0,
        estimatedCost: Math.round((row._sum.tokensTotal ?? 0) * 0.000001 * 100) / 100,
        requestCount: row._count._all,
      }));
    }

    const totalCost = modelUsage.reduce((sum, m) => sum + m.estimatedCost, 0);

    const byModel = modelUsage.map((m) => ({
      model: m.model,
      tokens: m.totalTokens,
      cost: m.estimatedCost,
      percentage: totalCost > 0 ? Math.round((m.estimatedCost / totalCost) * 1000) / 10 : 0,
    }));

    // Get user costs
    let userUsages: UserTokenUsage[] = [];
    if (workspaceId) {
      userUsages = await getUserTokenUsages(workspaceId, from, to);
    } else {
      const groupedUsers = await prisma.apiUsage.groupBy({
        by: ['userId'],
        where: {
          ...(from && { createdAt: { gte: from } }),
          ...(to && { createdAt: { lte: to } }),
        },
        _sum: { tokensTotal: true },
        _count: { _all: true },
      });

      userUsages = groupedUsers.map((row) => ({
        userId: row.userId ?? 'unknown',
        totalTokens: row._sum.tokensTotal ?? 0,
        estimatedCost: Math.round((row._sum.tokensTotal ?? 0) * 0.000001 * 100) / 100,
        queryCount: row._count._all,
      }));
    }

    // Get user details
    const userIds = userUsages.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const byUser = userUsages.map((u) => {
      const user = users.find((user) => user.id === u.userId);
      return {
        userId: u.userId,
        name: user?.name ?? null,
        email: user?.email ?? 'Unknown',
        tokens: u.totalTokens,
        cost: u.estimatedCost,
      };
    });

    // Get workspace costs
    let byWorkspace: CostBreakdown['byWorkspace'] = [];
    if (!workspaceId) {
      // Note: tokenUsage model not in schema - using apiUsage instead
      const workspaceUsage = await prisma.apiUsage.groupBy({
        by: ['workspaceId'],
        where: {
          ...(from && { createdAt: { gte: from } }),
          ...(to && { createdAt: { lte: to } }),
        },
        _sum: { tokensTotal: true },
      });

      const workspaceIds = workspaceUsage
        .map((w) => w.workspaceId)
        .filter((id): id is string => id !== null);
      const workspaces = await prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, name: true },
      });

      byWorkspace = workspaceUsage
        .filter((w): w is typeof w & { workspaceId: string } => w.workspaceId !== null)
        .map((w) => {
          const workspace = workspaces.find((ws) => ws.id === w.workspaceId);
          return {
            workspaceId: w.workspaceId,
            name: workspace?.name ?? 'Unknown',
            tokens: w._sum.tokensTotal ?? 0,
            cost: Math.round((w._sum.tokensTotal ?? 0) * 0.000001 * 100) / 100,
          };
        });
    }

    // Get token breakdown
    // Note: tokenUsage model not in schema - using apiUsage instead
    const tokenUsage = await prisma.apiUsage.findMany({
      where: {
        ...(workspaceId && { workspaceId }),
        ...(from && { createdAt: { gte: from } }),
        ...(to && { createdAt: { lte: to } }),
      },
      select: { tokensPrompt: true, tokensCompletion: true, tokensTotal: true },
    });

    const tokenBreakdown = {
      prompt: tokenUsage.reduce(
        (sum: number, t: { tokensPrompt: number }) => sum + t.tokensPrompt,
        0
      ),
      completion: tokenUsage.reduce(
        (sum: number, t: { tokensCompletion: number }) => sum + t.tokensCompletion,
        0
      ),
      total: tokenUsage.reduce((sum: number, t: { tokensTotal: number }) => sum + t.tokensTotal, 0),
    };

    // Get projection (only if workspaceId provided)
    let projection: CostBreakdown['projection'] = {
      currentSpend: totalCost,
      projectedSpend: totalCost,
      dailyAverage: 0,
      daysRemaining: 0,
    };

    if (workspaceId) {
      projection = await projectMonthlyCost(workspaceId);
    }

    const result: CostBreakdown = {
      byModel,
      byUser,
      byWorkspace,
      tokenBreakdown,
      projection,
    };

    this.setCache(cacheKey, result, this.defaultTTL);

    return result;
  }

  // ===========================================================================
  // Real-time Metrics
  // ===========================================================================

  /**
   * Get real-time metrics (low cache TTL)
   */
  async getRealtimeMetrics(workspaceId: string | undefined): Promise<RealtimeMetrics> {
    const cacheKey = `realtime:${workspaceId ?? 'all'}`;

    const cached = this.getFromCache<RealtimeMetrics>(cacheKey);
    if (cached) return cached;

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get active chats (chats with activity in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeChatsWhere = workspaceId
      ? { workspaceId, updatedAt: { gte: fiveMinutesAgo } }
      : { updatedAt: { gte: fiveMinutesAgo } };

    const activeChats = await prisma.chat.count({
      where: activeChatsWhere,
    });

    // Get recent errors from audit logs
    const recentErrors = await prisma.auditLog.findMany({
      where: {
        severity: 'ERROR',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        ...(workspaceId && { workspaceId }),
      },
      select: { id: true, createdAt: true, event: true, metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get live token usage - using apiUsage instead of tokenUsage
    const minuteUsage = await prisma.apiUsage.aggregate({
      where: {
        ...(workspaceId && { workspaceId }),
        createdAt: { gte: oneMinuteAgo },
      },
      _sum: { tokensTotal: true },
    });

    const hourUsage = await prisma.apiUsage.aggregate({
      where: {
        ...(workspaceId && { workspaceId }),
        createdAt: { gte: oneHourAgo },
      },
      _sum: { tokensTotal: true },
    });

    const tokensThisMinute = (minuteUsage._sum as { tokensTotal?: number }).tokensTotal ?? 0;
    const tokensThisHour = (hourUsage._sum as { tokensTotal?: number }).tokensTotal ?? 0;
    const currentRate = tokensThisMinute / 60; // tokens per second
    void tokensThisHour;
    void currentRate;

    const result: RealtimeMetrics = {
      activeChats,
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        timestamp: e.createdAt,
        error: 'Unknown error',
        endpoint: (e.metadata as { endpoint?: string })?.endpoint ?? 'unknown',
      })),
      liveTokenUsage: {
        tokensThisMinute,
        tokensThisHour,
        currentRate,
      },
    };
    this.setCache(cacheKey, result, 30 * 1000);
    return result;
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific workspace
   */
  clearWorkspaceCache(workspaceId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(`:${workspaceId}:`) || key.includes(`:${workspaceId}-`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private createTimeBuckets(
    from: Date,
    to: Date,
    granularity: Granularity
  ): Array<{ start: Date; end: Date }> {
    const buckets: Array<{ start: Date; end: Date }> = [];
    let current = new Date(from);

    const intervalMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }[granularity];

    while (current < to) {
      const end = new Date(current.getTime() + intervalMs);
      buckets.push({ start: new Date(current), end: end > to ? to : end });
      current = end;
    }

    return buckets;
  }

  private async getTopUsers(
    workspaceId: string | undefined,
    from?: Date,
    to?: Date
  ): Promise<UsageStats['topUsers']> {
    const messageFilter = {
      role: 'USER' as const,
      ...(from && { createdAt: { gte: from } }),
      ...(to && { createdAt: { lte: to } }),
    };

    const [perUserMessages, tokenByUser] = await Promise.all([
      prisma.chat.groupBy({
        by: ['userId'],
        where: {
          ...(workspaceId ? { workspaceId } : {}),
          messages: { some: messageFilter },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.apiUsage.groupBy({
        by: ['userId'],
        where: {
          ...(workspaceId ? { workspaceId } : {}),
          userId: { not: null },
          ...(from && { createdAt: { gte: from } }),
          ...(to && { createdAt: { lte: to } }),
        },
        _sum: { tokensTotal: true },
      }),
    ]);

    const tokenMap = new Map(
      tokenByUser
        .filter((row): row is typeof row & { userId: string } => row.userId !== null)
        .map((row) => [row.userId, row._sum.tokensTotal ?? 0])
    );

    const userIds = perUserMessages.map((row) => row.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    return perUserMessages
      .map((row) => {
        const user = users.find((u) => u.id === row.userId);
        return {
          userId: row.userId,
          name: user?.name ?? null,
          email: user?.email ?? 'Unknown',
          messageCount: row._count._all ?? 0,
          tokenUsage: tokenMap.get(row.userId) ?? 0,
        };
      })
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);
  }

  private async getActiveDocuments(
    workspaceId: string | undefined,
    from?: Date,
    to?: Date
  ): Promise<UsageStats['activeDocuments']> {
    const where: {
      workspaceId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (workspaceId) where.workspaceId = workspaceId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const chunks = await prisma.retrievedChunk.findMany({
      where: {
        event: where,
      },
      select: { documentId: true, event: { select: { createdAt: true } } },
    });

    // Aggregate by document
    const docMap = new Map<string, { queryCount: number; lastAccessed: Date }>();
    for (const chunk of chunks) {
      const existing = docMap.get(chunk.documentId) ?? {
        queryCount: 0,
        lastAccessed: new Date(0),
      };
      existing.queryCount++;
      if (chunk.event.createdAt > existing.lastAccessed) {
        existing.lastAccessed = chunk.event.createdAt;
      }
      docMap.set(chunk.documentId, existing);
    }

    // Get document names
    const documentIds = Array.from(docMap.keys());
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, name: true },
    });

    return Array.from(docMap.entries())
      .map(([documentId, data]) => {
        const doc = documents.find((d) => d.id === documentId);
        return {
          documentId,
          documentName: doc?.name ?? 'Unknown Document',
          queryCount: data.queryCount,
          lastAccessed: data.lastAccessed,
        };
      })
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let dashboardService: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (!dashboardService) {
    dashboardService = new DashboardService();
  }
  return dashboardService;
}

// =============================================================================
// Convenience Exports
// =============================================================================

export async function getTimeSeriesData(
  workspaceId: string | undefined,
  from: Date,
  to: Date,
  granularity?: Granularity
): Promise<TimeSeriesData> {
  return unstable_cache(
    () => getDashboardService().getTimeSeriesData(workspaceId, from, to, granularity),
    [
      'timeseries-data',
      workspaceId ?? 'all',
      from.toISOString(),
      to.toISOString(),
      granularity ?? 'day',
    ],
    { revalidate: 300, tags: [`analytics-${workspaceId ?? 'global'}`] }
  )();
}

export async function getUsageStats(
  workspaceId: string | undefined,
  from?: Date,
  to?: Date
): Promise<UsageStats> {
  return unstable_cache(
    () => getDashboardService().getUsageStats(workspaceId, from, to),
    ['usage-stats', workspaceId ?? 'all', from?.toISOString() ?? '', to?.toISOString() ?? ''],
    { revalidate: 300, tags: [`analytics-${workspaceId ?? 'global'}`] }
  )();
}

export async function getQualityMetrics(
  workspaceId: string | undefined,
  from?: Date,
  to?: Date
): Promise<QualityMetrics> {
  return unstable_cache(
    () => getDashboardService().getQualityMetrics(workspaceId, from, to),
    ['quality-metrics', workspaceId ?? 'all', from?.toISOString() ?? '', to?.toISOString() ?? ''],
    { revalidate: 300, tags: [`analytics-${workspaceId ?? 'global'}`] }
  )();
}

export async function getCostAnalysis(
  workspaceId: string | undefined,
  from?: Date,
  to?: Date
): Promise<CostBreakdown> {
  return unstable_cache(
    () => getDashboardService().getCostAnalysis(workspaceId, from, to),
    ['cost-analysis', workspaceId ?? 'all', from?.toISOString() ?? '', to?.toISOString() ?? ''],
    { revalidate: 300, tags: [`analytics-${workspaceId ?? 'global'}`] }
  )();
}

export async function getRealtimeMetrics(
  workspaceId: string | undefined
): Promise<RealtimeMetrics> {
  return getDashboardService().getRealtimeMetrics(workspaceId);
}
