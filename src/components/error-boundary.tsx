'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { clientLogger } from '@/lib/client-logger';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  showHome?: boolean;
  homeHref?: string;
  homeLabel?: string;
  showDevError?: boolean;
  sentryTag?: string;
}

export function ErrorBoundary({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  showHome = true,
  homeHref = '/',
  homeLabel = 'Go Home',
  showDevError = false,
  sentryTag,
}: ErrorBoundaryProps) {
  useEffect(() => {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { digest: error.digest, ...(sentryTag ? { section: sentryTag } : {}) },
      });
    }

    if (process.env.NODE_ENV === 'production') {
      try {
        const payload = {
          message: error.message,
          digest: error.digest,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        };
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/error-report',
            new Blob([JSON.stringify(payload)], { type: 'application/json' })
          );
        }
      } catch (error) {
        clientLogger.error('Failed to report error via beacon', { error });
      }
    }
  }, [error, sentryTag]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
          {showDevError && process.env.NODE_ENV === 'development' && (
            <p className="text-sm text-red-500 font-mono mt-2">{error.message}</p>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          {showHome && (
            <Button asChild variant="outline">
              <Link href={homeHref}>
                <Home className="h-4 w-4 mr-2" />
                {homeLabel}
              </Link>
            </Button>
          )}
        </div>

        {error.digest && <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>}
      </div>
    </div>
  );
}
