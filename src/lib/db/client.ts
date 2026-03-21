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
 * - DATABASE_URL_UNPOOLED is used when available (e.g. Vercel Postgres direct
 *   connection), otherwise falls back to DATABASE_URL.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

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
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/ragdb";

  return new Pool({
    connectionString,
    // Keep pool small in development; scale up in production
    max: process.env.NODE_ENV === "production" ? 10 : 3,
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

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
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
export const prisma: PrismaClient =
  g._prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  g._prismaClient = prisma;
}

// Re-export PrismaClient type for convenience
export type { PrismaClient };
