/**
 * Agent Analytics System
 *
 * Tracks agent performance metrics including:
 * - Completion rates
 * - Tool usage statistics
 * - Reasoning quality metrics
 * - Performance over time
 */

// ============================================================================
// Types
// ============================================================================

export interface AgentSessionMetrics {
  sessionId: string;
  userId: string;
  workspaceId?: string;
  startTime: Date;
  endTime?: Date;
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  totalSteps: number;
  totalToolCalls: number;
  averageLatency: number;
  totalTokensUsed: number;
}

export interface AgentQueryMetrics {
  queryId: string;
  sessionId?: string;
  userId: string;
  workspaceId?: string;
  query: string;
  queryType: string;
  strategy: string;
  success: boolean;
  steps: number;
  toolCalls: number;
  latency: number;
  tokensUsed:
    | {
        prompt: number;
        completion: number;
        total: number;
      }
    | {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
  toolUsage: Record<string, number>;
  errorType?: string;
  terminated?: boolean;
  terminationReason?: string;
  timestamp: Date;
}

export interface ToolUsageStats {
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatency: number;
  successRate: number;
  lastUsed: Date;
}

export interface ReasoningQualityMetrics {
  averageStepsPerQuery: number;
  maxStepsUsed: number;
  earlyTerminations: number;
  maxIterationsReached: number;
  stepEfficiency: number; // (optimal steps / actual steps)
}

export interface AgentPerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  overview: {
    totalSessions: number;
    totalQueries: number;
    completionRate: number;
    averageLatency: number;
    totalTokensUsed: number;
  };
  toolUsage: ToolUsageStats[];
  reasoningQuality: ReasoningQualityMetrics;
  topQueries: Array<{
    query: string;
    count: number;
    averageLatency: number;
  }>;
  errorBreakdown: Record<string, number>;
  dailyTrends: Array<{
    date: string;
    queries: number;
    completionRate: number;
    averageLatency: number;
  }>;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

const sessionsStore = new Map<string, AgentSessionMetrics>();
const queriesStore: AgentQueryMetrics[] = [];
const toolUsageStore: Array<{
  toolName: string;
  success: boolean;
  latency: number;
  userId: string;
  workspaceId?: string;
  timestamp: Date;
}> = [];

// ============================================================================
// Agent Analytics Tracker
// ============================================================================

export class AgentAnalytics {
  private currentSession?: AgentSessionMetrics;

  /**
   * Start a new agent session
   */
  startSession(userId: string, workspaceId?: string): string {
    const sessionId = crypto.randomUUID();

    this.currentSession = {
      sessionId,
      userId,
      workspaceId,
      startTime: new Date(),
      totalQueries: 0,
      completedQueries: 0,
      failedQueries: 0,
      totalSteps: 0,
      totalToolCalls: 0,
      averageLatency: 0,
      totalTokensUsed: 0,
    };

    sessionsStore.set(sessionId, this.currentSession);
    return sessionId;
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession = undefined;
  }

  /**
   * Track a query execution
   */
  async trackQuery(metrics: AgentQueryMetrics): Promise<void> {
    // Update session metrics
    if (this.currentSession) {
      this.currentSession.totalQueries++;
      if (metrics.success) {
        this.currentSession.completedQueries++;
      } else {
        this.currentSession.failedQueries++;
      }
      this.currentSession.totalSteps += metrics.steps;
      this.currentSession.totalToolCalls += metrics.toolCalls;

      // Get total tokens
      let totalTokens = 0;
      if ('total' in metrics.tokensUsed) {
        totalTokens = metrics.tokensUsed.total;
      } else {
        totalTokens = metrics.tokensUsed.totalTokens;
      }
      this.currentSession.totalTokensUsed += totalTokens;

      // Update running average latency
      const totalLatency =
        this.currentSession.averageLatency * (this.currentSession.totalQueries - 1) +
        metrics.latency;
      this.currentSession.averageLatency = totalLatency / this.currentSession.totalQueries;
    }

    // Store query metrics
    queriesStore.push(metrics);
  }

  /**
   * Track a tool call
   */
  async trackToolCall(
    toolName: string,
    success: boolean,
    latency: number,
    userId: string,
    workspaceId?: string
  ): Promise<void> {
    toolUsageStore.push({
      toolName,
      success,
      latency,
      userId,
      workspaceId,
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // Analytics Queries
  // ============================================================================

  /**
   * Get tool usage statistics
   */
  async getToolUsageStats(
    userId?: string,
    workspaceId?: string,
    days: number = 30
  ): Promise<ToolUsageStats[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Filter by user/workspace and date
    const filteredUsages = toolUsageStore.filter((usage) => {
      if (userId && usage.userId !== userId) return false;
      if (workspaceId && usage.workspaceId !== workspaceId) return false;
      return usage.timestamp >= since;
    });

    // Group by tool name
    const toolStats = new Map<
      string,
      {
        totalCalls: number;
        successfulCalls: number;
        totalLatency: number;
        lastUsed: Date;
      }
    >();

    for (const usage of filteredUsages) {
      const stats = toolStats.get(usage.toolName) ?? {
        totalCalls: 0,
        successfulCalls: 0,
        totalLatency: 0,
        lastUsed: usage.timestamp,
      };

      stats.totalCalls++;
      if (usage.success) stats.successfulCalls++;
      stats.totalLatency += usage.latency;
      if (usage.timestamp > stats.lastUsed) stats.lastUsed = usage.timestamp;

      toolStats.set(usage.toolName, stats);
    }

    return Array.from(toolStats.entries()).map(([toolName, stats]) => ({
      toolName,
      totalCalls: stats.totalCalls,
      successfulCalls: stats.successfulCalls,
      failedCalls: stats.totalCalls - stats.successfulCalls,
      averageLatency: Math.round((stats.totalLatency / stats.totalCalls) * 100) / 100,
      successRate: Math.round((stats.successfulCalls / stats.totalCalls) * 100) / 100,
      lastUsed: stats.lastUsed,
    }));
  }

  /**
   * Get reasoning quality metrics
   */
  async getReasoningQualityMetrics(
    userId?: string,
    workspaceId?: string,
    days: number = 30
  ): Promise<ReasoningQualityMetrics> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Filter queries
    const filteredQueries = queriesStore.filter((q) => {
      if (userId && q.userId !== userId) return false;
      if (workspaceId && q.workspaceId !== workspaceId) return false;
      return q.timestamp >= since;
    });

    if (filteredQueries.length === 0) {
      return {
        averageStepsPerQuery: 0,
        maxStepsUsed: 0,
        earlyTerminations: 0,
        maxIterationsReached: 0,
        stepEfficiency: 0,
      };
    }

    const totalSteps = filteredQueries.reduce((sum, q) => sum + q.steps, 0);
    const maxSteps = Math.max(...filteredQueries.map((q) => q.steps));
    const earlyTerminations = filteredQueries.filter(
      (q) => q.terminated && q.terminationReason?.includes('confidence')
    ).length;
    const maxIterationsReached = filteredQueries.filter(
      (q) => q.terminated && q.terminationReason?.includes('Max iterations')
    ).length;

    // Estimate step efficiency
    const successfulQueries = filteredQueries.filter((q) => q.success);
    const avgStepsSuccessful =
      successfulQueries.length > 0
        ? successfulQueries.reduce((sum, q) => sum + q.steps, 0) / successfulQueries.length
        : 0;
    const stepEfficiency =
      avgStepsSuccessful > 0 ? Math.max(0.5, 1 - (avgStepsSuccessful - 2) / 10) : 0;

    return {
      averageStepsPerQuery: Math.round((totalSteps / filteredQueries.length) * 100) / 100,
      maxStepsUsed: maxSteps,
      earlyTerminations,
      maxIterationsReached,
      stepEfficiency: Math.round(stepEfficiency * 100) / 100,
    };
  }

  /**
   * Get performance report for a time period
   */
  async getPerformanceReport(
    startDate: Date,
    endDate: Date,
    userId?: string,
    workspaceId?: string
  ): Promise<AgentPerformanceReport> {
    // Get sessions
    const sessions = Array.from(sessionsStore.values()).filter((s) => {
      if (userId && s.userId !== userId) return false;
      if (workspaceId && s.workspaceId !== workspaceId) return false;
      return s.startTime >= startDate && s.startTime <= endDate;
    });

    // Get queries
    const queries = queriesStore.filter((q) => {
      if (userId && q.userId !== userId) return false;
      if (workspaceId && q.workspaceId !== workspaceId) return false;
      return q.timestamp >= startDate && q.timestamp <= endDate;
    });

    // Calculate overview metrics
    const totalQueries = queries.length;
    const completedQueries = queries.filter((q) => q.success).length;
    const totalLatency = queries.reduce((sum, q) => sum + q.latency, 0);

    // Calculate total tokens
    const totalTokens = queries.reduce((sum, q) => {
      if ('total' in q.tokensUsed) {
        return sum + q.tokensUsed.total;
      } else {
        return sum + q.tokensUsed.totalTokens;
      }
    }, 0);

    // Get tool usage stats
    const toolUsage = await this.getToolUsageStats(
      userId,
      workspaceId,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Get reasoning quality
    const reasoningQuality = await this.getReasoningQualityMetrics(
      userId,
      workspaceId,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Get top queries (by frequency)
    const queryFrequency: Record<string, { count: number; totalLatency: number }> = {};
    for (const query of queries) {
      const key = query.query.toLowerCase().trim();
      if (!queryFrequency[key]) {
        queryFrequency[key] = { count: 0, totalLatency: 0 };
      }
      queryFrequency[key].count++;
      queryFrequency[key].totalLatency += query.latency;
    }

    const topQueries = Object.entries(queryFrequency)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([query, stats]) => ({
        query: query.length > 100 ? `${query.substring(0, 100)}...` : query,
        count: stats.count,
        averageLatency: Math.round((stats.totalLatency / stats.count) * 100) / 100,
      }));

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    for (const query of queries) {
      if (query.errorType) {
        errorBreakdown[query.errorType] = (errorBreakdown[query.errorType] ?? 0) + 1;
      }
    }

    // Daily trends
    const dailyData: Record<string, { queries: number; completed: number; latency: number }> = {};
    for (const query of queries) {
      const date = query.timestamp.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { queries: 0, completed: 0, latency: 0 };
      }
      dailyData[date].queries++;
      if (query.success) dailyData[date].completed++;
      dailyData[date].latency += query.latency;
    }

    const dailyTrends = Object.entries(dailyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({
        date,
        queries: stats.queries,
        completionRate: Math.round((stats.completed / stats.queries) * 1000) / 10,
        averageLatency: Math.round((stats.latency / stats.queries) * 100) / 100,
      }));

    return {
      period: { start: startDate, end: endDate },
      overview: {
        totalSessions: sessions.length,
        totalQueries,
        completionRate:
          totalQueries > 0 ? Math.round((completedQueries / totalQueries) * 1000) / 10 : 0,
        averageLatency:
          totalQueries > 0 ? Math.round((totalLatency / totalQueries) * 100) / 100 : 0,
        totalTokensUsed: totalTokens,
      },
      toolUsage,
      reasoningQuality,
      topQueries,
      errorBreakdown,
      dailyTrends,
    };
  }

  /**
   * Get real-time agent stats
   */
  async getRealtimeStats(
    userId?: string,
    workspaceId?: string
  ): Promise<{
    activeSessions: number;
    queriesLastHour: number;
    averageLatencyLastHour: number;
    toolCallsLastHour: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count active sessions (no end time)
    const activeSessions = Array.from(sessionsStore.values()).filter((s) => {
      if (userId && s.userId !== userId) return false;
      if (workspaceId && s.workspaceId !== workspaceId) return false;
      return !s.endTime;
    }).length;

    // Count queries in last hour
    const recentQueries = queriesStore.filter((q) => {
      if (userId && q.userId !== userId) return false;
      if (workspaceId && q.workspaceId !== workspaceId) return false;
      return q.timestamp >= oneHourAgo;
    });

    const queriesLastHour = recentQueries.length;
    const averageLatencyLastHour =
      queriesLastHour > 0
        ? Math.round(
            (recentQueries.reduce((sum, q) => sum + q.latency, 0) / queriesLastHour) * 100
          ) / 100
        : 0;

    // Count tool calls in last hour
    const toolCallsLastHour = toolUsageStore.filter((t) => {
      if (userId && t.userId !== userId) return false;
      if (workspaceId && t.workspaceId !== workspaceId) return false;
      return t.timestamp >= oneHourAgo;
    }).length;

    return {
      activeSessions,
      queriesLastHour,
      averageLatencyLastHour,
      toolCallsLastHour,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAgentAnalytics(): AgentAnalytics {
  return new AgentAnalytics();
}

// Singleton instance for global tracking
let globalAnalytics: AgentAnalytics | null = null;

export function getGlobalAgentAnalytics(): AgentAnalytics {
  if (!globalAnalytics) {
    globalAnalytics = new AgentAnalytics();
  }
  return globalAnalytics;
}

// ============================================================================
// Database Schema Helper (for reference)
// ============================================================================

/*
Prisma schema extensions for agent analytics:

model AgentSession {
  id                String   @id @default(cuid())
  userId            String
  workspaceId       String?
  startTime         DateTime @default(now())
  endTime           DateTime?
  totalQueries      Int      @default(0)
  completedQueries  Int      @default(0)
  failedQueries     Int      @default(0)
  totalSteps        Int      @default(0)
  totalToolCalls    Int      @default(0)
  averageLatency    Float    @default(0)
  totalTokensUsed   Int      @default(0)

  @@index([userId])
  @@index([workspaceId])
  @@index([startTime])
  @@map("agent_sessions")
}

model AgentQuery {
  id                  String   @id @default(cuid())
  sessionId           String?
  userId              String
  workspaceId         String?
  query               String
  queryType           String
  strategy            String
  success             Boolean
  steps               Int      @default(0)
  toolCalls           Int      @default(0)
  latency             Float
  promptTokens        Int      @default(0)
  completionTokens    Int      @default(0)
  totalTokens         Int      @default(0)
  toolUsage           String?  // JSON
  errorType           String?
  terminated          Boolean  @default(false)
  terminationReason   String?
  timestamp           DateTime @default(now())

  @@index([userId])
  @@index([workspaceId])
  @@index([timestamp])
  @@index([success])
  @@map("agent_queries")
}

model AgentToolUsage {
  id          String   @id @default(cuid())
  toolName    String
  success     Boolean
  latency     Float
  userId      String
  workspaceId String?
  timestamp   DateTime @default(now())

  @@index([toolName])
  @@index([userId])
  @@index([timestamp])
  @@map("agent_tool_usage")
}
*/
