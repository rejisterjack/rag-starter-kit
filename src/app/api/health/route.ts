/**
 * Health Check Endpoint
 *
 * GET /api/health — Instant liveness check
 * HEAD /api/health — Ultra-lightweight for load balancers
 */

import { NextResponse } from 'next/server';
import { checkMemoryRateLimit } from '@/lib/security/rate-limiter';

export async function GET(): Promise<NextResponse> {
  const healthLimit = checkMemoryRateLimit('health:global', 60, 60_000);
  if (!healthLimit.allowed) {
    return NextResponse.json(
      { status: 'ok' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { status: 'ok' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: { 'X-Health-Status': 'ok' },
  });
}
