/**
 * Prisma Client Singleton (Prisma 7 + @prisma/adapter-pg)
 *
 * In Prisma 7, the PrismaClient must be initialized with a driver adapter.
 * We use @prisma/adapter-pg with a connection pool for efficient connection
 * management in both development and production environments.
 *
 * Pattern:
 * - A single Pool instance is stored on globalThis in development to prevent
 *   connection exhaustion from hot-reloads (Next.js dev server).
 * - In production, a fresh pool is created per process (one process = one pool).
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlobalWithPrisma = typeof globalThis & {
  _prismaPool: Pool | undefined;
  _prismaClient: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Connection pool factory
// ---------------------------------------------------------------------------

function createPool(): Pool {
  // Use validated DATABASE_URL from env.ts
  return new Pool({
    connectionString: env.DATABASE_URL,
    // Keep pool small in development; scale up in production
    max: env.NODE_ENV === 'production' ? 10 : 3,
    // Idle connections are released after 30 s
    idleTimeoutMillis: 30_000,
    // Fail fast if the DB is unreachable
    connectionTimeoutMillis: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Prisma client factory
// ---------------------------------------------------------------------------

function createPrismaClient(): PrismaClient {
  const g = globalThis as GlobalWithPrisma;

  // Reuse the pool across hot-reloads in development
  if (!g._prismaPool) {
    g._prismaPool = createPool();
  }

  const adapter = new PrismaPg(g._prismaPool);

  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  return client;
}

// ---------------------------------------------------------------------------
// Slow Query Middleware (Fix #10)
// ---------------------------------------------------------------------------

function extendWithSlowQueryMiddleware<T extends PrismaClient>(client: T): T {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now();
          const result = await query(args);
          const durationMs = Date.now() - start;

          // Warn on queries taking longer than 1000ms
          if (durationMs > 1000) {
            logger.warn('Slow Prisma query', {
              model,
              operation,
              durationMs,
              // Log query args in development only
              ...(env.NODE_ENV === 'development' && { args }),
            });
          }

          return result;
        },
      },
    },
  }) as unknown as T;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const g = globalThis as GlobalWithPrisma;

/**
 * Singleton PrismaClient instance.
 *
 * - Development: stored on globalThis so Next.js hot-reloads don't create
 *   a new client (and new pool) on every module reload.
 * - Production: module-level singleton (one per process).
 */
const basePrisma = g._prismaClient ?? createPrismaClient();

// Extend with slow query middleware
export const prisma = extendWithSlowQueryMiddleware(basePrisma);

if (env.NODE_ENV !== 'production') {
  g._prismaClient = basePrisma;
}

// Re-export PrismaClient type for convenience
export type { PrismaClient };
