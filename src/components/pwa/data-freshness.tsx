/**
 * Data freshness indicator components
 * Shows cache age and data staleness with visual indicators
 */

'use client';

import { Clock, RefreshCw } from 'lucide-react';
import type { DataFreshness, DataFreshnessLevel } from '@/lib/offline/types';
import { cn } from '@/lib/utils';

// ─── FreshnessBadge ───────────────────────────────────────────────────────────

interface FreshnessBadgeProps {
  freshness: DataFreshness;
  className?: string;
  /** Show refresh indicator */
  showRefreshing?: boolean;
  /** Compact mode (dot only) */
  compact?: boolean;
}

const FRESHNESS_STYLES: Record<
  DataFreshnessLevel,
  {
    dotClass: string;
    textClass: string;
    label: string;
  }
> = {
  fresh: {
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    label: 'Fresh',
  },
  stale: {
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
    label: 'Stale',
  },
  expired: {
    dotClass: 'bg-destructive',
    textClass: 'text-destructive',
    label: 'Expired',
  },
  unknown: {
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
    label: 'Unknown',
  },
};

/**
 * Badge showing data freshness level
 *
 * @example
 * ```tsx
 * const { freshness } = useOfflineQuery({ key: 'data', fetcher: fetchData });
 * <FreshnessBadge freshness={freshness} />
 * ```
 */
export function FreshnessBadge({
  freshness,
  className,
  showRefreshing = true,
  compact = false,
}: FreshnessBadgeProps) {
  if (freshness.level === 'unknown' && !freshness.isRefreshing) return null;

  const style = FRESHNESS_STYLES[freshness.level];

  if (compact) {
    return (
      <span
        className={cn('relative inline-flex h-2 w-2', className)}
        title={`${style.label} — ${freshness.ageFormatted}`}
      >
        {freshness.isRefreshing && showRefreshing && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', style.dotClass)} />
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', style.textClass, className)}>
      {freshness.isRefreshing && showRefreshing ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <span>{freshness.ageFormatted || style.label}</span>
    </span>
  );
}

// ─── FreshnessBar ─────────────────────────────────────────────────────────────

/**
 * Visual bar indicating data age relative to TTL
 */
export function FreshnessBar({
  freshness,
  className,
}: {
  freshness: DataFreshness;
  className?: string;
}) {
  if (freshness.level === 'unknown') return null;

  const barColor = {
    fresh: 'bg-emerald-500',
    stale: 'bg-amber-500',
    expired: 'bg-destructive',
    unknown: 'bg-muted',
  }[freshness.level];

  // Approximate percentage (cap at 100)
  const ageMinutes = freshness.age / 60000;
  const percentage = Math.min((ageMinutes / 10) * 100, 100); // 10 min = 100%

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-muted-foreground whitespace-nowrap">{freshness.ageFormatted}</span>
    </div>
  );
}

// ─── CachedDataWrapper ────────────────────────────────────────────────────────

/**
 * Wrapper that shows subtle staleness indicator around cached content
 */
export function CachedDataWrapper({
  freshness,
  children,
  className,
  showBadge = true,
}: {
  freshness: DataFreshness;
  children: React.ReactNode;
  className?: string;
  showBadge?: boolean;
}) {
  const isStaleOrExpired = freshness.level === 'stale' || freshness.level === 'expired';

  return (
    <div className={cn('relative', className)}>
      {isStaleOrExpired && (
        <div
          className={cn(
            'absolute inset-0 rounded-lg border-2 pointer-events-none z-10',
            freshness.level === 'stale' && 'border-amber-500/20',
            freshness.level === 'expired' && 'border-destructive/20'
          )}
        />
      )}

      {showBadge && freshness.level !== 'unknown' && freshness.level !== 'fresh' && (
        <div className="absolute -top-2 right-2 z-20">
          <FreshnessBadge freshness={freshness} />
        </div>
      )}

      {children}
    </div>
  );
}
