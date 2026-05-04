/**
 * PWA Components
 * Progressive Web App UI components
 */

// ─── Connectivity (Enhanced) ──────────────────────────────────────────────────

export {
  ConnectivityBanner,
  ConnectivityChip,
  ConnectivityDot,
} from './connectivity-banner';

// ─── Sync Progress ────────────────────────────────────────────────────────────

export {
  SyncActionList,
  SyncProgressBar,
  SyncStatusBadge,
  SyncToast,
} from './sync-progress';

// ─── Data Freshness ───────────────────────────────────────────────────────────

export {
  CachedDataWrapper,
  FreshnessBadge,
  FreshnessBar,
} from './data-freshness';

// ─── Offline Fallback ─────────────────────────────────────────────────────────

export { OfflineFallback } from './offline-fallback';

// ─── Install Prompt ───────────────────────────────────────────────────────────

export {
  FloatingInstallButton,
  InstallPrompt,
  IOSInstallHint,
} from './install-prompt';

// ─── Offline Indicators (Legacy) ──────────────────────────────────────────────

export {
  ConnectionDot as LegacyConnectionDot,
  NetworkStatusBadge,
  OfflineIndicator,
  OfflineSkeleton,
} from './offline-indicator';

// ─── Offline Message Composer ─────────────────────────────────────────────────

export {
  OfflineInput,
  OfflineMessageComposer,
  PendingMessagesBadge,
} from './offline-message-composer';

// ─── Provider ─────────────────────────────────────────────────────────────────

export { PWAProvider } from './pwa-provider';

// ─── PWA Infrastructure ───────────────────────────────────────────────────────

export { PWAScripts } from './pwa-scripts';

// ─── Update Notifications ─────────────────────────────────────────────────────

export {
  CheckUpdateButton,
  UpdateBanner,
  UpdateToast,
  VersionInfo,
} from './update-toast';
