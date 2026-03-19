/**
 * PWA Library
 * Progressive Web App utilities and configuration
 */

// Configuration
export {
  PWA_CONFIG,
  STORAGE_KEYS,
  TIME_CONSTANTS,
  PWA_FEATURES,
  SW_CONFIG,
  CACHE_STRATEGIES,
} from "./pwa-config";

// Utility functions
export {
  isStandalone,
  isIOS,
  isSafari,
  isInstallable,
  isServiceWorkerSupported,
  isBackgroundSyncSupported,
  isPushSupported,
  isPeriodicSyncSupported,
  isPWAInstallSupported,
  getIOSInstallInstructions,
  getAndroidInstallInstructions,
  getDesktopInstallInstructions,
  debounce,
  formatBytes,
  getStorageEstimate,
} from "./pwa-config";
