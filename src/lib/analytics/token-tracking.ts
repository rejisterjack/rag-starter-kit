/**
 * Token Tracking & Cost Management
 * 
 * Tracks token usage per workspace/user, estimates costs,
 * and provides budget alerts.
 */

import { prisma } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface TokenUsageRecord {
  workspaceId: string;
  userId: string;
  conversationId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
}

export interface TokenUsageSummary {
  workspaceId: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  queryCount: number;
  avgTokensPerQuery: number;
}

export interface UserTokenUsage {
  userId: string;
  totalTokens: number;
  estimatedCost: number;
  queryCount: number;
}

export interface BudgetAlert {
  workspaceId: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
  alertLevel: 'info' | 'warning' | 'critical';
}

export interface BudgetConfig {
  workspaceId: string;
  monthlyBudget: number;
  alertThresholds: {
    warning: number; // Percentage (e.g., 0.8 for 80%)
    critical: number; // Percentage (e.g., 0.95 for 95%)
  };
}

// ============================================================================
// Cost Per 1K Tokens (in USD)
// Update these based on current OpenAI pricing
// ============================================================================

const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0 },
  'text-embedding-3-large': { prompt: 0.00013, completion: 0 },
  // Default fallback
  'default': { prompt: 0.001, completion: 0.003 },
};

// ============================================================================
// Token Tracking
// ============================================================================

/**
 * Track token usage for a request
 */
export async function trackTokenUsage(data: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<TokenUsageRecord> {
  const { workspaceId, userId, conversationId, model, promptTokens, completionTokens } = data;
  
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = estimateCost(model, promptTokens, completionTokens);

  const record = await prisma.tokenUsage.create({
    data: {
      workspaceId,
      userId,
      conversationId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
    },
  });

  // Check for budget alerts
  await checkBudgetAlert(workspaceId);

  return {
    workspaceId: record.workspaceId,
    userId: record.userId,
    conversationId: record.conversationId,
    model: record.model,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    totalTokens: record.totalTokens,
    estimatedCost: record.estimatedCost,
    timestamp: record.createdAt,
  };
}

/**
 * Estimate cost for a given model and token usage
 */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['default'];
  
  const promptCost = (promptTokens / 1000) * pricing.prompt;
  const completionCost = (completionTokens / 1000) * pricing.completion;
  
  return Math.round((promptCost + completionCost) * 10000) / 10000; // Round to 4 decimals
}

/**
 * Get pricing info for a model
 */
export function getModelPricing(model: string): { prompt: number; completion: number } {
  return MODEL_PRICING[model] ?? MODEL_PRICING['default'];
}

// ============================================================================
// Usage Queries
// ============================================================================

/**
 * Get token usage summary for a workspace
 */
export async function getWorkspaceTokenUsage(
  workspaceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<TokenUsageSummary> {
  const where: {
    workspaceId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { workspaceId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const usages = await prisma.tokenUsage.findMany({ where });

  const totalTokens = usages.reduce((sum, u) => sum + u.totalTokens, 0);
  const promptTokens = usages.reduce((sum, u) => sum + u.promptTokens, 0);
  const completionTokens = usages.reduce((sum, u) => sum + u.completionTokens, 0);
  const estimatedCost = usages.reduce((sum, u) => sum + u.estimatedCost, 0);

  return {
    workspaceId,
    totalTokens,
    promptTokens,
    completionTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    queryCount: usages.length,
    avgTokensPerQuery: usages.length > 0 ? Math.round(totalTokens / usages.length) : 0,
  };
}

/**
 * Get token usage by user in a workspace
 */
export async function getUserTokenUsages(
  workspaceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UserTokenUsage[]> {
  const where: {
    workspaceId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { workspaceId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const usages = await prisma.tokenUsage.findMany({ where });

  // Group by user
  const userMap = new Map<string, { tokens: number; cost: number; queries: number }>();

  for (const usage of usages) {
    const existing = userMap.get(usage.userId) ?? { tokens: 0, cost: 0, queries: 0 };
    existing.tokens += usage.totalTokens;
    existing.cost += usage.estimatedCost;
    existing.queries++;
    userMap.set(usage.userId, existing);
  }

  return Array.from(userMap.entries()).map(([userId, data]) => ({
    userId,
    totalTokens: data.tokens,
    estimatedCost: Math.round(data.cost * 100) / 100,
    queryCount: data.queries,
  }));
}

/**
 * Get token usage by model
 */
export async function getModelUsage(
  workspaceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Array<{
  model: string;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
}>> {
  const where: {
    workspaceId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { workspaceId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const usages = await prisma.tokenUsage.findMany({ where });

  // Group by model
  const modelMap = new Map<string, { tokens: number; cost: number; requests: number }>();

  for (const usage of usages) {
    const existing = modelMap.get(usage.model) ?? { tokens: 0, cost: 0, requests: 0 };
    existing.tokens += usage.totalTokens;
    existing.cost += usage.estimatedCost;
    existing.requests++;
    modelMap.set(usage.model, existing);
  }

  return Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model,
      totalTokens: data.tokens,
      estimatedCost: Math.round(data.cost * 100) / 100,
      requestCount: data.requests,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

// ============================================================================
// Budget Management
// ============================================================================

/**
 * Set budget configuration for a workspace
 */
export async function setBudgetConfig(config: BudgetConfig): Promise<void> {
  await prisma.workspaceBudget.upsert({
    where: { workspaceId: config.workspaceId },
    create: {
      workspaceId: config.workspaceId,
      monthlyBudget: config.monthlyBudget,
      warningThreshold: config.alertThresholds.warning,
      criticalThreshold: config.alertThresholds.critical,
    },
    update: {
      monthlyBudget: config.monthlyBudget,
      warningThreshold: config.alertThresholds.warning,
      criticalThreshold: config.alertThresholds.critical,
    },
  });
}

/**
 * Get budget configuration
 */
export async function getBudgetConfig(workspaceId: string): Promise<BudgetConfig | null> {
  const config = await prisma.workspaceBudget.findUnique({
    where: { workspaceId },
  });

  if (!config) return null;

  return {
    workspaceId: config.workspaceId,
    monthlyBudget: config.monthlyBudget,
    alertThresholds: {
      warning: config.warningThreshold,
      critical: config.criticalThreshold,
    },
  };
}

/**
 * Check if budget alert should be triggered
 */
export async function checkBudgetAlert(workspaceId: string): Promise<BudgetAlert | null> {
  const config = await getBudgetConfig(workspaceId);
  if (!config) return null;

  // Get current month's usage
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const usage = await getWorkspaceTokenUsage(workspaceId, startOfMonth, now);
  const currentSpend = usage.estimatedCost;
  
  const percentUsed = currentSpend / config.monthlyBudget;

  let alertLevel: 'info' | 'warning' | 'critical' | null = null;

  if (percentUsed >= config.alertThresholds.critical) {
    alertLevel = 'critical';
  } else if (percentUsed >= config.alertThresholds.warning) {
    alertLevel = 'warning';
  } else if (percentUsed >= 0.5) {
    alertLevel = 'info';
  }

  if (!alertLevel) return null;

  return {
    workspaceId,
    currentSpend,
    budgetLimit: config.monthlyBudget,
    percentUsed: Math.round(percentUsed * 100) / 100,
    alertLevel,
  };
}

/**
 * Get all workspaces with budget alerts
 */
export async function getAllBudgetAlerts(): Promise<BudgetAlert[]> {
  const configs = await prisma.workspaceBudget.findMany();
  const alerts: BudgetAlert[] = [];

  for (const config of configs) {
    const alert = await checkBudgetAlert(config.workspaceId);
    if (alert && (alert.alertLevel === 'warning' || alert.alertLevel === 'critical')) {
      alerts.push(alert);
    }
  }

  return alerts;
}

// ============================================================================
// Cost Projection
// ============================================================================

/**
 * Project monthly cost based on current usage
 */
export async function projectMonthlyCost(workspaceId: string): Promise<{
  currentSpend: number;
  projectedSpend: number;
  dailyAverage: number;
  daysRemaining: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const usage = await getWorkspaceTokenUsage(workspaceId, startOfMonth, now);
  const daysPassed = now.getDate();
  const daysRemaining = endOfMonth.getDate() - now.getDate();

  const dailyAverage = usage.estimatedCost / daysPassed;
  const projectedSpend = usage.estimatedCost + dailyAverage * daysRemaining;

  return {
    currentSpend: usage.estimatedCost,
    projectedSpend: Math.round(projectedSpend * 100) / 100,
    dailyAverage: Math.round(dailyAverage * 10000) / 10000,
    daysRemaining,
  };
}

// ============================================================================
// Export
// ============================================================================

// Types are already exported above
