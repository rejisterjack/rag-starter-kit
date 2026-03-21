/**
 * React Hook for PWA functionality
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface PWAStatus {
  isSupported: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isOffline: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerUpdated: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  isIOS: boolean;
}

export interface UsePWAReturn extends PWAStatus {
  install: () => Promise<boolean>;
  dismissInstall: () => void;
  updateServiceWorker: () => Promise<void>;
  skipWaiting: () => void;
}

export function usePWA(): UsePWAReturn {
  const [status, setStatus] = useState<PWAStatus>({
    isSupported: false,
    isInstalled: false,
    isStandalone: false,
    canInstall: false,
    isOffline: false,
    serviceWorkerRegistered: false,
    serviceWorkerUpdated: false,
    platform: 'unknown',
    isIOS: false,
  });

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if PWA is supported
    const isSupported = 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;

    // Check if running in standalone mode
    const nav = window.navigator as NavigatorWithStandalone;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const platform: PWAStatus['platform'] = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

    setStatus((prev) => ({
      ...prev,
      isSupported,
      isStandalone,
      isInstalled: isStandalone,
      platform,
      isIOS,
    }));

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setStatus((prev) => ({ ...prev, canInstall: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    // Listen for app installed
    const handleAppInstalled = () => {
      deferredPrompt.current = null;
      setStatus((prev) => ({
        ...prev,
        canInstall: false,
        isInstalled: true,
      }));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for offline/online
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOffline: false }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOffline: true }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial offline status
    setStatus((prev) => ({ ...prev, isOffline: !navigator.onLine }));

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          swRegistration.current = registration;
          setStatus((prev) => ({ ...prev, serviceWorkerRegistered: true }));

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setStatus((prev) => ({ ...prev, serviceWorkerUpdated: true }));
                }
              });
            }
          });
        })
        .catch(() => {
          // Silently handle service worker registration failure
        });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setStatus((prev) => ({ ...prev, serviceWorkerUpdated: true }));
        }
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) {
      return false;
    }

    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;

    deferredPrompt.current = null;
    setStatus((prev) => ({ ...prev, canInstall: false }));

    return outcome === 'accepted';
  }, []);

  const dismissInstall = useCallback(() => {
    deferredPrompt.current = null;
    setStatus((prev) => ({ ...prev, canInstall: false }));
  }, []);

  const updateServiceWorker = useCallback(async () => {
    if (!swRegistration.current) return;

    await swRegistration.current.update();
  }, []);

  const skipWaiting = useCallback(() => {
    if (!swRegistration.current?.waiting) return;

    swRegistration.current.waiting.postMessage({ type: 'SKIP_WAITING' });
    setStatus((prev) => ({ ...prev, serviceWorkerUpdated: false }));
  }, []);

  return {
    ...status,
    install,
    dismissInstall,
    updateServiceWorker,
    skipWaiting,
  };
}

/**
 * Hook for service worker update management
 * Provides functionality to check for and apply updates
 */
export function useServiceWorker(): {
  updateAvailable: boolean;
  isUpdating: boolean;
  isRegistered: boolean;
  update: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
} {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          swRegistration.current = registration;
          setIsRegistered(true);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch(() => {
          // Silently handle service worker registration failure
        });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setUpdateAvailable(true);
        }
      });
    }
  }, []);

  const checkForUpdate = useCallback(async (): Promise<void> => {
    if (!swRegistration.current) return;
    await swRegistration.current.update();
  }, []);

  const update = useCallback(async (): Promise<void> => {
    setIsUpdating(true);

    if (swRegistration.current?.waiting) {
      swRegistration.current.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Wait a bit for the service worker to activate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Reload the page to use the new service worker
    window.location.reload();
  }, []);

  return {
    updateAvailable,
    isUpdating,
    isRegistered,
    update,
    checkForUpdate,
  };
}

/**
 * Hook for offline status management
 * Provides offline state and duration formatting
 */
export function useOfflineStatus(): {
  isOffline: boolean;
  wasOffline: boolean;
  formattedOfflineDuration: string | null;
} {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set initial state
    setIsOffline(!navigator.onLine);
    if (!navigator.onLine) {
      setOfflineSince(new Date());
    }

    const handleOnline = () => {
      setIsOffline(false);
      if (offlineSince) {
        setWasOffline(true);
      }
      setOfflineSince(null);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setOfflineSince(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineSince]);

  const formattedOfflineDuration = useMemo(() => {
    if (!offlineSince) return null;

    const now = new Date();
    const diffMs = now.getTime() - offlineSince.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    if (diffMins > 0) {
      return `${diffMins}m`;
    }
    return 'just now';
  }, [offlineSince]);

  return {
    isOffline,
    wasOffline,
    formattedOfflineDuration,
  };
}

/**
 * Hook for install prompt functionality
 * Provides functionality to trigger the PWA install prompt
 */
export function useInstallPrompt(): {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<boolean>;
  dismissInstall: () => void;
} {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode
    const nav = window.navigator as NavigatorWithStandalone;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

    setIsStandalone(standalone);
    setIsInstalled(standalone);

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      deferredPrompt.current = null;
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) {
      return false;
    }

    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;

    deferredPrompt.current = null;
    setIsInstallable(false);

    return outcome === 'accepted';
  }, []);

  const dismissInstall = useCallback(() => {
    deferredPrompt.current = null;
    setIsInstallable(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isStandalone,
    promptInstall,
    dismissInstall,
  };
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync?: {
    register(tag: string): Promise<void>;
  };
}

/**
 * Hook for background sync functionality
 * Provides functionality to queue actions for when the app comes back online
 */
export function useBackgroundSync(): {
  isOnline: boolean;
  isSupported: boolean;
  queueAction: (action: () => Promise<void>) => Promise<void>;
  registerSync: (tag: string) => Promise<void>;
  pendingCount: number;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const actionQueue = useRef<(() => Promise<void>)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if Background Sync is supported
    setIsSupported('serviceWorker' in navigator && 'SyncManager' in window);

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Process queued actions
      processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [
    // Process queued actions
    processQueue,
  ]);

  const processQueue = useCallback(async () => {
    while (actionQueue.current.length > 0 && navigator.onLine) {
      const action = actionQueue.current.shift();
      if (action) {
        try {
          await action();
        } catch {
          // Silently handle background sync action failures
        }
      }
      setPendingCount(actionQueue.current.length);
    }
  }, []);

  const queueAction = useCallback(async (action: () => Promise<void>): Promise<void> => {
    if (navigator.onLine) {
      // Execute immediately if online
      await action();
    } else {
      // Queue for later if offline
      actionQueue.current.push(action);
      setPendingCount(actionQueue.current.length);
    }
  }, []);

  const registerSync = useCallback(
    async (tag: string): Promise<void> => {
      if (!isSupported || !navigator.serviceWorker?.ready) return;

      try {
        const registration = (await navigator.serviceWorker
          .ready) as ServiceWorkerRegistrationWithSync;
        if (registration.sync) {
          await registration.sync.register(tag);
        }
      } catch {
        // Silently handle sync registration failures
      }
    },
    [isSupported]
  );

  return {
    isOnline,
    isSupported,
    queueAction,
    registerSync,
    pendingCount,
  };
}

export default usePWA;
