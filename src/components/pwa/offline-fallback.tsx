/**
 * Generic offline content fallback wrapper
 * Provides skeleton/placeholder content when data is unavailable offline
 */

'use client';

import { CloudOff, Database, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useConnectivity } from '@/hooks/use-connectivity';
import { cn } from '@/lib/utils';

interface OfflineFallbackProps {
  /** Content to show when online or cached data available */
  children: ReactNode;
  /** Whether data is available (from cache or network) */
  hasData: boolean;
  /** Whether loading is in progress */
  isLoading?: boolean;
  /** Whether data is from cache */
  isFromCache?: boolean;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Callback to retry loading */
  onRetry?: () => void;
  /** Custom className */
  className?: string;
  /** Type of content for better messaging */
  contentType?: string;
}

/**
 * Wraps content with intelligent offline fallback behavior
 *
 * @example
 * ```tsx
 * const { data, isLoading, isFromCache, refetch } = useOfflineQuery(...);
 *
 * <OfflineFallback
 *   hasData={!!data}
 *   isLoading={isLoading}
 *   isFromCache={isFromCache}
 *   onRetry={refetch}
 *   contentType="conversations"
 * >
 *   <ConversationList data={data} />
 * </OfflineFallback>
 * ```
 */
export function OfflineFallback({
  children,
  hasData,
  isLoading = false,
  isFromCache = false,
  fallback,
  onRetry,
  className,
  contentType = 'content',
}: OfflineFallbackProps) {
  const { isOffline, isLiefi } = useConnectivity();

  // Has data - show it (with optional cache indicator)
  if (hasData) {
    return (
      <div className={cn('relative', className)}>
        {children}
        {isFromCache && (isOffline || isLiefi) && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm border backdrop-blur-sm">
              <Database className="h-2.5 w-2.5" />
              Cached
            </span>
          </div>
        )}
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-4 py-12', className)}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading {contentType}...</p>
      </div>
    );
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Offline with no data
  if (isOffline || isLiefi) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center',
          className
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{isLiefi ? 'Connection too slow' : "You're offline"}</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isLiefi
              ? `Unable to load ${contentType} due to slow connection. Check your network.`
              : `Connect to the internet to load ${contentType}.`}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  // Online but no data and not loading (error state)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <CloudOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Unable to load {contentType}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Something went wrong. Please try again.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
