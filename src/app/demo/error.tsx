'use client';

import { ErrorBoundary } from '@/components/error-boundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DemoError({ error, reset }: ErrorProps) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Demo Error"
      description="The live demo encountered an error. Please try again."
      sentryTag="demo"
    />
  );
}
