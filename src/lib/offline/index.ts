/**
 * Offline-first infrastructure module
 * Central export for all offline capabilities
 */

// ─── Connectivity Monitor ─────────────────────────────────────────────────────
export {
  checkConnectivity,
  getConnectivityInfo,
  getConnectivityMonitor,
  getConnectivityState,
  onConnectivityChange,
  startConnectivityMonitoring,
  stopConnectivityMonitoring,
} from './connectivity-monitor';
// ─── Constants ────────────────────────────────────────────────────────────────
export {
  BACKOFF_BASE_DELAY,
  CACHE_NAMES,
  CHANNELS,
  DB_NAME,
  DB_VERSION,
  DEGRADED_RTT_THRESHOLD,
  HEARTBEAT_ENDPOINT,
  HEARTBEAT_INTERVAL,
  LIEFI_RTT_THRESHOLD,
  LIEFI_TIMEOUT_COUNT,
  LIEFI_TIMEOUT_WINDOW,
  MAX_ACTION_RETENTION,
  MAX_SYNC_RETRIES,
  STORES,
  SYNC_QUEUES,
} from './constants';

// ─── IndexedDB ────────────────────────────────────────────────────────────────
export {
  apiCache,
  checkHealth,
  closeDB,
  conversations,
  deleteDB,
  getDB,
  getStorageQuota,
  messages,
  pendingActions,
  preferences,
  requestPersistentStorage,
  runMaintenance,
} from './indexed-db';

// ─── Sync Manager ─────────────────────────────────────────────────────────────
export {
  getSyncManager,
  getSyncProgress,
  onSyncProgress,
  processSyncQueue,
  queueChatMessage,
  queueMutation,
} from './sync-manager';
// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  BroadcastConnectivityMessage,
  BroadcastSyncMessage,
  CachedApiResponse,
  CachedConversation,
  CachedMessage,
  ConnectivityInfo,
  ConnectivityState,
  DataFreshness,
  DataFreshnessLevel,
  StorageQuota,
  SyncAction,
  SyncActionMetadata,
  SyncActionPriority,
  SyncActionStatus,
  SyncProgress,
  UserPreference,
} from './types';
