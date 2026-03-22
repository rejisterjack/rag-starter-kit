'use client';

/**
 * Share Route Error Boundary
 * 
 * Handles errors for shared conversation links.
 */

import { logger } from '@/lib/logger';
import { Link2, AlertCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ShareErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ShareError({ error }: ShareErrorProps) {
  useEffect(() => {
    logger.error('Share route error', { error: error.message, digest: error.digest });
  }, [error]);

  const isExpired = error.message?.includes('expired') || error.message?.includes(' Expired');
  const isNotFound = error.message?.includes('not found') || error.message?.includes('404');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Link2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">
            {isExpired ? 'Link Expired' : isNotFound ? 'Link Not Found' : 'Invalid Link'}
          </CardTitle>
          <CardDescription>
            {isExpired
              ? 'This shared conversation link has expired.'
              : isNotFound
                ? 'The shared conversation could not be found.'
                : 'This link appears to be invalid or corrupted.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/'}
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
