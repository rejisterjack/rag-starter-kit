/**
 * Production-grade IndexedDB abstraction layer
 * Provides a typed, resilient data persistence layer for offline-first functionality
 */

import { DB_NAME, DB_VERSION, STORES } from './constants';
import type {
  CachedApiResponse,
  CachedConversation,
  CachedMessage,
  StorageQuota,
  SyncAction,
  UserPreference,
} from './types';

// ─── Database Instance ────────────────────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens or returns the existing IndexedDB connection
 * Handles schema migrations and error recovery
 */
export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Conversations store
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        const conversationsStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
        conversationsStore.createIndex('by-updated', 'updatedAt', { unique: false });
        conversationsStore.createIndex('by-cached', 'cachedAt', { unique: false });
      }

      // Messages store
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        messagesStore.createIndex('by-conversation', 'conversationId', { unique: false });
        messagesStore.createIndex('by-conversation-time', ['conversationId', 'createdAt'], {
          unique: false,
        });
        messagesStore.createIndex('by-pending', 'pendingSync', { unique: false });
      }

      // Pending actions store
      if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        const actionsStore = db.createObjectStore(STORES.PENDING_ACTIONS, { keyPath: 'id' });
        actionsStore.createIndex('by-queue', 'queue', { unique: false });
        actionsStore.createIndex('by-status', 'status', { unique: false });
        actionsStore.createIndex('by-priority', 'priority', { unique: false });
        actionsStore.createIndex('by-created', 'createdAt', { unique: false });
        actionsStore.createIndex('by-idempotency', 'idempotencyKey', { unique: true });
      }

      // API cache store
      if (!db.objectStoreNames.contains(STORES.API_CACHE)) {
        const cacheStore = db.createObjectStore(STORES.API_CACHE, { keyPath: 'key' });
        cacheStore.createIndex('by-expires', 'expiresAt', { unique: false });
        cacheStore.createIndex('by-cached', 'cachedAt', { unique: false });
      }

      // User preferences store
      if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
        db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle connection loss
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      dbInstance.onerror = (event) => {
        console.error('[OfflineDB] Database error:', event);
      };

      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('[OfflineDB] Database blocked - close other tabs');
    };
  });

  return dbPromise;
}

/**
 * Closes the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

/**
 * Deletes the entire database (for recovery)
 */
export async function deleteDB(): Promise<void> {
  closeDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── Generic CRUD Operations ──────────────────────────────────────────────────

async function put<T>(storeName: string, data: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function getAllByIndex<T>(
  storeName: string,
  indexName: string,
  query?: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = query ? index.getAll(query) : index.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function clear(storeName: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function count(storeName: string): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = {
  async get(id: string): Promise<CachedConversation | undefined> {
    return get<CachedConversation>(STORES.CONVERSATIONS, id);
  },

  async getAll(): Promise<CachedConversation[]> {
    return getAllByIndex<CachedConversation>(STORES.CONVERSATIONS, 'by-updated');
  },

  async getRecent(limit = 20): Promise<CachedConversation[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CONVERSATIONS, 'readonly');
      const store = tx.objectStore(STORES.CONVERSATIONS);
      const index = store.index('by-updated');
      const results: CachedConversation[] = [];

      const request = index.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value as CachedConversation);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async put(conversation: CachedConversation): Promise<void> {
    return put(STORES.CONVERSATIONS, {
      ...conversation,
      cachedAt: Date.now(),
    });
  },

  async putMany(items: CachedConversation[]): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CONVERSATIONS, 'readwrite');
      const store = tx.objectStore(STORES.CONVERSATIONS);
      const now = Date.now();

      for (const item of items) {
        store.put({ ...item, cachedAt: now });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(id: string): Promise<void> {
    return remove(STORES.CONVERSATIONS, id);
  },

  async clear(): Promise<void> {
    return clear(STORES.CONVERSATIONS);
  },

  async count(): Promise<number> {
    return count(STORES.CONVERSATIONS);
  },
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = {
  async get(id: string): Promise<CachedMessage | undefined> {
    return get<CachedMessage>(STORES.MESSAGES, id);
  },

  async getByConversation(conversationId: string): Promise<CachedMessage[]> {
    return getAllByIndex<CachedMessage>(STORES.MESSAGES, 'by-conversation', conversationId);
  },

  async getByConversationPaginated(
    conversationId: string,
    limit = 50,
    before?: number
  ): Promise<CachedMessage[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MESSAGES, 'readonly');
      const store = tx.objectStore(STORES.MESSAGES);
      const index = store.index('by-conversation-time');

      const upper = [conversationId, before ?? Date.now()];
      const lower = [conversationId, 0];
      const range = IDBKeyRange.bound(lower, upper);

      const results: CachedMessage[] = [];
      const request = index.openCursor(range, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value as CachedMessage);
          cursor.continue();
        } else {
          resolve(results.reverse());
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getPending(): Promise<CachedMessage[]> {
    return getAllByIndex<CachedMessage>(STORES.MESSAGES, 'by-pending', 1 as unknown as IDBValidKey);
  },

  async put(message: CachedMessage): Promise<void> {
    return put(STORES.MESSAGES, {
      ...message,
      cachedAt: Date.now(),
    });
  },

  async putMany(items: CachedMessage[]): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MESSAGES, 'readwrite');
      const store = tx.objectStore(STORES.MESSAGES);
      const now = Date.now();

      for (const item of items) {
        store.put({ ...item, cachedAt: now });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(id: string): Promise<void> {
    return remove(STORES.MESSAGES, id);
  },

  async deleteByConversation(conversationId: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MESSAGES, 'readwrite');
      const store = tx.objectStore(STORES.MESSAGES);
      const index = store.index('by-conversation');
      const request = index.openCursor(IDBKeyRange.only(conversationId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async markSynced(id: string): Promise<void> {
    const message = await this.get(id);
    if (message) {
      await put(STORES.MESSAGES, { ...message, pendingSync: false });
    }
  },

  async count(): Promise<number> {
    return count(STORES.MESSAGES);
  },

  async countByConversation(conversationId: string): Promise<number> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MESSAGES, 'readonly');
      const store = tx.objectStore(STORES.MESSAGES);
      const index = store.index('by-conversation');
      const request = index.count(IDBKeyRange.only(conversationId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};

// ─── Pending Actions (Sync Queue) ────────────────────────────────────────────

export const pendingActions = {
  async get(id: string): Promise<SyncAction | undefined> {
    return get<SyncAction>(STORES.PENDING_ACTIONS, id);
  },

  async getAll(): Promise<SyncAction[]> {
    return getAllByIndex<SyncAction>(STORES.PENDING_ACTIONS, 'by-created');
  },

  async getByQueue(queue: string): Promise<SyncAction[]> {
    return getAllByIndex<SyncAction>(STORES.PENDING_ACTIONS, 'by-queue', queue);
  },

  async getByStatus(status: string): Promise<SyncAction[]> {
    return getAllByIndex<SyncAction>(STORES.PENDING_ACTIONS, 'by-status', status);
  },

  async getPending(): Promise<SyncAction[]> {
    return this.getByStatus('pending');
  },

  async getFailed(): Promise<SyncAction[]> {
    return this.getByStatus('failed');
  },

  async add(action: SyncAction): Promise<void> {
    // Check for duplicate idempotency key
    try {
      await put(STORES.PENDING_ACTIONS, action);
    } catch (error) {
      // If constraint error (duplicate idempotency key), skip
      if ((error as DOMException)?.name === 'ConstraintError') {
        console.warn('[OfflineDB] Duplicate action skipped:', action.idempotencyKey);
        return;
      }
      throw error;
    }
  },

  async update(id: string, updates: Partial<SyncAction>): Promise<void> {
    const existing = await this.get(id);
    if (existing) {
      await put(STORES.PENDING_ACTIONS, { ...existing, ...updates });
    }
  },

  async markSyncing(id: string): Promise<void> {
    await this.update(id, { status: 'syncing', lastAttemptAt: Date.now() });
  },

  async markFailed(id: string, error: string): Promise<void> {
    const existing = await this.get(id);
    if (existing) {
      await this.update(id, {
        status: 'failed',
        lastError: error,
        retryCount: existing.retryCount + 1,
      });
    }
  },

  async markCompleted(id: string): Promise<void> {
    await this.update(id, { status: 'completed' });
  },

  async delete(id: string): Promise<void> {
    return remove(STORES.PENDING_ACTIONS, id);
  },

  async deleteCompleted(): Promise<void> {
    const completed = await this.getByStatus('completed');
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.PENDING_ACTIONS);
      for (const action of completed) {
        store.delete(action.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteExpired(): Promise<void> {
    const all = await this.getAll();
    const now = Date.now();
    const expired = all.filter((a) => a.expiresAt < now);

    if (expired.length === 0) return;

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.PENDING_ACTIONS);
      for (const action of expired) {
        store.delete(action.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clear(): Promise<void> {
    return clear(STORES.PENDING_ACTIONS);
  },

  async count(): Promise<number> {
    return count(STORES.PENDING_ACTIONS);
  },

  async countPending(): Promise<number> {
    const pending = await this.getPending();
    return pending.length;
  },
};

// ─── API Cache ────────────────────────────────────────────────────────────────

export const apiCache = {
  async get(key: string): Promise<CachedApiResponse | undefined> {
    const entry = await get<CachedApiResponse>(STORES.API_CACHE, key);
    if (!entry) return undefined;

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      // Don't delete here - let the caller decide (stale-while-revalidate)
      return entry;
    }

    return entry;
  },

  async getValid(key: string): Promise<CachedApiResponse | undefined> {
    const entry = await this.get(key);
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry;
  },

  async put(
    key: string,
    data: unknown,
    ttl: number,
    options?: {
      headers?: Record<string, string>;
      status?: number;
      etag?: string;
    }
  ): Promise<void> {
    const now = Date.now();
    const entry: CachedApiResponse = {
      key,
      data,
      headers: options?.headers,
      status: options?.status ?? 200,
      cachedAt: now,
      ttl,
      expiresAt: now + ttl,
      etag: options?.etag,
    };
    return put(STORES.API_CACHE, entry);
  },

  async delete(key: string): Promise<void> {
    return remove(STORES.API_CACHE, key);
  },

  async deleteExpired(): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.API_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.API_CACHE);
      const index = store.index('by-expires');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async evictOldest(maxEntries: number): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.API_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.API_CACHE);
      const index = store.index('by-cached');
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const total = countRequest.result;
        if (total <= maxEntries) {
          resolve();
          return;
        }

        const toDelete = total - maxEntries;
        let deleted = 0;
        const cursorRequest = index.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor && deleted < toDelete) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clear(): Promise<void> {
    return clear(STORES.API_CACHE);
  },

  async count(): Promise<number> {
    return count(STORES.API_CACHE);
  },
};

// ─── User Preferences ─────────────────────────────────────────────────────────

export const preferences = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = await get<UserPreference>(STORES.USER_PREFERENCES, key);
    return entry?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    return put(STORES.USER_PREFERENCES, {
      key,
      value,
      updatedAt: Date.now(),
    });
  },

  async delete(key: string): Promise<void> {
    return remove(STORES.USER_PREFERENCES, key);
  },

  async getAll(): Promise<Record<string, unknown>> {
    const all = await getAll<UserPreference>(STORES.USER_PREFERENCES);
    return Object.fromEntries(all.map((p) => [p.key, p.value]));
  },

  async clear(): Promise<void> {
    return clear(STORES.USER_PREFERENCES);
  },
};

// ─── Storage Quota ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export async function getStorageQuota(): Promise<StorageQuota> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      usagePercentage,
      isWarning: usagePercentage > 70,
      isCritical: usagePercentage > 90,
      usageFormatted: formatBytes(usage),
      quotaFormatted: formatBytes(quota),
    };
  }

  return {
    usage: 0,
    quota: 0,
    usagePercentage: 0,
    isWarning: false,
    isCritical: false,
    usageFormatted: 'Unknown',
    quotaFormatted: 'Unknown',
  };
}

/**
 * Request persistent storage to prevent eviction
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return navigator.storage.persist();
  }
  return false;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

/**
 * Run maintenance tasks: clean expired data, evict old entries
 */
export async function runMaintenance(): Promise<void> {
  try {
    await apiCache.deleteExpired();
    await pendingActions.deleteExpired();
    await pendingActions.deleteCompleted();
    await apiCache.evictOldest(200);
  } catch (error) {
    console.error('[OfflineDB] Maintenance error:', error);
  }
}

/**
 * Check database health and attempt recovery if needed
 */
export async function checkHealth(): Promise<{
  healthy: boolean;
  stores: Record<string, number>;
  quota: StorageQuota;
}> {
  try {
    const [conversationCount, messageCount, actionCount, cacheCount, quota] = await Promise.all([
      conversations.count(),
      messages.count(),
      pendingActions.count(),
      apiCache.count(),
      getStorageQuota(),
    ]);

    return {
      healthy: true,
      stores: {
        conversations: conversationCount,
        messages: messageCount,
        pendingActions: actionCount,
        apiCache: cacheCount,
      },
      quota,
    };
  } catch (error) {
    console.error('[OfflineDB] Health check failed:', error);
    return {
      healthy: false,
      stores: {},
      quota: {
        usage: 0,
        quota: 0,
        usagePercentage: 0,
        isWarning: false,
        isCritical: false,
        usageFormatted: 'Error',
        quotaFormatted: 'Error',
      },
    };
  }
}
