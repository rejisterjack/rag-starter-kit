/**
 * Enhanced multi-state connectivity banner
 * Communicates Online/Offline/Reconnecting/Lie-fi states with
 * smooth animated transitions and non-intrusive feedback.
 */

'use client';

import { AlertTriangle, CloudOff, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConnectivity } from '@/hooks/use-connectivity';
import type { ConnectivityState } from '@/lib/offline/types';
import { cn } from '@/lib/utils';

interface ConnectivityBannerProps {
  /** Position of the banner */
  position?: 'top' | 'bottom';
  /** Custom className */
  className?: string;
  /** Auto-hide reconnected message after ms */
  autoHideDelay?: number;
  /** Whether to show RTT info in degraded state */
  showRttInfo?: boolean;
}

const STATE_CONFIG: Record<
  ConnectivityState,
  {
    icon: typeof Wifi;
    label: string;
    description: string;
    bgClass: string;
    textClass: string;
    animate?: string;
  }
> = {
  online: {
    icon: Wifi,
    label: 'Back online',
    description: 'Connection restored',
    bgClass: 'bg-emerald-600/95 dark:bg-emerald-700/95',
    textClass: 'text-white',
  },
  offline: {
    icon: WifiOff,
    label: "You're offline",
    description: 'Changes will sync when you reconnect',
    bgClass: 'bg-destructive/95',
    textClass: 'text-destructive-foreground',
  },
  reconnecting: {
    icon: Loader2,
    label: 'Reconnecting...',
    description: 'Trying to restore connection',
    bgClass: 'bg-blue-600/95 dark:bg-blue-700/95',
    textClass: 'text-white',
    animate: 'animate-spin',
  },
  liefi: {
    icon: AlertTriangle,
    label: 'Slow connection',
    description: 'Using cached data — some features may be limited',
    bgClass: 'bg-amber-500/95 dark:bg-amber-600/95',
    textClass: 'text-white',
  },
};

/**
 * Multi-state connectivity banner component
 *
 * @example
 * ```tsx
 * // In your layout
 * <ConnectivityBanner position="top" />
 * ```
 */
export function ConnectivityBanner({
  position = 'top',
  className,
  autoHideDelay = 5000,
  showRttInfo = false,
}: ConnectivityBannerProps) {
  const { state, rtt, stateDuration, check } = useConnectivity();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [previousState, setPreviousState] = useState<ConnectivityState>('online');

  // Track state changes and manage visibility
  useEffect(() => {
    if (state === 'online' && previousState !== 'online') {
      // Just came back online - show briefly then hide
      setIsVisible(true);
      setIsExiting(false);

      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          setIsVisible(false);
          setIsExiting(false);
        }, 300);
      }, autoHideDelay);

      setPreviousState(state);
      return () => clearTimeout(timer);
    }

    if (state !== 'online') {
      // Show banner for non-online states
      setIsVisible(true);
      setIsExiting(false);
    }

    setPreviousState(state);
    return undefined;
  }, [state, previousState, autoHideDelay]);

  // Don't render if online and not transitioning
  if (!isVisible) return null;

  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed left-0 right-0 z-[100] flex items-center justify-center',
        'transition-all duration-300 ease-out',
        position === 'top' ? 'top-0' : 'bottom-0',
        isExiting && (position === 'top' ? '-translate-y-full' : 'translate-y-full'),
        !isExiting && 'translate-y-0',
        isExiting ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      <div
        className={cn(
          'flex w-full items-center justify-center gap-3 px-4 py-2.5 shadow-lg backdrop-blur-sm',
          config.bgClass,
          config.textClass
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', config.animate)} />

        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{config.label}</span>
          {state !== 'online' && (
            <>
              <span className="opacity-60">·</span>
              <span className="opacity-80">{config.description}</span>
            </>
          )}
          {state === 'offline' && stateDuration && (
            <span className="opacity-60">({stateDuration})</span>
          )}
          {showRttInfo && state === 'liefi' && rtt && <span className="opacity-60">({rtt}ms)</span>}
        </div>

        {(state === 'offline' || state === 'liefi') && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 text-xs bg-white/20 hover:bg-white/30 border-0"
            onClick={() => void check()}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact connectivity indicator dot
 * Suitable for placement in navbars or status bars
 */
export function ConnectivityDot({ className }: { className?: string }) {
  const { state } = useConnectivity();

  const dotColor = {
    online: 'bg-emerald-500',
    offline: 'bg-destructive',
    reconnecting: 'bg-blue-500',
    liefi: 'bg-amber-500',
  }[state];

  const label = {
    online: 'Online',
    offline: 'Offline',
    reconnecting: 'Reconnecting',
    liefi: 'Slow connection',
  }[state];

  return (
    <span
      className={cn('relative inline-flex h-2.5 w-2.5', className)}
      title={label}
      role="img"
      aria-label={label}
    >
      {state === 'reconnecting' && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            dotColor
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dotColor)} />
    </span>
  );
}

/**
 * Connectivity status chip for use in UI headers
 */
export function ConnectivityChip({ className }: { className?: string }) {
  const { state, stateDuration, rtt } = useConnectivity();

  if (state === 'online') return null;

  const config = {
    offline: {
      icon: CloudOff,
      label: `Offline${stateDuration ? ` · ${stateDuration}` : ''}`,
      chipClass: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    reconnecting: {
      icon: Loader2,
      label: 'Reconnecting...',
      chipClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    liefi: {
      icon: AlertTriangle,
      label: `Slow${rtt ? ` · ${rtt}ms` : ''}`,
      chipClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
  }[state];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        config.chipClass,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', state === 'reconnecting' && 'animate-spin')} />
      {config.label}
    </span>
  );
}
