'use client';

import { CloudOff, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useOfflineStatus } from '@/hooks/use-pwa';
import { cn } from '@/lib/utils';

/**
 * Props for OfflineIndicator component
 */
interface OfflineIndicatorProps {
  /** Visual variant */
  variant?: 'banner' | 'toast' | 'minimal';
  /** Position for banner variant */
  position?: 'top' | 'bottom';
  /** Custom className */
  className?: string;
  /** Show reconnect button */
  showReconnect?: boolean;
  /** Auto-hide after coming back online (ms) */
  autoHideDelay?: number;
}

/**
 * Offline status indicator component
 * Shows when the app loses network connectivity
 *
 * @example
 * ```tsx
 * // Banner at top (default)
 * <OfflineIndicator />
 *
 * // Toast variant
 * <OfflineIndicator variant="toast" />
 *
 * // Minimal badge
 * <OfflineIndicator variant="minimal" />
 * ```
 */
export function OfflineIndicator({
  variant = 'banner',
  position = 'top',
  className,
  showReconnect = true,
  autoHideDelay = 5000,
}: OfflineIndicatorProps) {
  const { isOffline, wasOffline, formattedOfflineDuration } = useOfflineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  useEffect(() => {
    if (wasOffline) {
      setShowReconnected(true);
      setIsHiding(false);
      const timer = setTimeout(() => {
        setIsHiding(true);
        setTimeout(() => setShowReconnected(false), 300);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [wasOffline, autoHideDelay]);

  const handleReconnect = () => {
    window.location.reload();
  };

  // Banner variant
  if (variant === 'banner') {
    return (
      <>
        {isOffline && (
          <div
            className={cn(
              'fixed left-0 right-0 z-50 flex items-center justify-center gap-3 border-b bg-destructive/95 px-4 py-2 text-destructive-foreground shadow-lg backdrop-blur',
              'transition-all duration-300 ease-out',
              position === 'top' ? 'top-0' : 'bottom-0 border-t',
              className
            )}
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              You&apos;re offline
              {formattedOfflineDuration && (
                <span className="ml-1 opacity-80">({formattedOfflineDuration})</span>
              )}
            </span>
            {showReconnect && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1 text-xs"
                onClick={handleReconnect}
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Reconnected notification */}
        {showReconnected && !isOffline && (
          <div
            className={cn(
              'fixed left-0 right-0 z-50 flex items-center justify-center gap-2 border-b bg-green-600/95 px-4 py-2 text-white shadow-lg backdrop-blur',
              'transition-all duration-300 ease-out',
              position === 'top' ? 'top-0' : 'bottom-0 border-t',
              isHiding ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100',
              className
            )}
          >
            <Wifi className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Back online!</span>
          </div>
        )}
      </>
    );
  }

  // Toast variant
  if (variant === 'toast') {
    return (
      <>
        {isOffline && (
          <div
            className={cn(
              'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg',
              'animate-slide-in-from-bottom',
              className
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <WifiOff className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">You&apos;re offline</p>
              <p className="text-sm text-muted-foreground">Changes will sync when you reconnect</p>
            </div>
            {showReconnect && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleReconnect}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Reconnected toast */}
        {showReconnected && !isOffline && (
          <div
            className={cn(
              'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg',
              'transition-all duration-300',
              isHiding ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
              className
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium">Back online!</p>
              <p className="text-sm text-muted-foreground">You&apos;re connected again</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Minimal variant - small badge
  if (!isOffline) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive animate-fade-in',
        className
      )}
    >
      <CloudOff className="h-3 w-3" />
      Offline
    </span>
  );
}

/**
 * Network status badge
 * Shows online/offline status as a small indicator
 */
export function NetworkStatusBadge({ className }: { className?: string }) {
  const { isOffline } = useOfflineStatus();

  if (isOffline) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive animate-fade-in',
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        Offline
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-400',
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Online
    </span>
  );
}

/**
 * Connection status dot
 * Minimal indicator showing connection state
 */
export function ConnectionDot({ className }: { className?: string }) {
  const { isOffline } = useOfflineStatus();

  return (
    <span
      className={cn(
        'relative flex h-3 w-3',
        isOffline ? 'text-destructive' : 'text-green-500',
        className
      )}
      title={isOffline ? 'Offline' : 'Online'}
    >
      {!isOffline && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
      )}
      <span
        className={cn(
          'relative inline-flex h-3 w-3 rounded-full',
          isOffline ? 'bg-destructive' : 'bg-current'
        )}
      />
    </span>
  );
}

/**
 * Skeleton loader for offline state
 * Shows a placeholder when content can't be loaded offline
 */
export function OfflineSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <CloudOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Content unavailable offline</p>
        <p className="text-sm text-muted-foreground">
          Connect to the internet to view this content
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
