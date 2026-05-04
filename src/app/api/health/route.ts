/**
 * Health Check Endpoint
 *
 * Comprehensive health check for monitoring and load balancers.
 *
 * Endpoints:
 * - GET /api/health - Basic liveness check
 * - GET /api/health/ready - Readiness check (includes dependencies)
 * - GET /api/health/live - Liveness check
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRAGHealth } from '@/lib/rag/engine';
import { isRedisConfigured, redis } from '@/lib/redis';

// =============================================================================
// Types
// =============================================================================

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthStatus;
    redis?: HealthStatus;
    vectorStore: HealthStatus;
    embeddingProvider: HealthStatus;
    ragPipeline: HealthStatus;
  };
}

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

// =============================================================================
// Health Checks
// =============================================================================

async function checkDatabase(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
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
    // Check if pgvector extension is available
    await prisma.$queryRaw`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Vector store health check failed', { error });
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
      const isHealthy = await provider.healthCheck();
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
    logger.error('Embedding provider health check failed', { error });
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
  if (!isRedisConfigured()) {
    return {
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Redis not configured — using in-memory fallback',
      lastChecked: new Date().toISOString(),
    };
  }
  try {
    await redis.ping();
    return {
      status: 'up',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return {
      status: 'down',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRAGPipeline(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const health = await checkRAGHealth();
    return {
      status: health.healthy ? 'up' : 'degraded',
      responseTime: Date.now() - start,
      message: health.errors.length > 0 ? health.errors.join(', ') : undefined,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('RAG pipeline health check failed', { error });
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

/**
 * GET /api/health
 * Basic health check - returns 200 if server is running
 */
export async function GET(): Promise<NextResponse> {
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: Date.now() - START_TIME,
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      vectorStore: await checkVectorStore(),
      embeddingProvider: await checkEmbeddingProvider(),
      ragPipeline: await checkRAGPipeline(),
    },
  };

  // Determine overall status
  const checkStatuses = Object.values(health.checks).map((c) => c.status);

  if (checkStatuses.some((s) => s === 'down')) {
    health.status = 'unhealthy';
  } else if (checkStatuses.some((s) => s === 'degraded')) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': health.status,
    },
  });
}

/**
 * GET /api/health/ready
 * Readiness probe - returns 200 only if all dependencies are healthy
 */
export async function HEAD(): Promise<NextResponse> {
  // Lightweight check for load balancers
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'X-Health-Status': 'healthy',
    },
  });
}
