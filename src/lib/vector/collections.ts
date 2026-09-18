import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export const COLLECTION_DOCUMENT_CHUNKS = 'document_chunks';
export const COLLECTION_IMAGE_EMBEDDINGS = 'image_embeddings';

let documentChunksEnsured = false;
let imageEmbeddingsEnsured = false;

export function resetCollectionCache(): void {
  documentChunksEnsured = false;
  imageEmbeddingsEnsured = false;
}

export async function ensureDocumentChunksCollection(): Promise<void> {
  if (documentChunksEnsured) return;
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public.document_chunks') IS NOT NULL AS exists
  `;
  if (!rows[0]?.exists) {
    throw new Error(
      'document_chunks table is missing. Run `bunx prisma migrate deploy` to restore pgvector tables.'
    );
  }
  documentChunksEnsured = true;
}

export async function ensureImageEmbeddingsCollection(): Promise<void> {
  if (imageEmbeddingsEnsured) return;
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public.image_embeddings') IS NOT NULL AS exists
  `;
  if (!rows[0]?.exists) {
    throw new Error(
      'image_embeddings table is missing. Run `bunx prisma migrate deploy` to restore pgvector tables.'
    );
  }
  imageEmbeddingsEnsured = true;
}

export async function getCollectionInfo(name: string) {
  const rows = await prisma.$queryRaw<Array<{ reltuples: number }>>`
    SELECT COALESCE(reltuples, 0)::int AS reltuples
    FROM pg_class
    WHERE relname = ${name}
    LIMIT 1
  `;
  return { points_count: rows[0]?.reltuples ?? 0 };
}

export async function initializeVectorStore(): Promise<void> {
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
  await ensureDocumentChunksCollection();
  await ensureImageEmbeddingsCollection();
  logger.info('pgvector tables are ready');
}

/** @deprecated Use initializeVectorStore */
export const initializeQdrantCollections = initializeVectorStore;

export async function checkVectorStoreHealth(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.document_chunks') IS NOT NULL AS exists
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

/** @deprecated Use checkVectorStoreHealth */
export const checkQdrantHealth = checkVectorStoreHealth;
