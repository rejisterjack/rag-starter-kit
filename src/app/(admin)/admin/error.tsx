'use client';

/**
 * Admin Route Error Boundary
 *
 * Handles errors specific to admin routes with appropriate
 * messaging for admin users.
 */

import { AlertTriangle, Home, RefreshCw, Shield } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    logger.error('Admin route error', { error: error.message, digest: error.digest });
  }, [error]);

  const isPermissionError =
    error.message?.includes('permission') || error.message?.includes('forbidden');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            {isPermissionError ? (
              <Shield className="h-6 w-6 text-amber-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <CardTitle className="text-xl">
            {isPermissionError ? 'Access Denied' : 'Admin Error'}
          </CardTitle>
          <CardDescription>
            {isPermissionError
              ? 'You do not have permission to access this admin area.'
              : 'An error occurred while loading the admin panel.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-muted rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-auto max-h-32">
              {error.message}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {!isPermissionError && (
              <Button onClick={reset} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = '/')}
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
