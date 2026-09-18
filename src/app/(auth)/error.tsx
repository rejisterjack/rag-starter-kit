'use client';

import { ErrorBoundary } from '@/components/error-boundary';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Authentication Error"
      description="There was a problem with authentication. Please try again."
      showHome={false}
    />
  );
}
