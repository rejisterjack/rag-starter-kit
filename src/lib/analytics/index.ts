/**
 * Analytics Module
 *
 * Exports all analytics and observability features.
 */

// Dashboard Service
export {
  type CostBreakdown,
  DashboardService,
  type Granularity,
  getCostAnalysis,
  getDashboardService,
  getQualityMetrics,
  getRealtimeMetrics,
  getTimeSeriesData,
  getUsageStats,
  type QualityMetrics,
  type RealtimeMetrics,
  type TimeSeriesData,
  type TimeSeriesPoint,
  type UsageStats,
} from './dashboard-service';
// RAG Metrics
export {
  type DateRange,
  getDashboardMetrics,
  getRAGMetrics,
  getRetrievalAccuracy,
  getRetrievalQuality,
  MetricType,
  type RAGEvent,
  type RAGMetrics,
  type RetrievalQualityMetrics,
  recordMetric,
  trackRAGMetrics,
  trackSimpleRAGEvent,
} from './rag-metrics';
// Token Tracking
export {
  type BudgetAlert,
  type BudgetConfig,
  checkBudgetAlert,
  estimateCost,
  getAllBudgetAlerts,
  getBudgetConfig,
  getModelPricing,
  getModelUsage,
  getUserTokenUsages,
  getWorkspaceTokenUsage,
  projectMonthlyCost,
  setBudgetConfig,
  type TokenUsageRecord,
  type TokenUsageSummary,
  trackTokenUsage,
  type UserTokenUsage,
} from './token-tracking';

// PostHog Analytics
export {
  // Core functions
  aliasUser,
  flushPostHog,
  getPostHogClient,
  identifyUser,
  setGroupProperties,
  shutdownPostHog,
  trackEvent,
  // Convenience tracking objects
  trackAuth,
  trackChat,
  trackDocument,
  trackFeature,
  trackRAG,
} from './posthog';
