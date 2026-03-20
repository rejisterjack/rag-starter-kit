'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log admin errors for monitoring
    console.error('Admin page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto" />
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Admin Error</h1>
          <p className="text-muted-foreground">
            There was an error loading the admin panel.
          </p>
        </div>

        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
