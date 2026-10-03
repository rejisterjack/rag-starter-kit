'use client';

import { AlertTriangle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConnectivity } from '@/hooks/use-connectivity';
import { cn } from '@/lib/utils';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
}

export function DegradationBanner(): React.ReactElement | null {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const { isDegraded, isOffline, isLiefi, isReconnecting } = useConnectivity();

  useEffect(() => {
    // Check service health periodically
    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (cancelled) return;

        // /api/health is a liveness probe returning a bare {status:"ok"} —
        // it exposes no per-service checks, so a non-OK response is the only
        // degradation signal available.
        if (!res.ok) {
          if (!cancelled) {
            setServices([{ name: 'Application', status: res.status >= 500 ? 'down' : 'degraded' }]);
          }
          return;
        }
        const data = await res.json();

        const svcs: ServiceStatus[] = [];
        if (Array.isArray(data?.checks) || (data?.checks && typeof data.checks === 'object')) {
          for (const [key, val] of Object.entries(data.checks)) {
            const check = val as { status?: string; healthy?: boolean };
            if (typeof check.status === 'string' || typeof check.healthy === 'boolean') {
              svcs.push({
                name: formatName(key),
                status:
                  check.healthy === false || check.status === 'unhealthy'
                    ? 'down'
                    : check.status === 'degraded'
                      ? 'degraded'
                      : 'healthy',
              });
            }
          }
        }
        if (!cancelled) setServices(svcs);
      } catch {
        // Health check itself failed - likely offline
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      cancelled = true;
      setServices([]);
      clearInterval(interval);
    };
  }, []);

  // Offline state
  if (isOffline) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive animate-in slide-in-from-top'
        )}
        role="status"
        aria-live="polite"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>You&apos;re offline. Messages will queue and sync when you reconnect.</span>
      </div>
    );
  }

  // Reconnecting state
  if (isReconnecting) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 animate-in slide-in-from-top'
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>Reconnecting... Your messages are waiting to sync.</span>
      </div>
    );
  }

  // Lie-fi state
  if (isLiefi) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 animate-in slide-in-from-top'
        )}
        role="status"
        aria-live="polite"
      >
        <Wifi className="h-3.5 w-3.5 shrink-0" />
        <span>Slow connection detected. Using cached data where possible.</span>
      </div>
    );
  }

  // Degraded connection (but still online)
  if (isDegraded) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-600 dark:text-yellow-400 animate-in slide-in-from-top'
        )}
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Connection is slow. Some features may take longer to respond.</span>
      </div>
    );
  }

  // Server-side degradation
  const degraded = services.filter((s) => s.status !== 'healthy');
  if (degraded.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-xs text-orange-600 dark:text-orange-400 animate-in slide-in-from-top">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        {degraded.length === 1 ? (
          <>
            {degraded[0].name} is {degraded[0].status}
          </>
        ) : (
          <>
            {degraded.length} services degraded: {degraded.map((s) => s.name).join(', ')}
          </>
        )}
      </span>
    </div>
  );
}

function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
