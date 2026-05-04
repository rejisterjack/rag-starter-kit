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
import { Pool } from 'pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlobalWithPrisma = typeof globalThis & {
  _prismaPool: Pool | undefined;
  _prismaClient: PrismaClient | undefined;
  _prismaReadPool: Pool | undefined;
  _prismaReadClient: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Connection pool factory
// ---------------------------------------------------------------------------

function createPool(): Pool {
  // Use validated DATABASE_URL from env.ts
  //
  // IMPORTANT: For serverless deployments (Vercel, AWS Lambda), each function
  // instance creates its own pool. Keep max LOW (5-10) to avoid connection
  // exhaustion. Use Prisma Accelerate, PgBouncer, or Neon's connection pooler
  // for high-concurrency workloads.
  //
  // For traditional servers (Docker, VMs), higher values (15-25) are appropriate.
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const defaultMax = isServerless ? 5 : env.NODE_ENV === 'production' ? 15 : 3;

  return new Pool({
    connectionString: env.DATABASE_URL,
    // Scale via DB_POOL_MAX env var, or use sensible defaults
    max: env.DB_POOL_MAX ?? defaultMax,
    // Idle connections are released after 20s (serverless) or 30s (server)
    idleTimeoutMillis: isServerless ? 20_000 : 30_000,
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

// ---------------------------------------------------------------------------
// Read Replica (optional)
// ---------------------------------------------------------------------------

const READ_REPLICA_URL = env.DATABASE_READ_REPLICA_URL;

function createReadPool(): Pool {
  const defaultMax = env.NODE_ENV === 'production' ? 20 : 2;
  return new Pool({
    connectionString: READ_REPLICA_URL,
    max: env.DB_POOL_MAX ? Math.ceil(env.DB_POOL_MAX * 0.8) : defaultMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

function createReadClient(): PrismaClient {
  const g = globalThis as GlobalWithPrisma;
  if (!g._prismaReadPool) {
    g._prismaReadPool = createReadPool();
  }
  const adapter = new PrismaPg(g._prismaReadPool);
  return new PrismaClient({ adapter, log: ['warn', 'error'] });
}

/**
 * Read-replica PrismaClient. Falls back to the primary client
 * when DATABASE_READ_REPLICA_URL is not configured.
 */
export const prismaRead: PrismaClient = READ_REPLICA_URL
  ? extendWithSlowQueryMiddleware(
      ((): PrismaClient => {
        const g = globalThis as GlobalWithPrisma;
        const base = g._prismaReadClient ?? createReadClient();
        if (env.NODE_ENV !== 'production') {
          g._prismaReadClient = base;
        }
        return base;
      })()
    )
  : prisma;

// Re-export PrismaClient type for convenience
export type { PrismaClient };
