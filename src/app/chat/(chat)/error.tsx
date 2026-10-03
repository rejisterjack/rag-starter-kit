'use client';

import { ErrorBoundary } from '@/components/error-boundary';

export default function ChatError({
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
      title="Something went wrong"
      description="We encountered an error loading the chat. Please try again."
      showDevError
    />
  );
}
