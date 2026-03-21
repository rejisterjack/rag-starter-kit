/**
 * Database Initialization Module
 *
 * Handles database setup, vector extension initialization, and index management.
 */

import { logger } from '../logger';
import { prisma } from './client';

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset database initialization state (useful for testing)
 */
export function resetDatabaseInitialization(): void {
  isInitialized = false;
  initializationPromise = null;
}

/**
 * Ensure vector extension is installed
 */
async function ensureVectorExtension(): Promise<void> {
  try {
    // Try to enable pgvector extension
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
  } catch (error) {
    logger.warn('Vector extension may already exist or not available', { error: String(error) });
  }
}

/**
 * Ensure required database tables exist
 */
async function ensureTables(): Promise<void> {
  // Tables are managed by Prisma migrations
  // This function can be used for additional setup if needed
}

/**
 * Initialize the database with required extensions and indexes
 */
export async function initializeDatabase(): Promise<void> {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Skip if already initialized
  if (isInitialized) {
    return;
  }

  initializationPromise = (async () => {
    try {
      // Ensure vector extension is installed
      await ensureVectorExtension();

      // Ensure tables exist
      await ensureTables();

      isInitialized = true;
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed', { error: String(error) });
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Ensure vector index exists for similarity search
 * Creates HNSW index if it doesn't exist
 */
export async function ensureVectorIndex(): Promise<void> {
  try {
    // Check if HNSW index exists
    const indexExists = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'document_chunks_embedding_hnsw_idx'
      ) as exists
    `;

    if (!indexExists[0]?.exists) {
      // Create HNSW index for vector similarity search
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
        ON document_chunks 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
      logger.info('HNSW vector index created successfully');
    }
  } catch (error) {
    logger.warn('Vector index creation may have failed', { error: String(error) });
    // Non-fatal: index may already exist or pgvector may not be available
  }
}
