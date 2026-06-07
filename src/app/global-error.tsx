'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function reportError(error: Error & { digest?: string }): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: { digest: error.digest },
      level: 'fatal',
    });
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      const payload = {
        message: error.message,
        digest: error.digest,
        stack: error.stack?.slice(0, 2000),
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

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
        }).catch(() => {});
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
    <html lang="en" suppressHydrationWarning>
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
              <a
                href="/"
                style={{
                  display: 'inline-block',
                  padding: '0.625rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
