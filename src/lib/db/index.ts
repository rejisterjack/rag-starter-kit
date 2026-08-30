/**
 * Database module — public API
 *
 * All consumers should import from here, not from sub-modules directly.
 * The Prisma singleton lives in ./client.ts to avoid circular dependencies
 * with ./init.ts (which also needs the client).
 */

// ---------------------------------------------------------------------------
// Re-export the singleton Prisma client
// ---------------------------------------------------------------------------
export { type PrismaClient, prisma, prismaRead } from './client';

import type { Prisma } from '@/generated/prisma/client';
import { deleteByDocumentId, searchSimilar } from '@/lib/vector';
import { buildVectorFilter } from '@/lib/vector/filters';
import { prisma } from './client';

// ---------------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------------
export {
  type BatchInsertOptions,
  type BatchInsertResult,
  type BulkUpdateResult,
  batchDeleteChunks,
  batchDeleteDocumentChunks,
  batchInsertChunks,
  batchUpdateChunks,
  batchUpdateEmbeddings,
  type ChunkInsertData as BatchChunkInsertData,
  type DocumentMetadata as BatchDocumentMetadata,
  findDuplicates,
  streamProcessChunks,
  validateChunks,
} from './batch-operations';
// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------
export {
  ensureVectorIndex,
  initializeDatabase,
  isDatabaseInitialized,
  resetDatabaseInitialization,
} from './init';
// ---------------------------------------------------------------------------
// Partition Manager
// ---------------------------------------------------------------------------
export {
  archiveWorkspaceDocuments,
  checkPartitionHealth,
  detachOldPartitions,
  ensurePartitions,
  getPartitionStats,
  type PartitionDetail,
  type PartitionHealthReport,
  type PartitionHealthWarning,
  type PartitionStats,
} from './partition-manager';
// ---------------------------------------------------------------------------
// Vector Cache
// ---------------------------------------------------------------------------
export {
  type CacheConfig,
  type CacheProvider,
  type CacheStats,
  createEmbeddingCache,
  createSemanticCache,
  EmbeddingCache,
  MemoryCacheProvider,
  SemanticCache,
  type SemanticCacheEntry,
} from './vector-cache';
// ---------------------------------------------------------------------------
// Vector Operations
// ---------------------------------------------------------------------------
export {
  analyzeVectorIndex,
  calculateHNSWParams,
  calculateOptimalLists,
  createHNSWIndex,
  createIVFFlatIndex,
  dropHNSWIndex,
  dropIVFFlatIndex,
  findDuplicateVectors,
  getGlobalVectorStats,
  getVectorStats,
  type HNSWIndexOptions,
  type IndexStats,
  type IVFFlatIndexOptions,
  listVectorIndexes,
  reindexVector,
  removeOrphanedVectors,
  setHNSWEfSearch,
  setIVFFlatProbes,
  type VectorStats,
  vacuumVectorTable,
} from './vector-operations';
// ---------------------------------------------------------------------------
// Vector Store
// ---------------------------------------------------------------------------
export {
  type ChunkInsertData as VectorChunkInsertData,
  createVectorStore,
  type DistanceMetric,
  getVectorStore,
  type SearchFilter,
  type SearchOptions,
  type SearchResult,
  VectorStore,
} from './vector-store';

// ============================================================================
// User Queries
// ============================================================================

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: { documents: true, chats: true },
      },
    },
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

// ============================================================================
// Chat Queries
// ============================================================================

export async function getChatsByUserId(userId: string, limit = 50) {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });
}

export async function getChatById(id: string) {
  return prisma.chat.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function createChat(userId: string, title = 'New Chat') {
  return prisma.chat.create({
    data: {
      userId,
      title,
    },
  });
}

export async function updateChatTitle(id: string, title: string) {
  return prisma.chat.update({
    where: { id },
    data: { title, updatedAt: new Date() },
  });
}

export async function deleteChat(id: string) {
  return prisma.chat.delete({
    where: { id },
  });
}

// ============================================================================
// Message Queries
// ============================================================================

export async function createMessage(
  chatId: string,
  content: string,
  role: 'USER' | 'ASSISTANT' | 'SYSTEM',
  sources?: unknown,
  tokensUsed?: unknown
) {
  return prisma.message.create({
    data: {
      chatId,
      content,
      role,
      sources: sources ?? undefined,
      tokensUsed: tokensUsed ?? undefined,
    },
  });
}

export async function getMessagesByChatId(chatId: string) {
  return prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
  });
}

// ============================================================================
// Document Queries
// ============================================================================

export async function getDocumentsByUserId(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
  });
}

export async function createDocument(data: {
  name: string;
  contentType: string;
  size: number;
  userId: string;
  content?: string;
  metadata?: unknown;
}) {
  return prisma.document.create({
    data: {
      ...data,
      metadata: data.metadata ?? undefined,
    },
  });
}

export async function updateDocumentStatus(
  id: string,
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
  error?: string
) {
  return prisma.document.update({
    where: { id },
    data: {
      status,
      ...(error && { metadata: { error } }),
      updatedAt: new Date(),
    },
  });
}

export async function updateDocument(
  id: string,
  data: {
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    metadata?: Record<string, unknown>;
    content?: string;
  }
) {
  return prisma.document.update({
    where: { id },
    data: {
      status: data.status,
      content: data.content,
      metadata: data.metadata as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}

export async function deleteDocument(id: string) {
  return prisma.document.delete({
    where: { id },
  });
}

// ============================================================================
// Document Chunk Queries (backed by pgvector)
// ============================================================================

export async function searchSimilarChunks(
  embedding: number[],
  userId: string,
  limit = 5,
  threshold = 0.7
) {
  const filter = buildVectorFilter({ userId });
  const results = await searchSimilar(embedding, {
    filter,
    topK: limit,
    minScore: threshold,
  });

  return results.map((r) => {
    const payload = r.payload ?? {};
    return {
      id: String(r.id),
      documentId: String(payload.documentId ?? ''),
      content: String(payload.content ?? ''),
      index: Number(payload.index ?? 0),
      score: r.score,
    };
  });
}

export async function deleteDocumentChunks(documentId: string): Promise<number> {
  return deleteByDocumentId(documentId);
}

// ============================================================================
// Ingestion Job Queries
// ============================================================================

export async function createIngestionJob(documentId: string) {
  return prisma.ingestionJob.create({
    data: {
      documentId,
      status: 'QUEUED',
      progress: 0,
    },
  });
}

export async function getIngestionJobByDocumentId(documentId: string) {
  return prisma.ingestionJob.findUnique({
    where: { documentId },
  });
}

export async function updateIngestionJob(
  id: string,
  data: {
    status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress?: number;
    error?: string | null;
    startedAt?: Date;
    completedAt?: Date;
  }
) {
  return prisma.ingestionJob.update({
    where: { id },
    data,
  });
}
