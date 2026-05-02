/**
 * Workspace Resource Limit Checker
 *
 * Provides functions to check per-workspace resource limits for:
 * - Document count
 * - Storage usage
 * - Chat creation rate (daily)
 */

import { prisma } from '@/lib/db';

// =============================================================================
// Types
// =============================================================================

export interface ResourceLimit {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
}

export interface WorkspaceResourceUsage {
  documents: {
    current: number;
    limit: number;
  };
  storage: {
    currentBytes: number;
    limitMb: number;
  };
  chats: {
    totalCurrent: number;
    totalLimit: number;
    todayCurrent: number;
    todayLimit: number;
  };
  llmProvider: string | null;
  llmModel: string | null;
}

// =============================================================================
// Limit Checkers
// =============================================================================

/**
 * Check if a workspace is allowed to create more documents
 */
export async function checkDocumentLimit(workspaceId: string): Promise<ResourceLimit> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { maxDocuments: true },
  });

  if (!workspace) {
    return { allowed: false, reason: 'Workspace not found', current: 0, limit: 0 };
  }

  const currentCount = await prisma.document.count({
    where: { workspaceId },
  });

  const limit = workspace.maxDocuments;

  return {
    allowed: currentCount < limit,
    reason: currentCount >= limit ? `Document limit reached (${currentCount}/${limit})` : undefined,
    current: currentCount,
    limit,
  };
}

/**
 * Check if a workspace is within its storage limit after adding additional bytes
 */
export async function checkStorageLimit(
  workspaceId: string,
  additionalBytes: number
): Promise<ResourceLimit> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { maxStorageMb: true },
  });

  if (!workspace) {
    return { allowed: false, reason: 'Workspace not found', current: 0, limit: 0 };
  }

  const result = await prisma.document.aggregate({
    where: { workspaceId },
    _sum: { size: true },
  });

  const currentBytes = result._sum.size ?? 0;
  const limitBytes = workspace.maxStorageMb * 1024 * 1024;
  const projectedBytes = currentBytes + additionalBytes;

  return {
    allowed: projectedBytes <= limitBytes,
    reason:
      projectedBytes > limitBytes
        ? `Storage limit would be exceeded (${formatBytes(currentBytes)} + ${formatBytes(additionalBytes)} > ${formatBytes(limitBytes)})`
        : undefined,
    current: currentBytes,
    limit: limitBytes,
  };
}

/**
 * Check if a workspace is allowed to create more chats today (rate limit)
 */
export async function checkChatLimit(workspaceId: string): Promise<ResourceLimit> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { maxChatPerDay: true, maxChats: true },
  });

  if (!workspace) {
    return { allowed: false, reason: 'Workspace not found', current: 0, limit: 0 };
  }

  // Count today's chats
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayCount = await prisma.chat.count({
    where: {
      workspaceId,
      createdAt: { gte: startOfDay },
    },
  });

  const dailyLimit = workspace.maxChatPerDay;

  return {
    allowed: todayCount < dailyLimit,
    reason:
      todayCount >= dailyLimit
        ? `Daily chat limit reached (${todayCount}/${dailyLimit})`
        : undefined,
    current: todayCount,
    limit: dailyLimit,
  };
}

/**
 * Check if a workspace has room for more total chats
 */
export async function checkTotalChatLimit(workspaceId: string): Promise<ResourceLimit> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { maxChats: true },
  });

  if (!workspace) {
    return { allowed: false, reason: 'Workspace not found', current: 0, limit: 0 };
  }

  const totalChats = await prisma.chat.count({
    where: { workspaceId },
  });

  const limit = workspace.maxChats;

  return {
    allowed: totalChats < limit,
    reason: totalChats >= limit ? `Total chat limit reached (${totalChats}/${limit})` : undefined,
    current: totalChats,
    limit,
  };
}

/**
 * Get comprehensive resource usage for a workspace
 */
export async function getWorkspaceResourceUsage(
  workspaceId: string
): Promise<WorkspaceResourceUsage | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      maxDocuments: true,
      maxStorageMb: true,
      maxChats: true,
      maxChatPerDay: true,
      llmProvider: true,
      llmModel: true,
    },
  });

  if (!workspace) {
    return null;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [documentCount, storageResult, totalChats, todayChats] = await Promise.all([
    prisma.document.count({ where: { workspaceId } }),
    prisma.document.aggregate({ where: { workspaceId }, _sum: { size: true } }),
    prisma.chat.count({ where: { workspaceId } }),
    prisma.chat.count({
      where: { workspaceId, createdAt: { gte: startOfDay } },
    }),
  ]);

  return {
    documents: {
      current: documentCount,
      limit: workspace.maxDocuments,
    },
    storage: {
      currentBytes: storageResult._sum.size ?? 0,
      limitMb: workspace.maxStorageMb,
    },
    chats: {
      totalCurrent: totalChats,
      totalLimit: workspace.maxChats,
      todayCurrent: todayChats,
      todayLimit: workspace.maxChatPerDay,
    },
    llmProvider: workspace.llmProvider,
    llmModel: workspace.llmModel,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
