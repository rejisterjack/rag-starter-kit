'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Report error to external services (Sentry, LogRocket, etc.)
 * This is the central hook for production error capture.
 *
 * To integrate Sentry:
 *   1. pnpm add @sentry/nextjs
 *   2. Run `npx @sentry/wizard@latest -i nextjs`
 *   3. Replace the console.error below with Sentry.captureException(error)
 */
function reportError(error: Error & { digest?: string }): void {
  // Always log to console for Vercel's log drain / runtime logs
  console.error('[GlobalError]', {
    message: error.message,
    digest: error.digest,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // ─── Sentry Integration (uncomment after installing @sentry/nextjs) ───
  // import * as Sentry from '@sentry/nextjs';
  // Sentry.captureException(error, {
  //   tags: { digest: error.digest },
  //   level: 'fatal',
  // });

  // ─── Custom Error Reporting Endpoint ───
  // For environments without Sentry, send errors to your own API
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      const payload = {
        message: error.message,
        digest: error.digest,
        stack: error.stack?.slice(0, 2000), // Truncate large stacks
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      // Use sendBeacon for reliability during page unload/crash
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/error-report',
          new Blob([JSON.stringify(payload)], { type: 'application/json' })
        );
      } else {
        fetch('/api/error-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Silently fail — we're already in an error state
        });
      }
    } catch {
      // Don't throw from the error reporter
    }
  }
}

export default function GlobalError({ error, reset }: GlobalErrorProps): React.ReactElement {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#fafafa',
            color: '#111',
            padding: '2rem',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            <div
              style={{
                fontSize: '4rem',
                fontWeight: 700,
                color: '#dc2626',
                lineHeight: 1,
              }}
            >
              500
            </div>
            <h2
              style={{
                marginTop: '1rem',
                fontSize: '1.5rem',
                fontWeight: 600,
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                marginTop: '0.75rem',
                color: '#6b7280',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              An unexpected error occurred. Our team has been notified and is looking into it.
            </p>
            {error.digest && (
              <p
                style={{
                  marginTop: '0.5rem',
                  color: '#9ca3af',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
            <div
              style={{
                marginTop: '2rem',
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
