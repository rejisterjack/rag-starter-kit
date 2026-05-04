/**
 * Shared types for the offline PWA infrastructure
 */

// ─── Connectivity States ──────────────────────────────────────────────────────

export type ConnectivityState = 'online' | 'offline' | 'reconnecting' | 'liefi';

export interface ConnectivityInfo {
  state: ConnectivityState;
  /** Effective connection type from Network Information API */
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  /** Round-trip time in ms */
  rtt?: number;
  /** Downlink speed in Mbps */
  downlink?: number;
  /** Whether data saver is enabled */
  saveData?: boolean;
  /** Timestamp of last state change */
  lastStateChange: number;
  /** Timestamp of last successful network request */
  lastSuccessfulRequest?: number;
  /** Whether the connection quality is degraded */
  isDegraded: boolean;
}

// ─── Sync Actions ─────────────────────────────────────────────────────────────

export type SyncActionStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export type SyncActionPriority = 'critical' | 'high' | 'normal' | 'low';

export interface SyncAction {
  id: string;
  /** Queue this action belongs to */
  queue: string;
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request URL */
  url: string;
  /** Request body (serialized) */
  body?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Action metadata for display/tracking */
  metadata: SyncActionMetadata;
  /** Current status */
  status: SyncActionStatus;
  /** Priority for ordering */
  priority: SyncActionPriority;
  /** Number of retry attempts made */
  retryCount: number;
  /** Timestamp when action was created */
  createdAt: number;
  /** Timestamp of last retry attempt */
  lastAttemptAt?: number;
  /** Error message from last failure */
  lastError?: string;
  /** Idempotency key for deduplication */
  idempotencyKey: string;
  /** Expiry time (auto-delete after this) */
  expiresAt: number;
}

export interface SyncActionMetadata {
  /** Human-readable description */
  description: string;
  /** Action type for grouping */
  type: string;
  /** Related entity ID (e.g., conversationId) */
  entityId?: string;
  /** Entity type */
  entityType?: string;
  /** Whether this action can be undone */
  undoable?: boolean;
}

export interface SyncProgress {
  /** Total actions in queue */
  total: number;
  /** Actions completed in current sync */
  completed: number;
  /** Actions currently being processed */
  inProgress: number;
  /** Actions that failed */
  failed: number;
  /** Whether sync is currently active */
  isSyncing: boolean;
  /** Timestamp of last successful sync */
  lastSyncAt?: number;
}

// ─── IndexedDB Stores ─────────────────────────────────────────────────────────

export interface CachedConversation {
  id: string;
  title: string;
  lastMessageAt: number;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  /** When this cache entry was created */
  cachedAt: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface CachedMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  /** When this cache entry was created */
  cachedAt: number;
  /** Whether this message was created offline and not yet synced */
  pendingSync?: boolean;
  /** Attachments metadata */
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
  }>;
}

export interface CachedApiResponse {
  /** Cache key (typically URL + params hash) */
  key: string;
  /** Response data */
  data: unknown;
  /** Response headers */
  headers?: Record<string, string>;
  /** HTTP status code */
  status: number;
  /** When this cache entry was created */
  cachedAt: number;
  /** TTL in milliseconds */
  ttl: number;
  /** When this entry expires */
  expiresAt: number;
  /** ETag for conditional requests */
  etag?: string;
}

export interface UserPreference {
  key: string;
  value: unknown;
  updatedAt: number;
}

// ─── Service Worker Messages ──────────────────────────────────────────────────

export type SWMessageType =
  | 'SKIP_WAITING'
  | 'GET_VERSION'
  | 'CLEAR_CACHE'
  | 'SYNC_COMPLETE'
  | 'SYNC_FAILED'
  | 'CACHE_UPDATED'
  | 'CONNECTIVITY_CHANGE'
  | 'QUOTA_WARNING';

export interface SWMessage {
  type: SWMessageType;
  payload?: unknown;
}

export interface SWSyncCompleteMessage extends SWMessage {
  type: 'SYNC_COMPLETE';
  payload: {
    queue: string;
    actionId: string;
    success: boolean;
    error?: string;
  };
}

export interface SWConnectivityMessage extends SWMessage {
  type: 'CONNECTIVITY_CHANGE';
  payload: {
    state: ConnectivityState;
    rtt?: number;
  };
}

// ─── Broadcast Channel Messages ───────────────────────────────────────────────

export interface BroadcastSyncMessage {
  type: 'sync-progress' | 'sync-complete' | 'sync-error' | 'action-queued';
  payload: SyncProgress | SyncAction;
  timestamp: number;
}

export interface BroadcastConnectivityMessage {
  type: 'state-change' | 'heartbeat-result' | 'liefi-detected';
  payload: ConnectivityInfo;
  timestamp: number;
}

// ─── Data Freshness ───────────────────────────────────────────────────────────

export type DataFreshnessLevel = 'fresh' | 'stale' | 'expired' | 'unknown';

export interface DataFreshness {
  level: DataFreshnessLevel;
  /** Age in milliseconds */
  age: number;
  /** Human-readable age string */
  ageFormatted: string;
  /** When data was last fetched */
  fetchedAt: number;
  /** Whether a background refresh is in progress */
  isRefreshing: boolean;
}

// ─── Quota ────────────────────────────────────────────────────────────────────

export interface StorageQuota {
  /** Used bytes */
  usage: number;
  /** Total available bytes */
  quota: number;
  /** Usage percentage (0-100) */
  usagePercentage: number;
  /** Whether we're approaching the limit */
  isWarning: boolean;
  /** Whether we've exceeded safe limits */
  isCritical: boolean;
  /** Human-readable usage */
  usageFormatted: string;
  /** Human-readable quota */
  quotaFormatted: string;
}

// ─── Hook Return Types ────────────────────────────────────────────────────────

export interface UseOfflineQueryOptions<T> {
  /** Cache key */
  key: string;
  /** Fetch function */
  fetcher: () => Promise<T>;
  /** TTL for cached data (ms) */
  ttl?: number;
  /** Whether to serve stale data while revalidating */
  staleWhileRevalidate?: boolean;
  /** Whether to enable this query */
  enabled?: boolean;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseOfflineQueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFromCache: boolean;
  freshness: DataFreshness;
  refetch: () => Promise<void>;
}

export interface UseOfflineMutationOptions<TData, TVariables> {
  /** Mutation function */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Optimistic update function */
  optimisticUpdate?: (variables: TVariables) => TData;
  /** Rollback function on failure */
  onRollback?: (variables: TVariables) => void;
  /** Success callback */
  onSuccess?: (data: TData) => void;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Sync action metadata */
  syncMetadata?: Partial<SyncActionMetadata>;
  /** Priority */
  priority?: SyncActionPriority;
}
