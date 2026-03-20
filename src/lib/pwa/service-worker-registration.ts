/**
 * Service Worker Registration
 * Handles SW registration, updates, and lifecycle events
 */

import { STORAGE_KEYS, SW_CONFIG } from './pwa-config';

// ============================================================================
// Types
// ============================================================================

export interface ServiceWorkerRegistrationOptions {
  /** Scope for the service worker */
  scope?: string;
  /** Called when an update is available */
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  /** Called when SW is installed for the first time */
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  /** Called when registration fails */
  onError?: (error: Error) => void;
  /** Called when offline mode is detected */
  onOffline?: () => void;
  /** Called when coming back online */
  onOnline?: () => void;
}

export interface UpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Error if check failed */
  error?: Error;
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register the service worker
 * @returns Promise that resolves to the registration or null
 */
export async function registerServiceWorker(
  options: ServiceWorkerRegistrationOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  const { scope = SW_CONFIG.scope, onUpdate, onSuccess, onError } = options;

  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_CONFIG.swPath, {
      scope,
      updateViaCache: 'imports',
    });

    console.log('[SW] Service Worker registered with scope:', registration.scope);

    // Store registration globally for access
    if (typeof window !== 'undefined') {
      (
        window as unknown as { __SW_REGISTRATION__?: ServiceWorkerRegistration }
      ).__SW_REGISTRATION__ = registration;
    }

    // Handle updates
    handleServiceWorkerUpdates(registration, onUpdate);

    // Wait for service worker to be ready
    navigator.serviceWorker.ready.then(() => {
      console.log('[SW] Service Worker is active');
      onSuccess?.(registration);
    });

    // Set up online/offline handlers
    setupNetworkHandlers(options.onOffline, options.onOnline);

    return registration;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SW] Registration failed:', err);
    onError?.(err);
    return null;
  }
}

/**
 * Handle service worker update lifecycle
 */
function handleServiceWorkerUpdates(
  registration: ServiceWorkerRegistration,
  onUpdate?: (registration: ServiceWorkerRegistration) => void
): void {
  // Listen for new service worker installation
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;

    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      // A new service worker has been installed and is waiting
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW] New version available');
        onUpdate?.(registration);

        // Dispatch custom event for components to listen to
        window.dispatchEvent(
          new CustomEvent('sw-update-available', {
            detail: { registration },
          })
        );
      }
    });
  });

  // Listen for controller changes (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Service Worker controller changed');
    window.dispatchEvent(new CustomEvent('sw-controller-changed'));
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type) {
      handleServiceWorkerMessage(event.data);
    }
  });
}

/**
 * Handle messages from the service worker
 */
function handleServiceWorkerMessage(data: { type: string; payload?: unknown }): void {
  switch (data.type) {
    case 'UPDATE_AVAILABLE':
      window.dispatchEvent(new CustomEvent('sw-update-available', { detail: data }));
      break;
    case 'SYNC_COMPLETE':
      window.dispatchEvent(new CustomEvent('sw-sync-complete', { detail: data }));
      break;
    case 'CACHE_UPDATED':
      window.dispatchEvent(new CustomEvent('sw-cache-updated', { detail: data }));
      break;
    default:
      console.log('[SW] Message from service worker:', data);
  }
}

/**
 * Set up online/offline event handlers
 */
function setupNetworkHandlers(onOffline?: () => void, onOnline?: () => void): void {
  const handleOnline = () => {
    console.log('[SW] App is online');
    document.body.classList.remove('offline');
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('[SW] App is offline');
    document.body.classList.add('offline');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Set initial state
  if (!navigator.onLine) {
    handleOffline();
  }
}

// ============================================================================
// Update Management
// ============================================================================

/**
 * Check for service worker updates
 * @returns Promise resolving to update check result
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!('serviceWorker' in navigator)) {
    return { updateAvailable: false };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return { updateAvailable: !!registration.waiting };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SW] Update check failed:', err);
    return { updateAvailable: false, error: err };
  }
}

/**
 * Force the waiting service worker to activate
 * Reloads the page to apply the update
 */
export async function applyUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  if (registration.waiting) {
    // Send message to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Wait for controller change then reload
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        resolve();
      });
    });

    // Store last update time
    localStorage.setItem(STORAGE_KEYS.LAST_SHOWN_UPDATE, Date.now().toString());

    // Reload to activate new service worker
    window.location.reload();
  }
}

/**
 * Get the current service worker registration
 */
export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    console.log('[SW] Unregistered:', result);
    return result;
  } catch (error) {
    console.error('[SW] Unregister failed:', error);
    return false;
  }
}

// ============================================================================
// Communication
// ============================================================================

/**
 * Send a message to the service worker
 */
export async function sendMessageToSW(message: { type: string; payload?: unknown }): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if (registration.active) {
    registration.active.postMessage(message);
  }
}

/**
 * Request background sync
 */
export async function requestBackgroundSync(tag: string = 'sync-messages'): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (registration as any).sync.register(tag);
    return true;
  } catch (error) {
    console.error('[SW] Background sync registration failed:', error);
    return false;
  }
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear all caches created by the service worker
 */
export async function clearAllCaches(): Promise<boolean> {
  try {
    // Send message to service worker to clear caches
    sendMessageToSW({ type: 'CLEAR_CACHE' });

    // Also clear from main thread
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.filter((name) => name.startsWith('rag-')).map((name) => caches.delete(name))
    );

    console.log('[SW] All caches cleared');
    return true;
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalCaches: number;
  cacheNames: string[];
  estimatedSize?: string;
}> {
  try {
    const cacheNames = await caches.keys();
    const ragCaches = cacheNames.filter((name) => name.startsWith('rag-'));

    // Try to get storage estimate
    let estimatedSize: string | undefined;
    if ('storage' in navigator) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        estimatedSize = `${(estimate.usage / 1024 / 1024).toFixed(2)} MB`;
      }
    }

    return {
      totalCaches: ragCaches.length,
      cacheNames: ragCaches,
      estimatedSize,
    };
  } catch (error) {
    console.error('[SW] Failed to get cache stats:', error);
    return {
      totalCaches: 0,
      cacheNames: [],
    };
  }
}
