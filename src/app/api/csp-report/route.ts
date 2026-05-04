import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * CSP Violation Report Endpoint
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * In production, these should be forwarded to your monitoring service.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Log CSP violations for monitoring
    const report = body['csp-report'] || body;

    if (process.env.NODE_ENV === 'development') {
      // biome-ignore lint/suspicious/noConsole: Intentional CSP violation logging
      console.warn('[CSP Violation]', {
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
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
