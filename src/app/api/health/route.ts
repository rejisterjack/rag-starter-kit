/**
 * Health Check Endpoint
 *
 * GET /api/health — Instant liveness check (cached for 30s)
 * HEAD /api/health — Ultra-lightweight for load balancers
 *
 * Each dependency check has a 2s timeout to prevent cascading slowness.
 * Results are cached for 30 seconds to avoid hammering dependencies.
 */

import { NextResponse } from 'next/server';
import { APP_URL } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { checkMemoryRateLimit } from '@/lib/security/rate-limiter';

// =============================================================================
// Types
// =============================================================================

interface HealthStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  lastChecked: string;
}

// =============================================================================
// Configuration
// =============================================================================

const START_TIME = Date.now();
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
const CHECK_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 30_000;

let cachedResult: {
  timestamp: number;
  data: { status: string; checks: Record<string, HealthStatus> };
} | null = null;

// =============================================================================
// Helpers
// =============================================================================

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// =============================================================================
// Individual Health Checks
// =============================================================================

async function checkDatabase(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const { prisma } = await import('@/lib/db/client');
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkVectorStore(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const { prisma } = await import('@/lib/db/client');
    await withTimeout(
      prisma.$queryRaw`SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
      CHECK_TIMEOUT_MS
    );
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const { isRedisConfigured, redis } = await import('@/lib/redis');
    if (!isRedisConfigured()) {
      return {
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Redis not configured',
        lastChecked: new Date().toISOString(),
      };
    }
    await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkEmbeddingProvider(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const { createEmbeddingProviderFromEnv } = await import('@/lib/ai/embeddings');
    const provider = createEmbeddingProviderFromEnv();
    if (provider.healthCheck) {
      const isHealthy = await withTimeout(provider.healthCheck(), CHECK_TIMEOUT_MS);
      return {
        status: isHealthy ? 'up' : 'degraded',
        responseTime: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

async function runChecks(): Promise<Record<string, HealthStatus>> {
  const [database, vectorStore, redis, embeddingProvider] = await Promise.all([
    checkDatabase(),
    checkVectorStore(),
    checkRedis(),
    checkEmbeddingProvider(),
  ]);

  return { database, vectorStore, redis, embeddingProvider };
}

/**
 * GET /api/health
 * Cached health check — runs all dependency checks with per-check timeouts.
 * Results cached for 30s to avoid hammering dependencies on every request.
 */
export async function GET(): Promise<NextResponse> {
  // In-memory rate limit for health checks (avoids Redis for cheap endpoints).
  // When rate limited, still return healthy — load balancers just need a 200.
  const healthLimit = checkMemoryRateLimit('health:global', 60, 60_000); // 60/min
  if (!healthLimit.allowed) {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        uptime: Date.now() - START_TIME,
        cached: true,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Status': 'healthy',
        },
      }
    );
  }

  // Serve from cache if fresh
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        status: cachedResult.data.status,
        timestamp: new Date().toISOString(),
        version: VERSION,
        uptime: Date.now() - START_TIME,
        checks: cachedResult.data.checks,
        cached: true,
      },
      {
        status: cachedResult.data.status === 'unhealthy' ? 503 : 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Status': cachedResult.data.status,
        },
      }
    );
  }

  const checks = await runChecks();
  const checkStatuses = Object.values(checks).map((c) => c.status);

  const overallStatus = checkStatuses.some((s) => s === 'down')
    ? 'unhealthy'
    : checkStatuses.some((s) => s === 'degraded')
      ? 'degraded'
      : 'healthy';

  // Update cache
  cachedResult = { timestamp: Date.now(), data: { status: overallStatus, checks } };

  // Probabilistic cleanup trigger for hobby plan (no Vercel Cron)
  // ~1% of health checks trigger the cleanup endpoint
  if (Math.random() < 0.01) {
    try {
      const cleanupUrl = new URL('/api/cron/cleanup', APP_URL);
      fetch(cleanupUrl.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET || 'dev'}` },
      }).catch(() => {}); // fire-and-forget
    } catch (cleanupError) {
      logger.warn('Failed to trigger cleanup cron', {
        error: cleanupError instanceof Error ? cleanupError.message : 'Unknown',
      });
    }
  }

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: VERSION,
      uptime: Date.now() - START_TIME,
      checks,
    },
    {
      status: overallStatus === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': overallStatus,
      },
    }
  );
}

/**
 * HEAD /api/health
 * Ultra-lightweight liveness probe for load balancers — no database queries.
 */
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: { 'X-Health-Status': 'healthy' },
  });
}
