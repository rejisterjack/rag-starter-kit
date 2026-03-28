'use client';

/**
 * Login Route Error Boundary
 *
 * Handles authentication-related errors with appropriate
 * user guidance for login issues.
 */

import { Lock, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';

interface LoginErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LoginError({ error, reset }: LoginErrorProps) {
  useEffect(() => {
    logger.error('Login route error', { error: error.message, digest: error.digest });
  }, [error]);

  const isOAuthError = error.message?.includes('oauth') || error.message?.includes('provider');
  const isCredentialsError =
    error.message?.includes('credentials') || error.message?.includes('password');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Authentication Error</CardTitle>
          <CardDescription>
            {isOAuthError
              ? 'There was a problem with the OAuth provider. Please try again.'
              : isCredentialsError
                ? 'Invalid credentials. Please check your email and password.'
                : 'Unable to sign in. Please try again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-muted rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-auto max-h-32">
              {error.message}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = '/forgot-password')}
            >
              Forgot Password?
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
