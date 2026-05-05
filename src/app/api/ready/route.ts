/**
 * /api/ready — Kubernetes/container readiness probe
 *
 * Distinct from /api/health (liveness probe).
 * Returns 200 only when all critical dependencies are reachable.
 * Returns 503 if any dependency is not ready.
 *
 * Use this in:
 * - Kubernetes readinessProbe
 * - Docker HEALTHCHECK
 * - Vercel deployment gate scripts
 * - Railway / Render health checks
 */

import { NextResponse } from 'next/server';

interface ServiceStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Dynamic import to avoid loading the full app stack during early startup
    const { prisma } = await import('@/lib/db');
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Database unreachable',
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();

  // Redis is optional — if not configured, report as ok (using fallback)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  if (!redisUrl) {
    return { ok: true, latencyMs: 0, error: 'Not configured — using in-memory fallback' };
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    });
    await redis.ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Redis unreachable',
    };
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const ready = database.ok; // Database is required; Redis is optional

  const body: ReadinessResponse = {
    ready,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: { database, redis },
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}
