'use client';

import { ErrorBoundary } from '@/components/error-boundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DocsError({ error, reset }: ErrorProps) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Documentation Error"
      description="Failed to load documentation. Please try again."
      homeHref="/docs"
      homeLabel="Back to Docs"
      sentryTag="docs"
    />
  );
}
