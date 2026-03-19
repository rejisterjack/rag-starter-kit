/**
 * React Hook for PWA functionality
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAStatus {
  isSupported: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isOffline: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerUpdated: boolean;
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
  });

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if PWA is supported
    const isSupported = 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
    
    // Check if running in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setStatus((prev) => ({
      ...prev,
      isSupported,
      isStandalone,
      isInstalled: isStandalone,
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
        .catch((error) => {
          console.error('SW registration failed:', error);
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

export default usePWA;
