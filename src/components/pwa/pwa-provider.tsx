'use client';

import { type ReactNode, useEffect } from 'react';
import { ConnectivityBanner, InstallPrompt, SyncToast, UpdateToast } from '@/components/pwa';
import { usePWA, useServiceWorker } from '@/hooks/use-pwa';
import { startConnectivityMonitoring } from '@/lib/offline/connectivity-monitor';
import { runMaintenance } from '@/lib/offline/indexed-db';

/**
 * PWA Provider Props
 */
interface PWAProviderProps {
  children: ReactNode;
  /** Show install prompt */
  showInstallPrompt?: boolean;
  /** Show update notifications */
  showUpdateToast?: boolean;
  /** Show connectivity banner */
  showConnectivityBanner?: boolean;
  /** Show sync toast notifications */
  showSyncToast?: boolean;
  /** Position of the connectivity banner */
  connectivityPosition?: 'top' | 'bottom';
  /** Delay before showing install prompt (ms) */
  installPromptDelay?: number;
}

/**
 * PWA Provider Component
 * Wraps the application with PWA-related UI components and functionality.
 * Initializes connectivity monitoring, background sync, and IndexedDB maintenance.
 *
 * @example
 * ```tsx
 * <PWAProvider
 *   showInstallPrompt={true}
 *   showUpdateToast={true}
 *   showConnectivityBanner={true}
 *   showSyncToast={true}
 * >
 *   <App />
 * </PWAProvider>
 * ```
 */
export function PWAProvider({
  children,
  showInstallPrompt = true,
  showUpdateToast = true,
  showConnectivityBanner = true,
  showSyncToast = true,
  connectivityPosition = 'top',
  installPromptDelay = 5000,
}: PWAProviderProps) {
  const { isInstalled } = usePWA();
  const { checkForUpdate } = useServiceWorker();

  // Initialize connectivity monitoring and DB maintenance
  useEffect(() => {
    // Start monitoring network state
    startConnectivityMonitoring();

    // Run DB maintenance on start (clear expired, evict old)
    void runMaintenance();

    // Periodic maintenance every 15 minutes
    const maintenanceInterval = setInterval(
      () => {
        void runMaintenance();
      },
      15 * 60 * 1000
    );

    return () => clearInterval(maintenanceInterval);
  }, []);

  // Check for updates periodically
  useEffect(() => {
    const checkInterval = setInterval(
      () => {
        checkForUpdate();
      },
      60 * 60 * 1000
    ); // Check every hour

    return () => clearInterval(checkInterval);
  }, [checkForUpdate]);

  return (
    <>
      {children}

      {/* Connectivity Banner (enhanced - replaces OfflineIndicator) */}
      {showConnectivityBanner && <ConnectivityBanner position={connectivityPosition} />}

      {/* Sync Toast (shows when background sync completes) */}
      {showSyncToast && <SyncToast />}

      {/* Install Prompt */}
      {showInstallPrompt && !isInstalled && <InstallPrompt delay={installPromptDelay} />}

      {/* Update Toast */}
      {showUpdateToast && <UpdateToast checkOnMount={true} />}
    </>
  );
}
