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
export { type PrismaClient, prisma } from './client';

import type { Prisma } from '@prisma/client';
import type { Chat, Document, DocumentChunk, IngestionJob, Message } from '@/types';
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

export async function createChat(userId: string, title = 'New Chat'): Promise<Chat> {
  return prisma.chat.create({
    data: {
      userId,
      title,
    },
  }) as unknown as Chat;
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
): Promise<Message> {
  return prisma.message.create({
    data: {
      chatId,
      content,
      role,
      sources: sources ?? undefined,
      tokensUsed: tokensUsed ?? undefined,
    },
  }) as unknown as Message;
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
    include: {
      _count: {
        select: { chunks: true },
      },
    },
  });
}

export async function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { index: 'asc' },
      },
    },
  });
}

export async function createDocument(data: {
  name: string;
  contentType: string;
  size: number;
  userId: string;
  content?: string;
  metadata?: unknown;
}): Promise<Document> {
  return prisma.document.create({
    data: {
      ...data,
      metadata: data.metadata ?? undefined,
    },
  }) as unknown as Document;
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
// Document Chunk Queries
// ============================================================================

/**
 * @deprecated Use VectorStore.addVectors or batchInsertChunks instead
 */
export async function createDocumentChunks(
  chunks: Array<{
    documentId: string;
    content: string;
    index: number;
    start: number;
    end: number;
    page?: number;
    section?: string;
    embedding?: number[];
  }>
): Promise<void> {
  await prisma.documentChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId: chunk.documentId,
      content: chunk.content,
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      page: chunk.page,
      section: chunk.section,
    })),
  });
}

/**
 * @deprecated Use VectorStore.similaritySearch instead
 */
export async function searchSimilarChunks(
  embedding: number[],
  limit = 5,
  threshold = 0.7
): Promise<DocumentChunk[]> {
  const result = await prisma.$queryRaw<DocumentChunk[]>`
    SELECT 
      dc.id,
      dc.document_id as "documentId",
      dc.content,
      dc.index,
      dc.start,
      dc.end,
      dc.page,
      dc.section,
      dc.created_at as "createdAt",
      1 - (dc.embedding <=> ${embedding}::vector) as similarity
    FROM document_chunks dc
    WHERE 1 - (dc.embedding <=> ${embedding}::vector) > ${threshold}
    ORDER BY dc.embedding <=> ${embedding}::vector
    LIMIT ${limit}
  `;

  return result;
}

// ============================================================================
// Ingestion Job Queries
// ============================================================================

export async function createIngestionJob(documentId: string): Promise<IngestionJob> {
  return prisma.ingestionJob.create({
    data: {
      documentId,
      status: 'QUEUED',
      progress: 0,
    },
  }) as unknown as IngestionJob;
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
