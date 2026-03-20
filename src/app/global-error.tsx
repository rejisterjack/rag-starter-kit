'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps): React.ReactElement {
  useEffect(() => {
    // Log to error reporting service
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-red-600">Error</h1>
            <h2 className="mt-4 text-2xl font-semibold">Something went wrong!</h2>
            <p className="mt-2 text-gray-600">
              {error.message || 'A critical error occurred.'}
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
