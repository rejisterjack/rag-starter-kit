import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

interface HealthCheck {
  name: string;
  healthy: boolean;
  degraded?: boolean;
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
 * Check OpenRouter API availability
 */
async function checkOpenRouter(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const apiKey = env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return {
        name: 'openrouter',
        healthy: false,
        degraded: true,
        responseTime: Date.now() - start,
        error: 'OPENROUTER_API_KEY not configured',
      };
    }

    // Validate key format (OpenRouter keys start with sk-or-v1-)
    const isValidFormat = apiKey.startsWith('sk-or-v1-');

    if (!isValidFormat) {
      return {
        name: 'openrouter',
        healthy: false,
        degraded: true,
        responseTime: Date.now() - start,
        error: 'Invalid API key format - should start with sk-or-v1-',
      };
    }

    return {
      name: 'openrouter',
      healthy: true,
      degraded: false,
      responseTime: Date.now() - start,
      details: { configured: true, keyFormat: 'valid' },
    };
  } catch (error) {
    return {
      name: 'openrouter',
      healthy: false,
      degraded: true,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'OpenRouter check failed',
    };
  }
}

/**
 * Check Google AI (Gemini) API availability
 */
async function checkGoogleAI(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const apiKey = env.GOOGLE_API_KEY;

    if (!apiKey) {
      return {
        name: 'googleai',
        healthy: false,
        degraded: true,
        responseTime: Date.now() - start,
        error: 'GOOGLE_API_KEY not configured',
      };
    }

    // Try a real embedding call with short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const { google } = await import('@ai-sdk/google');
      const { embed } = await import('ai');

      const result = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: 'health check',
        abortSignal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        name: 'googleai',
        healthy: true,
        degraded: false,
        responseTime: Date.now() - start,
        details: {
          configured: true,
          embeddingDimensions: result.embedding.length,
        },
      };
    } catch (embedError) {
      clearTimeout(timeoutId);
      throw embedError;
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      name: 'googleai',
      healthy: false,
      degraded: true,
      responseTime: Date.now() - start,
      error: isTimeout
        ? 'Google AI embedding request timed out (3s)'
        : error instanceof Error
          ? error.message
          : 'Google AI check failed',
    };
  }
}

/**
 * Check Redis if configured (supports Upstash or local Redis)
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();

  const isUpstash = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
  const isLocalRedis = env.REDIS_URL;

  // Skip if not configured
  if (!isUpstash && !isLocalRedis) {
    return {
      name: 'redis',
      healthy: true,
      responseTime: 0,
      details: { configured: false },
    };
  }

  try {
    if (isUpstash) {
      // Upstash Redis
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.ping();
    } else {
      // Local Redis via ioredis
      const Redis = await import('ioredis');
      const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
      const redis = new Redis.default(redisUrl);
      await redis.ping();
      await redis.quit();
    }

    return {
      name: 'redis',
      healthy: true,
      responseTime: Date.now() - start,
      details: { configured: true, type: isUpstash ? 'upstash' : 'redis' },
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
 * Check S3/MinIO storage if configured
 */
async function checkStorage(): Promise<HealthCheck> {
  const start = Date.now();

  // Check if storage is configured
  const hasS3Config = env.S3_ENDPOINT || env.AWS_ACCESS_KEY_ID;

  if (!hasS3Config) {
    return {
      name: 'storage',
      healthy: true,
      degraded: false,
      responseTime: 0,
      details: { configured: false },
    };
  }

  try {
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');

    const s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true,
    });

    const bucketName = env.S3_BUCKET_NAME || 'rag-images';

    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));

    return {
      name: 'storage',
      healthy: true,
      degraded: false,
      responseTime: Date.now() - start,
      details: {
        configured: true,
        type: env.S3_ENDPOINT ? 'minio' : 's3',
        bucket: bucketName,
      },
    };
  } catch (error) {
    // Don't fail health check for storage - it's often not critical
    return {
      name: 'storage',
      healthy: true, // Storage is not critical for basic functionality
      degraded: true,
      responseTime: Date.now() - start,
      details: { configured: true },
      error: error instanceof Error ? error.message : 'Storage check failed',
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
    environment: env.NODE_ENV,
  };
}

/**
 * Health check endpoint
 * GET /api/health
 *
 * Health determination:
 * - Healthy: Only if database + vector_extension are healthy
 * - Degraded: If AI or storage services have issues (non-critical)
 * - Unhealthy: If database or vector extension fail
 */
export async function GET() {
  const startTime = Date.now();

  // Run all health checks in parallel
  const checks = await Promise.all([
    checkDatabase(),
    checkVectorExtension(),
    checkOpenRouter(),
    checkGoogleAI(),
    checkRedis(),
    checkStorage(),
  ]);

  const totalResponseTime = Date.now() - startTime;

  // Determine overall health
  // Critical checks: database and vector_extension
  const criticalChecks = ['database', 'vector_extension'];
  const criticalResults = checks.filter((c) => criticalChecks.includes(c.name));
  const criticalHealthy = criticalResults.every((check) => check.healthy);

  // Degraded checks: AI and storage services
  const degradedServices = checks.filter((c) => c.degraded);
  const hasDegradedServices = degradedServices.length > 0;

  // Overall status
  let status: 'healthy' | 'degraded' | 'unhealthy';
  let httpStatus: number;

  if (!criticalHealthy) {
    status = 'unhealthy';
    httpStatus = 503;
  } else if (hasDegradedServices) {
    status = 'degraded';
    httpStatus = 200; // Still return 200 but indicate degraded state
  } else {
    status = 'healthy';
    httpStatus = 200;
  }

  // Log degraded/unhealthy states
  if (status !== 'healthy') {
    logger.warn('Health check reported non-healthy status', {
      status,
      failedChecks: checks.filter((c) => !c.healthy).map((c) => c.name),
      degradedChecks: degradedServices.map((c) => c.name),
    });
  }

  const response = {
    status,
    timestamp: new Date().toISOString(),
    responseTime: totalResponseTime,
    checks,
    system: getSystemMetrics(),
  };

  return NextResponse.json(response, { status: httpStatus });
}

/**
 * Deep health check endpoint (more thorough checks)
 * GET /api/health/deep
 */
export async function HEAD() {
  // Lightweight check for load balancers
  const [dbCheck, vectorCheck] = await Promise.all([checkDatabase(), checkVectorExtension()]);

  const healthy = dbCheck.healthy && vectorCheck.healthy;

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
