import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/error-report
 *
 * Receives client-side error reports from global-error.tsx.
 * Logs them server-side where they can be picked up by log drains,
 * Sentry, or any observability pipeline.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const {
      message,
      digest,
      stack,
      url: errorUrl,
      userAgent,
      timestamp,
    } = body as {
      message?: string;
      digest?: string;
      stack?: string;
      url?: string;
      userAgent?: string;
      timestamp?: string;
    };

    // Validate required fields
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing error message' }, { status: 400 });
    }

    // Log the client error server-side
    logger.error('Client error report', {
      clientError: true,
      message: message.slice(0, 500),
      digest,
      stack: stack?.slice(0, 2000),
      url: errorUrl?.slice(0, 500),
      userAgent: userAgent?.slice(0, 300),
      timestamp,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      requestId: req.headers.get('x-request-id') ?? undefined,
    });

    // ─── Sentry Integration ───
    // import * as Sentry from '@sentry/nextjs';
    // Sentry.captureMessage(`Client Error: ${message}`, {
    //   level: 'error',
    //   tags: { digest, source: 'client-error-report' },
    //   extra: { stack, url: errorUrl, userAgent },
    // });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
