import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface HealthCheck {
  name: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: 'database',
      healthy: true,
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      healthy: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check pgvector extension
 */
async function checkVectorExtension(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await prisma.$queryRaw<[{ installed: boolean }]>`SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) as installed`;

    const installed = result[0]?.installed ?? false;

    return {
      name: 'vector_extension',
      healthy: installed,
      responseTime: Date.now() - start,
      details: { installed },
      error: installed ? undefined : 'pgvector extension not installed',
    };
  } catch (error) {
    return {
      name: 'vector_extension',
      healthy: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Failed to check vector extension',
    };
  }
}

/**
 * Check OpenAI API availability (lightweight check)
 */
async function checkOpenAI(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        name: 'openai',
        healthy: false,
        responseTime: Date.now() - start,
        error: 'OPENAI_API_KEY not configured',
      };
    }

    // We don't actually call the API to avoid costs, just validate key format
    const isValidFormat = apiKey.startsWith('sk-') && apiKey.length > 20;

    return {
      name: 'openai',
      healthy: isValidFormat,
      responseTime: Date.now() - start,
      details: { configured: true },
      error: isValidFormat ? undefined : 'Invalid API key format',
    };
  } catch (error) {
    return {
      name: 'openai',
      healthy: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'OpenAI check failed',
    };
  }
}

/**
 * Check Redis/Upstash if configured
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();

  // Skip if not configured
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return {
      name: 'redis',
      healthy: true,
      responseTime: 0,
      details: { configured: false },
    };
  }

  try {
    // Dynamic import to avoid issues if not installed
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    await redis.ping();

    return {
      name: 'redis',
      healthy: true,
      responseTime: Date.now() - start,
      details: { configured: true },
    };
  } catch (error) {
    return {
      name: 'redis',
      healthy: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics(): Record<string, unknown> {
  return {
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  };
}

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET() {
  const startTime = Date.now();

  // Run all health checks in parallel
  const checks = await Promise.all([
    checkDatabase(),
    checkVectorExtension(),
    checkOpenAI(),
    checkRedis(),
  ]);

  const healthy = checks.every((check) => check.healthy);
  const totalResponseTime = Date.now() - startTime;

  // Determine status code based on health
  const status = healthy ? 200 : 503;

  const response = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    responseTime: totalResponseTime,
    checks,
    system: getSystemMetrics(),
  };

  return NextResponse.json(response, { status });
}

/**
 * Deep health check endpoint (more thorough checks)
 * GET /api/health/deep
 */
export async function HEAD() {
  // Lightweight check for load balancers
  const healthy = await checkDatabase().then((r) => r.healthy);

  return new NextResponse(null, {
    status: healthy ? 200 : 503,
    headers: {
      'X-Health-Status': healthy ? 'healthy' : 'unhealthy',
    },
  });
}

// Configure route segment
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
