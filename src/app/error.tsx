'use client';

import { ErrorBoundary } from '@/components/error-boundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  return <ErrorBoundary error={error} reset={reset} showDevError />;
}
