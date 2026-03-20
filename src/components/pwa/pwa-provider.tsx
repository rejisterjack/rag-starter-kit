'use client';

import { type ReactNode, useEffect } from 'react';
import { InstallPrompt, OfflineIndicator, UpdateToast } from '@/components/pwa';
import { usePWA, useServiceWorker } from '@/hooks/use-pwa';

/**
 * PWA Provider Props
 */
interface PWAProviderProps {
  children: ReactNode;
  /** Show install prompt */
  showInstallPrompt?: boolean;
  /** Show update notifications */
  showUpdateToast?: boolean;
  /** Show offline indicator */
  showOfflineIndicator?: boolean;
  /** Delay before showing install prompt (ms) */
  installPromptDelay?: number;
}

/**
 * PWA Provider Component
 * Wraps the application with PWA-related UI components and functionality
 *
 * @example
 * ```tsx
 * <PWAProvider
 *   showInstallPrompt={true}
 *   showUpdateToast={true}
 *   showOfflineIndicator={true}
 * >
 *   <App />
 * </PWAProvider>
 * ```
 */
export function PWAProvider({
  children,
  showInstallPrompt = true,
  showUpdateToast = true,
  showOfflineIndicator = true,
  installPromptDelay = 5000,
}: PWAProviderProps) {
  const { isInstalled } = usePWA();
  const { checkForUpdate } = useServiceWorker();

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

      {/* Install Prompt */}
      {showInstallPrompt && !isInstalled && <InstallPrompt delay={installPromptDelay} />}

      {/* Update Toast */}
      {showUpdateToast && <UpdateToast checkOnMount={true} />}

      {/* Offline Indicator */}
      {showOfflineIndicator && <OfflineIndicator variant="toast" position="bottom" />}
    </>
  );
}
