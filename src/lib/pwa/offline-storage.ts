/**
 * Offline Storage
 * IndexedDB wrapper for offline data persistence
 * Handles pending messages, cached chats, and documents
 */

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'RAGChatbotDB';
const DB_VERSION = 1;

// Store names
export const STORES = {
  PENDING_MESSAGES: 'pendingMessages',
  PENDING_DATA: 'pendingData',
  CACHED_CHATS: 'cachedChats',
  CACHED_DOCUMENTS: 'cachedDocuments',
  SYNC_QUEUE: 'syncQueue',
  SETTINGS: 'settings',
} as const;

// ============================================================================
// Types
// ============================================================================

export interface PendingMessage {
  id: string;
  content: string;
  timestamp: number;
  conversationId?: string;
  workspaceId?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
  retryCount?: number;
}

export interface PendingData {
  id: string;
  type: 'message' | 'document' | 'setting' | 'custom';
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface CachedChat {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  workspaceId?: string;
  lastAccessed: number;
  createdAt: number;
}

export interface CachedDocument {
  id: string;
  name: string;
  content?: string;
  metadata: {
    size?: number;
    type?: string;
    pages?: number;
  };
  workspaceId?: string;
  lastAccessed: number;
  blob?: Blob;
}

export interface SyncQueueItem {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  priority: number;
  retryCount: number;
}

export interface OfflineSettings {
  key: string;
  value: unknown;
  updatedAt: number;
}

// ============================================================================
// Database Connection
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Get or create database connection
 */
function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Pending messages store
      if (!db.objectStoreNames.contains(STORES.PENDING_MESSAGES)) {
        const messageStore = db.createObjectStore(STORES.PENDING_MESSAGES, {
          keyPath: 'id',
        });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        messageStore.createIndex('conversationId', 'conversationId', {
          unique: false,
        });
        messageStore.createIndex('workspaceId', 'workspaceId', {
          unique: false,
        });
      }

      // Pending data store
      if (!db.objectStoreNames.contains(STORES.PENDING_DATA)) {
        const dataStore = db.createObjectStore(STORES.PENDING_DATA, {
          keyPath: 'id',
        });
        dataStore.createIndex('timestamp', 'timestamp', { unique: false });
        dataStore.createIndex('type', 'type', { unique: false });
      }

      // Cached chats store
      if (!db.objectStoreNames.contains(STORES.CACHED_CHATS)) {
        const chatStore = db.createObjectStore(STORES.CACHED_CHATS, {
          keyPath: 'id',
        });
        chatStore.createIndex('lastAccessed', 'lastAccessed', {
          unique: false,
        });
        chatStore.createIndex('workspaceId', 'workspaceId', {
          unique: false,
        });
      }

      // Cached documents store
      if (!db.objectStoreNames.contains(STORES.CACHED_DOCUMENTS)) {
        const docStore = db.createObjectStore(STORES.CACHED_DOCUMENTS, {
          keyPath: 'id',
        });
        docStore.createIndex('lastAccessed', 'lastAccessed', {
          unique: false,
        });
        docStore.createIndex('workspaceId', 'workspaceId', {
          unique: false,
        });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
        });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('priority', 'priority', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        const settingsStore = db.createObjectStore(STORES.SETTINGS, {
          keyPath: 'key',
        });
        settingsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

// ============================================================================
// Pending Messages
// ============================================================================

export const pendingMessages = {
  /**
   * Add a message to the pending queue
   */
  async add(message: Omit<PendingMessage, 'id' | 'timestamp'>): Promise<PendingMessage> {
    const db = await getDB();
    const item: PendingMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const request = store.add(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all pending messages
   */
  async getAll(): Promise<PendingMessage[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get pending messages for a conversation
   */
  async getByConversation(conversationId: string): Promise<PendingMessage[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Remove a pending message
   */
  async remove(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update retry count for a message
   */
  async incrementRetry(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result as PendingMessage | undefined;
        if (data) {
          data.retryCount = (data.retryCount || 0) + 1;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  /**
   * Get count of pending messages
   */
  async count(): Promise<number> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all pending messages
   */
  async clear(): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_MESSAGES);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

// ============================================================================
// Cached Chats
// ============================================================================

export const cachedChats = {
  /**
   * Cache a chat
   */
  async set(chat: Omit<CachedChat, 'lastAccessed'>): Promise<CachedChat> {
    const db = await getDB();
    const item: CachedChat = {
      ...chat,
      lastAccessed: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_CHATS], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_CHATS);
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get a cached chat
   */
  async get(id: string): Promise<CachedChat | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_CHATS], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_CHATS);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as CachedChat | undefined;
        if (result) {
          // Update last accessed
          // biome-ignore lint/suspicious/noConsole: Error handling for background touch
          cachedChats.touch(id).catch(console.error);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all cached chats
   */
  async getAll(): Promise<CachedChat[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_CHATS], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_CHATS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update last accessed timestamp
   */
  async touch(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_CHATS], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_CHATS);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result as CachedChat | undefined;
        if (data) {
          data.lastAccessed = Date.now();
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  /**
   * Remove a cached chat
   */
  async remove(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_CHATS], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_CHATS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear old chats (not accessed in the last X days)
   */
  async clearOld(maxAgeDays: number = 30): Promise<number> {
    await getDB();
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const allChats = await this.getAll();
    const oldChats = allChats.filter((chat) => chat.lastAccessed < cutoff);

    for (const chat of oldChats) {
      await this.remove(chat.id);
    }

    return oldChats.length;
  },
};

// ============================================================================
// Cached Documents
// ============================================================================

export const cachedDocuments = {
  /**
   * Cache a document
   */
  async set(doc: Omit<CachedDocument, 'lastAccessed'>): Promise<CachedDocument> {
    const db = await getDB();
    const item: CachedDocument = {
      ...doc,
      lastAccessed: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_DOCUMENTS], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DOCUMENTS);
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get a cached document
   */
  async get(id: string): Promise<CachedDocument | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_DOCUMENTS], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_DOCUMENTS);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as CachedDocument | undefined;
        if (result) {
          // biome-ignore lint/suspicious/noConsole: Error handling for background touch
          cachedDocuments.touch(id).catch(console.error);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all cached documents
   */
  async getAll(): Promise<CachedDocument[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_DOCUMENTS], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_DOCUMENTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update last accessed timestamp
   */
  async touch(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_DOCUMENTS], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DOCUMENTS);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result as CachedDocument | undefined;
        if (data) {
          data.lastAccessed = Date.now();
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  /**
   * Remove a cached document
   */
  async remove(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_DOCUMENTS], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DOCUMENTS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

// ============================================================================
// Sync Queue Management
// ============================================================================

export const syncQueue = {
  /**
   * Add item to sync queue
   */
  async add(type: string, payload: unknown, priority: number = 0): Promise<SyncQueueItem> {
    const db = await getDB();
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.add(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all items in sync queue
   */
  async getAll(): Promise<SyncQueueItem[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get items by priority (highest first)
   */
  async getByPriority(): Promise<SyncQueueItem[]> {
    const items = await this.getAll();
    return items.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Remove item from queue
   */
  async remove(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Increment retry count
   */
  async incrementRetry(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result as SyncQueueItem | undefined;
        if (data) {
          data.retryCount += 1;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  /**
   * Clear completed items (those with high retry counts)
   */
  async clearFailed(maxRetries: number = 5): Promise<number> {
    const items = await this.getAll();
    const failed = items.filter((item) => item.retryCount >= maxRetries);

    for (const item of failed) {
      await this.remove(item.id);
    }

    return failed.length;
  },
};

// ============================================================================
// Settings
// ============================================================================

export const settings = {
  /**
   * Set a setting value
   */
  async set(key: string, value: unknown): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.put({
        key,
        value,
        updatedAt: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get a setting value
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as OfflineSettings | undefined;
        resolve(result ? (result.value as T) : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Remove a setting
   */
  async remove(key: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  pendingMessages: number;
  cachedChats: number;
  cachedDocuments: number;
  syncQueue: number;
  estimatedSize?: string;
}> {
  const [messages, chats, docs, queue] = await Promise.all([
    pendingMessages.count(),
    cachedChats.getAll().then((c) => c.length),
    cachedDocuments.getAll().then((d) => d.length),
    syncQueue.getAll().then((q) => q.length),
  ]);

  let estimatedSize: string | undefined;
  if ('storage' in navigator) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        estimatedSize = `${(estimate.usage / 1024 / 1024).toFixed(2)} MB`;
      }
    } catch {
      // Ignore
    }
  }

  return {
    pendingMessages: messages,
    cachedChats: chats,
    cachedDocuments: docs,
    syncQueue: queue,
    estimatedSize,
  };
}

/**
 * Clear all offline data
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();

  const stores = [
    STORES.PENDING_MESSAGES,
    STORES.PENDING_DATA,
    STORES.CACHED_CHATS,
    STORES.CACHED_DOCUMENTS,
    STORES.SYNC_QUEUE,
  ];

  for (const storeName of stores) {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
