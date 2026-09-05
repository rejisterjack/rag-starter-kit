import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkMemoryRateLimit } from '@/lib/security/rate-limiter';

/**
 * CSP Violation Report Endpoint
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * In production, these should be forwarded to your monitoring service.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // In-memory rate limit (30/min) — CSP reports are high-volume, low-value;
  // using in-memory avoids burning Redis commands on the free tier.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const cspLimit = checkMemoryRateLimit(`csp:${ip}`, 30, 60_000);
  if (!cspLimit.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = await req.json();

    // Log CSP violations for monitoring
    const report = body['csp-report'] || body;

    if (process.env.NODE_ENV === 'development') {
      logger.warn('[CSP Violation]', {
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
      });
    }

    // In production, forward to your monitoring service (e.g., Sentry, Datadog)
    // Example: await fetch(process.env.CSP_REPORT_ENDPOINT, { method: 'POST', body: JSON.stringify(report) });

    return NextResponse.json({ received: true }, { status: 204 });
  } catch {
    // Always return 204 for CSP reports — never block the browser
    return new NextResponse(null, { status: 204 });
  }
}

// Allow browsers to send reports without CORS issues
// Restrict to same-origin — CSP reports are only sent by our own pages.
export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.NEXTAUTH_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '';

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
