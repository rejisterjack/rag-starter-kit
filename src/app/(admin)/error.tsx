'use client';

import { ErrorBoundary } from '@/components/error-boundary';

export default function AdminError({
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
      title="Admin Error"
      description="There was an error loading the admin panel."
      homeHref="/admin"
    />
  );
}
