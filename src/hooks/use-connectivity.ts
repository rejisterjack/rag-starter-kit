/**
 * React hook for advanced connectivity state management
 * Integrates with the ConnectivityMonitor to provide real-time
 * connectivity state including Lie-fi detection
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkConnectivity,
  onConnectivityChange,
  startConnectivityMonitoring,
} from '@/lib/offline/connectivity-monitor';
import type { ConnectivityInfo, ConnectivityState } from '@/lib/offline/types';

export interface UseConnectivityReturn {
  /** Current connectivity state */
  state: ConnectivityState;
  /** Whether the device is online (includes lie-fi as technically online) */
  isOnline: boolean;
  /** Whether the device is completely offline */
  isOffline: boolean;
  /** Whether we're in a lie-fi state (appears online but no real connectivity) */
  isLiefi: boolean;
  /** Whether connection quality is degraded */
  isDegraded: boolean;
  /** Whether we're currently reconnecting */
  isReconnecting: boolean;
  /** Full connectivity info */
  info: ConnectivityInfo;
  /** Effective connection type (4g, 3g, 2g, slow-2g) */
  effectiveType: string | undefined;
  /** Round-trip time in ms */
  rtt: number | undefined;
  /** Time since last state change (formatted) */
  stateDuration: string;
  /** Force a connectivity check */
  check: () => Promise<void>;
}

/**
 * Hook providing comprehensive connectivity state management
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, isOffline, isLiefi, isDegraded, check } = useConnectivity();
 *
 *   if (isOffline) return <OfflineBanner />;
 *   if (isLiefi) return <SlowConnectionBanner />;
 *   if (isDegraded) return <DegradedBanner />;
 *
 *   return <Content />;
 * }
 * ```
 */
export function useConnectivity(): UseConnectivityReturn {
  const [info, setInfo] = useState<ConnectivityInfo>({
    state: 'online',
    lastStateChange: Date.now(),
    isDegraded: false,
  });
  const [stateDuration, setStateDuration] = useState('');
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Start monitoring
    startConnectivityMonitoring();

    // Subscribe to changes
    const unsubscribe = onConnectivityChange((newInfo) => {
      setInfo(newInfo);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update duration timer
  useEffect(() => {
    const updateDuration = () => {
      const elapsed = Date.now() - info.lastStateChange;
      setStateDuration(formatDuration(elapsed));
    };

    updateDuration();
    durationTimer.current = setInterval(updateDuration, 1000);

    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, [info.lastStateChange]);

  const check = useCallback(async () => {
    const result = await checkConnectivity();
    setInfo(result);
  }, []);

  return {
    state: info.state,
    isOnline: info.state === 'online',
    isOffline: info.state === 'offline',
    isLiefi: info.state === 'liefi',
    isDegraded: info.isDegraded,
    isReconnecting: info.state === 'reconnecting',
    info,
    effectiveType: info.effectiveType,
    rtt: info.rtt,
    stateDuration,
    check,
  };
}

/**
 * Lightweight hook that only provides boolean online/offline state
 * Use when you don't need full connectivity details
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
