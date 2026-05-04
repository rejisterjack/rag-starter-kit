/**
 * Offline-first data fetching hooks
 * Provides React hooks that integrate with IndexedDB for seamless
 * offline/online data access with stale-while-revalidate semantics.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCache } from '@/lib/offline/indexed-db';
import { getSyncManager } from '@/lib/offline/sync-manager';
import type {
  DataFreshness,
  DataFreshnessLevel,
  SyncActionMetadata,
  SyncActionPriority,
  SyncProgress,
} from '@/lib/offline/types';

// ─── useOfflineQuery ──────────────────────────────────────────────────────────

interface UseOfflineQueryOptions<T> {
  /** Unique cache key for this query */
  key: string;
  /** Async function to fetch data */
  fetcher: () => Promise<T>;
  /** Time-to-live for cached data in ms (default: 5 minutes) */
  ttl?: number;
  /** Whether to serve stale data while revalidating (default: true) */
  staleWhileRevalidate?: boolean;
  /** Whether this query is enabled (default: true) */
  enabled?: boolean;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to refetch on window focus (default: false) */
  refetchOnFocus?: boolean;
  /** Refetch interval in ms (disabled by default) */
  refetchInterval?: number;
}

interface UseOfflineQueryResult<T> {
  /** The data (from cache or network) */
  data: T | undefined;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** Whether the initial load is in progress */
  isLoading: boolean;
  /** Whether a background refetch is in progress */
  isRefetching: boolean;
  /** Whether the data came from cache */
  isFromCache: boolean;
  /** Data freshness information */
  freshness: DataFreshness;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Invalidate the cache for this key */
  invalidate: () => Promise<void>;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for offline-first data fetching with IndexedDB caching
 *
 * @example
 * ```tsx
 * function ConversationList() {
 *   const { data, isLoading, isFromCache, freshness } = useOfflineQuery({
 *     key: 'conversations',
 *     fetcher: () => fetch('/api/conversations').then(r => r.json()),
 *     ttl: 60000, // 1 minute
 *   });
 *
 *   if (isLoading) return <Skeleton />;
 *   return <List items={data} freshness={freshness} />;
 * }
 * ```
 */
export function useOfflineQuery<T>(options: UseOfflineQueryOptions<T>): UseOfflineQueryResult<T> {
  const {
    key,
    fetcher,
    ttl = DEFAULT_TTL,
    staleWhileRevalidate = true,
    enabled = true,
    onSuccess,
    onError,
    refetchOnFocus = false,
    refetchInterval,
  } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Compute freshness
  const freshness: DataFreshness = computeFreshness(fetchedAt, ttl, isRefreshing);

  // Background revalidation
  const revalidateInBackground = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const networkData = await fetcherRef.current();
      if (!mountedRef.current) return;

      setData(networkData);
      setIsFromCache(false);
      setFetchedAt(Date.now());
      setError(null);

      await apiCache.put(key, networkData, ttl);
      onSuccess?.(networkData);
    } catch {
      // Background revalidation failure is silent
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [key, ttl, onSuccess]);

  // Core fetch logic
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;

      if (isBackground) {
        setIsRefetching(true);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        // Try to get from cache first
        const cached = await apiCache.get(key);

        if (cached) {
          const cachedData = cached.data as T;
          setData(cachedData);
          setIsFromCache(true);
          setFetchedAt(cached.cachedAt);

          // If cache is still valid and not forcing refresh
          if (cached.expiresAt > Date.now() && !isBackground) {
            setIsLoading(false);
            setError(null);

            // Still revalidate in background if staleWhileRevalidate
            if (staleWhileRevalidate && navigator.onLine) {
              void revalidateInBackground();
            }
            return;
          }
        }

        // If offline and no cache, show error
        if (!navigator.onLine) {
          if (!cached) {
            setError(new Error('No cached data available offline'));
            setIsLoading(false);
            setIsRefetching(false);
            setIsRefreshing(false);
          } else {
            // Serve stale cache
            setIsLoading(false);
            setIsRefetching(false);
            setIsRefreshing(false);
          }
          return;
        }

        // Fetch from network
        const networkData = await fetcherRef.current();

        if (!mountedRef.current) return;

        // Update state
        setData(networkData);
        setError(null);
        setIsFromCache(false);
        setFetchedAt(Date.now());

        // Cache the result
        await apiCache.put(key, networkData, ttl);

        onSuccess?.(networkData);
      } catch (err) {
        if (!mountedRef.current) return;

        const fetchError = err instanceof Error ? err : new Error('Fetch failed');
        setError(fetchError);
        onError?.(fetchError);

        // If we have stale data, keep showing it
        if (!data) {
          // Try to load from cache as fallback
          const cached = await apiCache.get(key);
          if (cached) {
            setData(cached.data as T);
            setIsFromCache(true);
            setFetchedAt(cached.cachedAt);
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRefetching(false);
          setIsRefreshing(false);
        }
      }
    },
    [key, ttl, staleWhileRevalidate, enabled, onSuccess, onError, data, revalidateInBackground]
  );

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Invalidate cache
  const invalidate = useCallback(async () => {
    await apiCache.delete(key);
    await fetchData(false);
  }, [key, fetchData]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    void fetchData(false);

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus || !enabled) return;

    const handleFocus = () => {
      if (navigator.onLine) {
        void fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, enabled, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => {
      if (navigator.onLine) {
        void fetchData(true);
      }
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  // Refetch when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (enabled && isFromCache) {
        void fetchData(true);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [enabled, isFromCache, fetchData]);

  return {
    data,
    error,
    isLoading,
    isRefetching,
    isFromCache,
    freshness,
    refetch,
    invalidate,
  };
}

// ─── useOfflineMutation ───────────────────────────────────────────────────────

interface UseOfflineMutationOptions<TData, TVariables> {
  /** Function to execute the mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Function for optimistic update (returns optimistic data) */
  optimisticUpdate?: (variables: TVariables) => TData;
  /** Rollback function on permanent failure */
  onRollback?: (variables: TVariables) => void;
  /** Success callback */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Error callback */
  onError?: (error: Error, variables: TVariables) => void;
  /** Sync metadata for offline queue */
  syncMetadata?: Partial<SyncActionMetadata>;
  /** Priority for the sync queue */
  priority?: SyncActionPriority;
  /** API endpoint for offline queuing */
  endpoint?: string;
  /** HTTP method */
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

interface UseOfflineMutationResult<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Whether the mutation was queued offline */
  isQueued: boolean;
  /** Error from the mutation */
  error: Error | null;
  /** The last successful result */
  data: TData | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for mutations with offline support and optimistic updates
 *
 * @example
 * ```tsx
 * function SendMessageButton() {
 *   const { mutate, isLoading, isQueued } = useOfflineMutation({
 *     mutationFn: (msg) => fetch('/api/messages', { method: 'POST', body: JSON.stringify(msg) }),
 *     optimisticUpdate: (msg) => ({ ...msg, id: 'temp', status: 'sending' }),
 *     endpoint: '/api/messages',
 *     method: 'POST',
 *   });
 *
 *   return (
 *     <button onClick={() => mutate({ content: 'Hello' })} disabled={isLoading}>
 *       {isQueued ? 'Queued' : 'Send'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  options: UseOfflineMutationOptions<TData, TVariables>
): UseOfflineMutationResult<TData, TVariables> {
  const {
    mutationFn,
    optimisticUpdate,
    onRollback,
    onSuccess,
    onError,
    syncMetadata,
    priority = 'normal',
    endpoint,
    method = 'POST',
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      setIsLoading(true);
      setError(null);
      setIsQueued(false);

      // Apply optimistic update immediately
      let optimisticData: TData | undefined;
      if (optimisticUpdate) {
        optimisticData = optimisticUpdate(variables);
        setData(optimisticData);
      }

      // If offline, queue the mutation
      if (!navigator.onLine) {
        if (endpoint) {
          const manager = getSyncManager();
          await manager.queueAction({
            method,
            url: endpoint,
            body: variables,
            metadata: {
              description: syncMetadata?.description ?? 'Offline mutation',
              type: syncMetadata?.type ?? 'mutation',
              entityId: syncMetadata?.entityId,
              entityType: syncMetadata?.entityType,
              undoable: syncMetadata?.undoable ?? true,
            },
            priority,
          });
        }

        setIsQueued(true);
        setIsLoading(false);
        return optimisticData;
      }

      // Online - execute immediately
      try {
        const result = await mutationFn(variables);
        setData(result);
        setIsLoading(false);
        onSuccess?.(result, variables);
        return result;
      } catch (err) {
        const mutationError = err instanceof Error ? err : new Error('Mutation failed');
        setError(mutationError);
        setIsLoading(false);

        // Rollback optimistic update
        if (optimisticData && onRollback) {
          onRollback(variables);
          setData(undefined);
        }

        // Try to queue if it was a network error
        if (endpoint && isNetworkError(err)) {
          const manager = getSyncManager();
          await manager.queueAction({
            method,
            url: endpoint,
            body: variables,
            metadata: {
              description: syncMetadata?.description ?? 'Offline mutation (retry)',
              type: syncMetadata?.type ?? 'mutation',
              entityId: syncMetadata?.entityId,
              entityType: syncMetadata?.entityType,
              undoable: syncMetadata?.undoable ?? true,
            },
            priority,
          });
          setIsQueued(true);
        } else {
          onError?.(mutationError, variables);
        }

        return optimisticData;
      }
    },
    [
      mutationFn,
      optimisticUpdate,
      onRollback,
      onSuccess,
      onError,
      syncMetadata,
      priority,
      endpoint,
      method,
    ]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsQueued(false);
    setError(null);
    setData(undefined);
  }, []);

  return {
    mutate,
    isLoading,
    isQueued,
    error,
    data,
    reset,
  };
}

// ─── useSyncStatus ────────────────────────────────────────────────────────────

interface UseSyncStatusReturn {
  /** Current sync progress */
  progress: SyncProgress;
  /** Number of pending actions */
  pendingCount: number;
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Whether there are failed actions */
  hasFailed: boolean;
  /** Manually trigger sync */
  sync: () => Promise<void>;
}

/**
 * Hook for monitoring background sync status
 *
 * @example
 * ```tsx
 * function SyncIndicator() {
 *   const { pendingCount, isSyncing, hasFailed, sync } = useSyncStatus();
 *
 *   if (pendingCount === 0) return null;
 *   return (
 *     <Badge>
 *       {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
 *       {hasFailed && <RetryButton onClick={sync} />}
 *     </Badge>
 *   );
 * }
 * ```
 */
export function useSyncStatus(): UseSyncStatusReturn {
  const [progress, setProgress] = useState<SyncProgress>({
    total: 0,
    completed: 0,
    inProgress: 0,
    failed: 0,
    isSyncing: false,
    lastSyncAt: undefined,
  });

  useEffect(() => {
    const manager = getSyncManager();

    // Get initial progress
    void manager.getProgress().then(setProgress);

    // Subscribe to updates
    const unsubscribe = manager.onProgress(setProgress);
    return unsubscribe;
  }, []);

  const sync = useCallback(async () => {
    const manager = getSyncManager();
    await manager.processQueue();
  }, []);

  return {
    progress,
    pendingCount: progress.total,
    isSyncing: progress.isSyncing,
    hasFailed: progress.failed > 0,
    sync,
  };
}

// ─── useDataFreshness ─────────────────────────────────────────────────────────

/**
 * Hook for checking the freshness of cached data
 *
 * @example
 * ```tsx
 * function DataLabel({ cacheKey }: { cacheKey: string }) {
 *   const freshness = useDataFreshness(cacheKey);
 *   return <Badge variant={freshness.level}>{freshness.ageFormatted}</Badge>;
 * }
 * ```
 */
export function useDataFreshness(key: string): DataFreshness {
  const [freshness, setFreshness] = useState<DataFreshness>({
    level: 'unknown',
    age: 0,
    ageFormatted: '',
    fetchedAt: 0,
    isRefreshing: false,
  });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const check = async () => {
      const cached = await apiCache.get(key);
      if (cached) {
        const age = Date.now() - cached.cachedAt;
        const isExpired = cached.expiresAt < Date.now();
        const isStale = age > cached.ttl * 0.75; // 75% of TTL

        setFreshness({
          level: isExpired ? 'expired' : isStale ? 'stale' : 'fresh',
          age,
          ageFormatted: formatAge(age),
          fetchedAt: cached.cachedAt,
          isRefreshing: false,
        });
      } else {
        setFreshness({
          level: 'unknown',
          age: 0,
          ageFormatted: '',
          fetchedAt: 0,
          isRefreshing: false,
        });
      }
    };

    void check();
    interval = setInterval(check, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [key]);

  return freshness;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeFreshness(fetchedAt: number, ttl: number, isRefreshing: boolean): DataFreshness {
  if (!fetchedAt) {
    return { level: 'unknown', age: 0, ageFormatted: '', fetchedAt: 0, isRefreshing };
  }

  const age = Date.now() - fetchedAt;
  const expiresAt = fetchedAt + ttl;
  const isExpired = Date.now() > expiresAt;
  const isStale = age > ttl * 0.75;

  let level: DataFreshnessLevel = 'fresh';
  if (isExpired) level = 'expired';
  else if (isStale) level = 'stale';

  return {
    level,
    age,
    ageFormatted: formatAge(age),
    fetchedAt,
    isRefreshing,
  };
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return false;
}
