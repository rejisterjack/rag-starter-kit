/**
 * /api/ready — Kubernetes/container readiness probe
 *
 * Distinct from /api/health (liveness probe).
 * Returns 200 only when the database is reachable.
 * Returns 503 if the database is not ready.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { prisma } = await import('@/lib/db');
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
