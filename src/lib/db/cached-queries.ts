/**
 * Cached data access functions using Next.js 'use cache' directive.
 *
 * These wrap frequently-hit read queries with cacheLife profiles.
 * Mutations in route handlers should call revalidateTag() to bust the cache.
 */

import { cacheLife as setCacheLife } from 'next/dist/server/use-cache/cache-life';
import { prismaRead } from './client';

// =============================================================================
// Workspace caching
// =============================================================================

export async function getWorkspaceByIdCached(id: string) {
  'use cache';
  setCacheLife('minutes');
  return prismaRead.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: true,
      maxDocuments: true,
      maxStorageMb: true,
      maxChats: true,
      maxChatPerDay: true,
      ownerId: true,
    },
  });
}

export async function getWorkspaceBySlugCached(slug: string) {
  'use cache';
  setCacheLife('minutes');
  return prismaRead.workspace.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: true,
    },
  });
}

// =============================================================================
// User caching
// =============================================================================

export async function getUserByIdCached(id: string) {
  'use cache';
  setCacheLife('minutes');
  return prismaRead.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      activeWorkspaceId: true,
      image: true,
    },
  });
}

// =============================================================================
// Document list caching (short-lived)
// =============================================================================

export async function getDocumentsCountCached(workspaceId: string, userId: string) {
  'use cache';
  setCacheLife('seconds');
  const [workspaceCount, personalCount] = await Promise.all([
    prismaRead.document.count({ where: { workspaceId, status: 'COMPLETED' } }),
    prismaRead.document.count({ where: { userId, workspaceId: null, status: 'COMPLETED' } }),
  ]);
  return { workspaceCount, personalCount };
}

// =============================================================================
// Chat list caching (short-lived)
// =============================================================================

export async function getChatsCountCached(userId: string, workspaceId?: string | null) {
  'use cache';
  setCacheLife('seconds');
  const where: Record<string, unknown> = { userId };
  if (workspaceId) where.workspaceId = workspaceId;
  return prismaRead.chat.count({ where });
}

// =============================================================================
// Workspace membership caching
// =============================================================================

export async function getWorkspaceMembershipCached(userId: string, workspaceId: string) {
  'use cache';
  setCacheLife('minutes');
  return prismaRead.workspaceMember.findFirst({
    where: { userId, workspaceId },
    select: { role: true, status: true },
  });
}

// =============================================================================
// Chat list caching (short-lived) — full list with message counts
// =============================================================================

export async function getChatsByUserIdCached(
  userId: string,
  workspaceId?: string | null,
  limit = 50
) {
  'use cache';
  setCacheLife('seconds');
  const where: Record<string, unknown> = { userId };
  if (workspaceId) where.workspaceId = workspaceId;
  return prismaRead.chat.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });
}

// =============================================================================
// Document list caching (short-lived) — full list
// =============================================================================

export async function getDocumentsByUserIdCached(userId: string, workspaceId?: string | null) {
  'use cache';
  setCacheLife('seconds');
  const where: Record<string, unknown> = {
    OR: [{ userId, workspaceId: workspaceId ?? null }, ...(workspaceId ? [{ workspaceId }] : [])],
  };
  return prismaRead.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      contentType: true,
      size: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      workspaceId: true,
      chunkCount: true,
    },
  });
}
