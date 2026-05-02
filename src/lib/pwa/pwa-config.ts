/**
 * PWA Configuration
 * Central configuration for Progressive Web App functionality
 */

/**
 * PWA Application Configuration
 */
export const PWA_CONFIG = {
  /** Application name */
  appName: 'RAG Chatbot',
  /** Short application name */
  shortName: 'RAG Chat',
  /** Application version */
  version: '1.0.0',
  /** Theme colors */
  themeColor: '#18181b',
  /** Background color */
  backgroundColor: '#ffffff',
  /** Display mode */
  display: 'standalone' as const,
  /** Default orientation */
  orientation: 'portrait-primary' as const,
  /** Service worker scope */
  scope: '/',
  /** Start URL */
  startUrl: '/',
  /** Cache version prefix */
  cacheVersion: 'v1',
} as const;

/**
 * Storage keys for PWA-related data
 */
export const STORAGE_KEYS = {
  /** Install prompt dismissed timestamp */
  INSTALL_PROMPT_DISMISSED: 'pwa:install-prompt-dismissed',
  /** Last update check timestamp */
  LAST_UPDATE_CHECK: 'pwa:last-update-check',
  /** Service worker registration state */
  SW_REGISTRATION: 'pwa:sw-registration',
  /** Pending messages for background sync */
  PENDING_MESSAGES: 'pwa:pending-messages',
  /** User preference for update notifications */
  UPDATE_NOTIFICATIONS: 'pwa:update-notifications',
  /** Last shown update timestamp */
  LAST_SHOWN_UPDATE: 'pwa:last-shown-update',
} as const;

/**
 * Time constants (in milliseconds)
 */
export const TIME_CONSTANTS = {
  /** 1 minute */
  ONE_MINUTE: 60 * 1000,
  /** 1 hour */
  ONE_HOUR: 60 * 60 * 1000,
  /** 1 day */
  ONE_DAY: 24 * 60 * 60 * 1000,
  /** 1 week */
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  /** Install prompt cooldown period */
  INSTALL_PROMPT_COOLDOWN: 7 * 24 * 60 * 60 * 1000, // 1 week
  /** Update check interval */
  UPDATE_CHECK_INTERVAL: 60 * 60 * 1000, // 1 hour
  /** Debounce time for offline status changes */
  OFFLINE_DEBOUNCE: 2000, // 2 seconds
} as const;

/**
 * PWA Feature Flags
 */
export const PWA_FEATURES = {
  /** Enable service worker */
  enableServiceWorker: true,
  /** Enable background sync */
  enableBackgroundSync: true,
  /** Enable push notifications */
  enablePushNotifications: false, // Requires additional setup
  /** Enable periodic sync */
  enablePeriodicSync: false,
  /** Enable install prompt */
  enableInstallPrompt: true,
  /** Enable update notifications */
  enableUpdateNotifications: true,
} as const;

/**
 * Service Worker Configuration
 */
export const SW_CONFIG = {
  /** Service worker file path */
  swPath: '/sw.js',
  /** Registration scope */
  scope: '/',
  /** Update check interval (ms) */
  updateCheckInterval: TIME_CONSTANTS.ONE_HOUR,
  /** Maximum update attempts */
  maxUpdateAttempts: 3,
} as const;

/**
 * Caching Strategies Configuration
 */
export const CACHE_STRATEGIES = {
  /** Static assets cache name */
  staticCacheName: `rag-static-${PWA_CONFIG.cacheVersion}`,
  /** API cache name */
  apiCacheName: `rag-api-${PWA_CONFIG.cacheVersion}`,
  /** Documents cache name */
  documentsCacheName: `rag-documents-${PWA_CONFIG.cacheVersion}`,
  /** Images cache name */
  imagesCacheName: `rag-images-${PWA_CONFIG.cacheVersion}`,
  /** Static asset max age (days) */
  staticMaxAge: 30,
  /** Image max age (days) */
  imageMaxAge: 7,
  /** API response max age (minutes) */
  apiMaxAge: 5,
} as const;

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    // Android Trusted Web Activity
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if the app is running on iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * Check if the app is running on Safari
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return (
    /^((?!chrome|android).)*safari/i.test(userAgent) ||
    // iOS Chrome uses WKWebView which behaves like Safari
    (/crios/.test(userAgent) && isIOS())
  );
}

/**
 * Check if the app is installable (not already installed)
 */
export function isInstallable(): boolean {
  return !isStandalone() && typeof window !== 'undefined';
}

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Check if background sync is supported
 */
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check if periodic sync is supported
 */
export function isPeriodicSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype;
}

/**
 * Check if the browser supports PWA installation
 */
export function isPWAInstallSupported(): boolean {
  if (typeof window === 'undefined') return false;

  // BeforeInstallPromptEvent is the standard way
  // iOS Safari doesn't support this, but can still be installed via "Add to Home Screen"
  return true;
}

/**
 * Get iOS installation instructions
 */
export function getIOSInstallInstructions(): string[] {
  return [
    'Tap the Share button in Safari (the square with an arrow)',
    'Scroll down and tap "Add to Home Screen"',
    'Tap "Add" in the top right corner',
  ];
}

/**
 * Get Android/Chrome installation instructions
 */
export function getAndroidInstallInstructions(): string[] {
  return [
    'Tap the menu (three dots) in Chrome',
    'Tap "Add to Home screen" or "Install app"',
    'Tap "Install" to confirm',
  ];
}

/**
 * Get desktop installation instructions
 */
export function getDesktopInstallInstructions(): string[] {
  return [
    'Click the install icon in the address bar',
    'Or click the menu (three dots) and select "Install"',
    'Click "Install" to confirm',
  ];
}

/**
 * Debounce function for offline status changes
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Get estimated storage usage
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  usageDetails?: Record<string, number>;
} | null> {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      usageDetails: (estimate as { usageDetails?: Record<string, number> }).usageDetails,
    };
  } catch (_error: unknown) {
    return null;
  }
}
