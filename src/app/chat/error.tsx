'use client';

/**
 * Chat Route Error Boundary
 * 
 * Handles errors specific to the chat route with user-friendly
 * recovery options and proper error reporting.
 */

import { logger } from '@/lib/logger';
import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChatErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChatError({ error, reset }: ChatErrorProps) {
  useEffect(() => {
    // Log to error tracking service
    logger.error('Chat route error', { error: error.message, digest: error.digest });
  }, [error]);

  const isMessageError = error.message?.includes('message') || error.message?.includes('stream');
  const isAuthError = error.message?.includes('auth') || error.message?.includes('unauthorized');

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            {isAuthError ? 'Authentication Error' : 'Chat Error'}
          </CardTitle>
          <CardDescription>
            {isAuthError 
              ? 'Your session may have expired. Please sign in again.'
              : isMessageError
                ? 'Failed to load messages. Please try again.'
                : 'Something went wrong with the chat. Please try again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-muted rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-auto max-h-32">
              {error.message}
              {error.digest && <div className="mt-1 text-destructive">Digest: {error.digest}</div>}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            {isAuthError ? (
              <Button variant="outline" className="w-full" onClick={() => window.location.href = '/login'}>
                Sign In
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => window.location.href = '/chat'}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                New Conversation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
