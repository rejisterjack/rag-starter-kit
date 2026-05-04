/**
 * Offline system constants
 * Central configuration for the entire PWA offline infrastructure
 */

// ─── Database ─────────────────────────────────────────────────────────────────

export const DB_NAME = 'rag-offline-v1';
export const DB_VERSION = 1;

export const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  PENDING_ACTIONS: 'pending-actions',
  API_CACHE: 'api-cache',
  USER_PREFERENCES: 'user-preferences',
} as const;

// ─── Cache Names ──────────────────────────────────────────────────────────────

export const CACHE_PREFIX = 'rag-pwa';
export const CACHE_VERSION = 'v3';

export const CACHE_NAMES = {
  PRECACHE: `${CACHE_PREFIX}-precache-${CACHE_VERSION}`,
  STATIC: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  IMAGES: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  PAGES: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
  FONTS: `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`,
} as const;

// ─── Sync Queue Names ─────────────────────────────────────────────────────────

export const SYNC_QUEUES = {
  API_MUTATIONS: 'api-mutations',
  CHAT_MESSAGES: 'chat-messages',
  DOCUMENT_UPLOADS: 'document-uploads',
} as const;

// ─── Timeouts & Thresholds ────────────────────────────────────────────────────

/** Network request timeout before fallback to cache (ms) */
export const NETWORK_TIMEOUT_MS = 3000;

/** Lie-fi detection: RTT threshold for degraded connection (ms) */
export const DEGRADED_RTT_THRESHOLD = 2000;

/** Lie-fi detection: RTT threshold for lie-fi state (ms) */
export const LIEFI_RTT_THRESHOLD = 5000;

/** Number of consecutive timeouts to trigger lie-fi detection */
export const LIEFI_TIMEOUT_COUNT = 3;

/** Window for counting timeouts (ms) */
export const LIEFI_TIMEOUT_WINDOW = 10000;

/** Heartbeat interval when app is focused (ms) */
export const HEARTBEAT_INTERVAL = 30000;

/** Heartbeat endpoint */
export const HEARTBEAT_ENDPOINT = '/api/health';

/** Max retry attempts for sync actions */
export const MAX_SYNC_RETRIES = 5;

/** Base delay for exponential backoff (ms) */
export const BACKOFF_BASE_DELAY = 1000;

/** Maximum retention time for pending actions (ms) - 24 hours */
export const MAX_ACTION_RETENTION = 24 * 60 * 60 * 1000;

/** Auto-hide delay for reconnected banner (ms) */
export const RECONNECTED_BANNER_DELAY = 5000;

// ─── Cache Limits ─────────────────────────────────────────────────────────────

export const CACHE_LIMITS = {
  IMAGES: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
  API: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }, // 24 hours
  PAGES: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 days
  STATIC: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 }, // 1 year
  FONTS: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }, // 1 year
} as const;

// ─── Broadcast Channels ───────────────────────────────────────────────────────

export const CHANNELS = {
  SYNC_STATUS: 'pwa-sync-status',
  CONNECTIVITY: 'pwa-connectivity',
  SW_MESSAGES: 'pwa-sw-messages',
} as const;

// ─── Local Storage Keys ───────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  PENDING_MESSAGES: 'pwa:pending-messages',
  CONNECTIVITY_STATE: 'pwa:connectivity-state',
  LAST_SYNC: 'pwa:last-sync',
  INSTALL_DISMISSED: 'pwa:install-dismissed',
} as const;
