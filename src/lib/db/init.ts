import { initializeVectorStore } from '@/lib/vector';
import { logger } from '../logger';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export function isDatabaseInitialized(): boolean {
  return isInitialized;
}

export function resetDatabaseInitialization(): void {
  isInitialized = false;
  initializationPromise = null;
}

export async function initializeDatabase(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  if (isInitialized) return;

  initializationPromise = (async () => {
    try {
      await initializeVectorStore();
      isInitialized = true;
      logger.info('Database initialized (pgvector tables ready)');
    } catch (error) {
      logger.error('Database initialization failed', { error: String(error) });
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

export async function ensureVectorIndex(): Promise<void> {
  await initializeVectorStore();
}
