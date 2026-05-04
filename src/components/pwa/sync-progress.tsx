/**
 * Sync progress indicator components
 * Shows background sync status including pending actions,
 * progress during sync, and failed action management.
 */

'use client';

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useSyncStatus } from '@/hooks/use-offline-query';
import { pendingActions as pendingActionsDB } from '@/lib/offline/indexed-db';
import { getSyncManager } from '@/lib/offline/sync-manager';
import type { SyncAction } from '@/lib/offline/types';
import { cn } from '@/lib/utils';

// ─── SyncProgressBar ──────────────────────────────────────────────────────────

interface SyncProgressBarProps {
  className?: string;
  /** Show text label */
  showLabel?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Progress bar showing background sync progress
 *
 * @example
 * ```tsx
 * <SyncProgressBar showLabel />
 * ```
 */
export function SyncProgressBar({
  className,
  showLabel = true,
  compact = false,
}: SyncProgressBarProps) {
  const { progress, pendingCount, isSyncing } = useSyncStatus();

  if (pendingCount === 0 && !isSyncing) return null;

  const percentage =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className={cn('w-full', className)}>
      {showLabel && !compact && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {isSyncing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                {pendingCount} pending
              </>
            )}
          </span>
          {isSyncing && (
            <span>
              {progress.completed}/{progress.total}
            </span>
          )}
        </div>
      )}

      <div className={cn('w-full overflow-hidden rounded-full bg-muted', compact ? 'h-1' : 'h-2')}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isSyncing ? 'bg-blue-500' : 'bg-amber-500',
            isSyncing && 'animate-pulse'
          )}
          style={{ width: `${isSyncing ? percentage : 0}%` }}
        />
      </div>

      {showLabel && compact && pendingCount > 0 && (
        <span className="mt-0.5 text-[10px] text-muted-foreground">{pendingCount} pending</span>
      )}
    </div>
  );
}

// ─── SyncStatusBadge ──────────────────────────────────────────────────────────

/**
 * Small badge showing sync status
 * Suitable for navbars or status areas
 */
export function SyncStatusBadge({ className }: { className?: string }) {
  const { pendingCount, isSyncing, hasFailed, sync } = useSyncStatus();

  if (pendingCount === 0 && !isSyncing) return null;

  return (
    <button
      type="button"
      onClick={hasFailed ? () => void sync() : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        isSyncing && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        !isSyncing &&
          hasFailed &&
          'bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20',
        !isSyncing &&
          !hasFailed &&
          'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        className
      )}
    >
      {isSyncing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : hasFailed ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isSyncing ? 'Syncing' : `${pendingCount} pending`}
    </button>
  );
}

// ─── SyncActionList ───────────────────────────────────────────────────────────

interface SyncActionListProps {
  className?: string;
  /** Maximum actions to show */
  maxItems?: number;
  /** Show action management buttons */
  showActions?: boolean;
}

/**
 * List of pending/failed sync actions with management controls
 *
 * @example
 * ```tsx
 * <SyncActionList showActions maxItems={5} />
 * ```
 */
export function SyncActionList({
  className,
  maxItems = 10,
  showActions = true,
}: SyncActionListProps) {
  const [actions, setActions] = useState<SyncAction[]>([]);
  const { isSyncing, sync } = useSyncStatus();

  useEffect(() => {
    const loadActions = async () => {
      const all = await pendingActionsDB.getAll();
      setActions(all.filter((a) => a.status !== 'completed').slice(0, maxItems));
    };

    void loadActions();
    const interval = setInterval(loadActions, 2000);
    return () => clearInterval(interval);
  }, [maxItems]);

  if (actions.length === 0) return null;

  const handleRetry = async (actionId: string) => {
    const manager = getSyncManager();
    await manager.retryAction(actionId);
  };

  const handleRemove = async (actionId: string) => {
    const manager = getSyncManager();
    await manager.removeAction(actionId);
    setActions((prev) => prev.filter((a) => a.id !== actionId));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      case 'syncing':
        return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Pending Actions</h4>
        {showActions && !isSyncing && actions.some((a) => a.status === 'failed') && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => void sync()}
          >
            <RotateCcw className="h-3 w-3" />
            Retry all
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {actions.map((action) => (
          <div
            key={action.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              action.status === 'failed' && 'border-destructive/20 bg-destructive/5',
              action.status === 'syncing' && 'border-blue-500/20 bg-blue-500/5'
            )}
          >
            {statusIcon(action.status)}

            <div className="flex-1 min-w-0">
              <p className="truncate text-sm">{action.metadata.description}</p>
              {action.lastError && (
                <p className="truncate text-xs text-destructive mt-0.5">{action.lastError}</p>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {action.retryCount > 0 && <span>×{action.retryCount}</span>}

              {showActions && action.status === 'failed' && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => void handleRetry(action.id)}
                  title="Retry"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}

              {showActions && action.status !== 'syncing' && action.metadata.undoable && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleRemove(action.id)}
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {actions.length >= maxItems && (
        <p className="text-center text-xs text-muted-foreground">And more actions pending...</p>
      )}
    </div>
  );
}

// ─── SyncToast ────────────────────────────────────────────────────────────────

/**
 * Toast notification for sync events
 * Auto-shows when sync completes or fails
 */
export function SyncToast({ className }: { className?: string }) {
  const { progress, isSyncing } = useSyncStatus();
  const [showComplete, setShowComplete] = useState(false);
  const [wassyncing, setWasSyncing] = useState(false);

  useEffect(() => {
    if (isSyncing) {
      setWasSyncing(true);
    } else if (wassyncing && progress.completed > 0) {
      setShowComplete(true);
      setWasSyncing(false);
      const timer = setTimeout(() => setShowComplete(false), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSyncing, wassyncing, progress.completed]);

  if (!showComplete) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in duration-300',
        className
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-medium">Sync complete</p>
        <p className="text-xs text-muted-foreground">
          {progress.completed} action{progress.completed > 1 ? 's' : ''} synced
          {progress.failed > 0 && `, ${progress.failed} failed`}
        </p>
      </div>
    </div>
  );
}
