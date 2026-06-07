/**
 * Prisma Client Singleton (Prisma 7 + Neon)
 *
 * Connects to Neon PostgreSQL using @prisma/adapter-neon with the
 * Neon serverless driver — supports edge/serverless runtimes.
 *
 * Pattern:
 * - In development, store client on globalThis to prevent hot-reload exhaustion.
 * - In production, module-level singleton (one per process).
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlobalWithPrisma = typeof globalThis & {
  _prismaClient: PrismaClient | undefined;
  _prismaReadClient: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Prisma client factory
// ---------------------------------------------------------------------------

function createPrismaClient(url?: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: url ?? env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

// ---------------------------------------------------------------------------
// Slow Query Middleware
// ---------------------------------------------------------------------------

function extendWithSlowQueryMiddleware<T extends PrismaClient>(client: T): T {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
          const start = isBuildPhase ? 0 : Date.now();
          const result = await query(args);

          if (!isBuildPhase) {
            const durationMs = Date.now() - start;
            if (durationMs > 1000) {
              logger.warn('Slow Prisma query', {
                model,
                operation,
                durationMs,
                ...(env.NODE_ENV === 'development' && { args }),
              });
            }
          }

          return result;
        },
      },
    },
  }) as T;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const g = globalThis as GlobalWithPrisma;

const basePrisma = g._prismaClient ?? createPrismaClient();

export const prisma = extendWithSlowQueryMiddleware(basePrisma);

if (env.NODE_ENV !== 'production') {
  g._prismaClient = basePrisma;
}

// ---------------------------------------------------------------------------
// Graceful shutdown — database disconnect is registered via src/lib/shutdown.ts
// ---------------------------------------------------------------------------

export async function disconnectDatabase(): Promise<void> {
  try {
    await basePrisma.$disconnect();
    if (READ_REPLICA_URL) {
      const readBase = (globalThis as GlobalWithPrisma)._prismaReadClient;
      if (readBase) await readBase.$disconnect();
    }
  } catch (err) {
    logger.error('Error during database disconnect', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}

// ---------------------------------------------------------------------------
// Read Replica (optional)
// ---------------------------------------------------------------------------

const READ_REPLICA_URL = env.DATABASE_READ_REPLICA_URL;

function createReadClient(): PrismaClient {
  if (!READ_REPLICA_URL) {
    throw new Error('DATABASE_READ_REPLICA_URL is required for read replica client');
  }
  const adapter = new PrismaNeon({ connectionString: READ_REPLICA_URL });
  return new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });
}

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

export type { PrismaClient };
