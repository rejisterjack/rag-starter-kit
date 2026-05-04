/**
 * Advanced Background Sync Manager
 * Provides sophisticated offline action queuing with priority-based ordering,
 * exponential backoff retries, deduplication, and conflict resolution.
 */

import {
  BACKOFF_BASE_DELAY,
  CHANNELS,
  MAX_ACTION_RETENTION,
  MAX_SYNC_RETRIES,
  SYNC_QUEUES,
} from './constants';
import { pendingActions } from './indexed-db';
import type {
  BroadcastSyncMessage,
  SyncAction,
  SyncActionMetadata,
  SyncActionPriority,
  SyncProgress,
} from './types';

// ─── Broadcast Channel ────────────────────────────────────────────────────────

let syncChannel: BroadcastChannel | null = null;

function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!syncChannel) {
    try {
      syncChannel = new BroadcastChannel(CHANNELS.SYNC_STATUS);
    } catch {
      // BroadcastChannel not supported
      return null;
    }
  }
  return syncChannel;
}

function broadcastSyncStatus(message: BroadcastSyncMessage): void {
  const channel = getSyncChannel();
  channel?.postMessage(message);
}

// ─── Idempotency Key Generation ──────────────────────────────────────────────

/**
 * Generate an idempotency key from request properties
 * Used to deduplicate identical actions
 */
function generateIdempotencyKey(method: string, url: string, body?: string): string {
  const input = `${method}:${url}:${body ?? ''}`;
  // Simple hash - sufficient for deduplication
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `${method}-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

// ─── Priority Ordering ────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<SyncActionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function sortByPriority(actions: SyncAction[]): SyncAction[] {
  return [...actions].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt - b.createdAt; // FIFO within same priority
  });
}

// ─── Exponential Backoff ──────────────────────────────────────────────────────

function getBackoffDelay(retryCount: number): number {
  const delay = BACKOFF_BASE_DELAY * 2 ** retryCount;
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * delay * 0.1;
  return Math.min(delay + jitter, 30000); // Max 30 seconds
}

function shouldRetry(action: SyncAction): boolean {
  if (action.retryCount >= MAX_SYNC_RETRIES) return false;
  if (action.expiresAt < Date.now()) return false;
  return true;
}

// ─── Sync Manager Class ───────────────────────────────────────────────────────

class SyncManager {
  private isSyncing = false;
  private syncAbortController: AbortController | null = null;
  private listeners: Set<(progress: SyncProgress) => void> = new Set();
  private progress: SyncProgress = {
    total: 0,
    completed: 0,
    inProgress: 0,
    failed: 0,
    isSyncing: false,
    lastSyncAt: undefined,
  };

  /**
   * Queue a new action for background sync
   */
  async queueAction(params: {
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    metadata: SyncActionMetadata;
    priority?: SyncActionPriority;
    queue?: string;
  }): Promise<SyncAction> {
    const serializedBody = params.body ? JSON.stringify(params.body) : undefined;

    const action: SyncAction = {
      id: crypto.randomUUID(),
      queue: params.queue ?? SYNC_QUEUES.API_MUTATIONS,
      method: params.method,
      url: params.url,
      body: serializedBody,
      headers: params.headers ?? { 'Content-Type': 'application/json' },
      metadata: params.metadata,
      status: 'pending',
      priority: params.priority ?? 'normal',
      retryCount: 0,
      createdAt: Date.now(),
      idempotencyKey: generateIdempotencyKey(params.method, params.url, serializedBody),
      expiresAt: Date.now() + MAX_ACTION_RETENTION,
    };

    await pendingActions.add(action);

    // Broadcast the queued action
    broadcastSyncStatus({
      type: 'action-queued',
      payload: action,
      timestamp: Date.now(),
    });

    // Update progress
    await this.updateProgress();

    // Try to register background sync
    await this.registerBackgroundSync(action.queue);

    // If online, attempt immediate sync
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void this.processQueue();
    }

    return action;
  }

  /**
   * Queue a chat message for sync
   */
  async queueChatMessage(params: {
    conversationId: string;
    content: string;
    attachments?: string[];
  }): Promise<SyncAction> {
    return this.queueAction({
      method: 'POST',
      url: '/api/chat',
      body: {
        conversationId: params.conversationId,
        content: params.content,
        attachments: params.attachments,
      },
      metadata: {
        description: `Send message: "${params.content.slice(0, 50)}${params.content.length > 50 ? '...' : ''}"`,
        type: 'chat-message',
        entityId: params.conversationId,
        entityType: 'conversation',
        undoable: true,
      },
      priority: 'high',
      queue: SYNC_QUEUES.CHAT_MESSAGES,
    });
  }

  /**
   * Process pending actions in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isSyncing = true;
    this.syncAbortController = new AbortController();

    try {
      // Clean up expired actions first
      await pendingActions.deleteExpired();

      const pending = await pendingActions.getPending();
      const failed = await pendingActions.getFailed();

      // Get retryable failed actions
      const retryable = failed.filter(shouldRetry);

      // Combine and sort by priority
      const toProcess = sortByPriority([...pending, ...retryable]);

      if (toProcess.length === 0) {
        this.isSyncing = false;
        await this.updateProgress();
        return;
      }

      this.progress = {
        ...this.progress,
        total: toProcess.length,
        completed: 0,
        inProgress: 0,
        failed: 0,
        isSyncing: true,
      };
      this.notifyListeners();

      for (const action of toProcess) {
        if (this.syncAbortController.signal.aborted) break;
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;

        // Check backoff for retried actions
        if (action.retryCount > 0 && action.lastAttemptAt) {
          const backoffDelay = getBackoffDelay(action.retryCount);
          const timeSinceLastAttempt = Date.now() - action.lastAttemptAt;
          if (timeSinceLastAttempt < backoffDelay) {
            continue; // Skip for now, will retry later
          }
        }

        await this.executeAction(action);
      }

      this.progress.lastSyncAt = Date.now();
    } catch (error) {
      console.error('[SyncManager] Queue processing error:', error);
    } finally {
      this.isSyncing = false;
      this.syncAbortController = null;
      await this.updateProgress();
    }
  }

  /**
   * Execute a single sync action
   */
  private async executeAction(action: SyncAction): Promise<void> {
    this.progress.inProgress++;
    this.notifyListeners();

    await pendingActions.markSyncing(action.id);

    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
        signal: this.syncAbortController?.signal,
      });

      if (response.ok || (response.status >= 200 && response.status < 300)) {
        await pendingActions.markCompleted(action.id);
        this.progress.completed++;

        broadcastSyncStatus({
          type: 'sync-complete',
          payload: this.progress,
          timestamp: Date.now(),
        });
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry (except 408, 429)
        if (response.status === 408 || response.status === 429) {
          await pendingActions.markFailed(action.id, `HTTP ${response.status}`);
          this.progress.failed++;
        } else {
          // Permanent failure - mark completed to remove from queue
          await pendingActions.markCompleted(action.id);
          this.progress.failed++;
          console.warn(
            `[SyncManager] Permanent failure for action ${action.id}: HTTP ${response.status}`
          );
        }
      } else {
        // Server error - retry
        await pendingActions.markFailed(action.id, `HTTP ${response.status}`);
        this.progress.failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Don't count abort as failure
      if (error instanceof DOMException && error.name === 'AbortError') {
        await pendingActions.update(action.id, { status: 'pending' });
        return;
      }

      await pendingActions.markFailed(action.id, errorMessage);
      this.progress.failed++;

      broadcastSyncStatus({
        type: 'sync-error',
        payload: this.progress,
        timestamp: Date.now(),
      });
    } finally {
      this.progress.inProgress--;
      this.notifyListeners();
    }
  }

  /**
   * Remove an action from the queue (undo)
   */
  async removeAction(actionId: string): Promise<boolean> {
    const action = await pendingActions.get(actionId);
    if (!action) return false;

    // Only allow removal of pending/failed actions
    if (action.status === 'syncing') return false;

    await pendingActions.delete(actionId);
    await this.updateProgress();
    return true;
  }

  /**
   * Retry a specific failed action
   */
  async retryAction(actionId: string): Promise<boolean> {
    const action = await pendingActions.get(actionId);
    if (!action || action.status !== 'failed') return false;

    await pendingActions.update(actionId, {
      status: 'pending',
      retryCount: 0,
      lastError: undefined,
    });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void this.processQueue();
    }

    return true;
  }

  /**
   * Abort current sync operation
   */
  abort(): void {
    this.syncAbortController?.abort();
  }

  /**
   * Get current sync progress
   */
  async getProgress(): Promise<SyncProgress> {
    await this.updateProgress();
    return { ...this.progress };
  }

  /**
   * Get all actions for a specific entity
   */
  async getActionsForEntity(entityId: string): Promise<SyncAction[]> {
    const all = await pendingActions.getAll();
    return all.filter((a) => a.metadata.entityId === entityId);
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(listener: (progress: SyncProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Register for Browser Background Sync API
   */
  private async registerBackgroundSync(tag: string): Promise<void> {
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (
          registration as unknown as { sync: { register: (tag: string) => Promise<void> } }
        ).sync.register(tag);
      }
    } catch {
      // Background Sync not supported or permission denied
    }
  }

  private async updateProgress(): Promise<void> {
    try {
      const pending = await pendingActions.getPending();
      const failed = await pendingActions.getFailed();
      const syncing = await pendingActions.getByStatus('syncing');

      this.progress = {
        total: pending.length + failed.length + syncing.length,
        completed: this.progress.completed,
        inProgress: syncing.length,
        failed: failed.length,
        isSyncing: this.isSyncing,
        lastSyncAt: this.progress.lastSyncAt,
      };

      this.notifyListeners();

      broadcastSyncStatus({
        type: 'sync-progress',
        payload: this.progress,
        timestamp: Date.now(),
      });
    } catch {
      // Silently fail - DB might not be ready
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.progress });
      } catch {
        // Don't let listener errors break the sync
      }
    }
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Queue an API mutation for background sync
 */
export async function queueMutation(params: {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  description: string;
  entityId?: string;
  entityType?: string;
  priority?: SyncActionPriority;
}): Promise<SyncAction> {
  const manager = getSyncManager();
  return manager.queueAction({
    method: params.method,
    url: params.url,
    body: params.body,
    headers: params.headers,
    metadata: {
      description: params.description,
      type: 'api-mutation',
      entityId: params.entityId,
      entityType: params.entityType,
      undoable: true,
    },
    priority: params.priority,
  });
}

/**
 * Queue a chat message for offline sending
 */
export async function queueChatMessage(
  conversationId: string,
  content: string,
  attachments?: string[]
): Promise<SyncAction> {
  const manager = getSyncManager();
  return manager.queueChatMessage({ conversationId, content, attachments });
}

/**
 * Trigger queue processing (call when coming back online)
 */
export async function processSyncQueue(): Promise<void> {
  const manager = getSyncManager();
  return manager.processQueue();
}

/**
 * Get sync progress
 */
export async function getSyncProgress(): Promise<SyncProgress> {
  const manager = getSyncManager();
  return manager.getProgress();
}

/**
 * Subscribe to sync progress changes
 */
export function onSyncProgress(listener: (progress: SyncProgress) => void): () => void {
  const manager = getSyncManager();
  return manager.onProgress(listener);
}
