# PWA Components

This directory contains Progressive Web App (PWA) components for the RAG Starter Kit.

## Components

### `install-prompt.tsx`
- `InstallPrompt` - Install banner with variants (banner, card, minimal)
- `FloatingInstallButton` - Fixed floating install button
- `IOSInstallHint` - iOS-specific install instructions

### `offline-indicator.tsx`
- `OfflineIndicator` - Network status banner/toast
- `NetworkStatusBadge` - Online/offline badge
- `ConnectionDot` - Minimal connection indicator
- `OfflineSkeleton` - Placeholder for offline content

### `update-toast.tsx`
- `UpdateToast` - Update notification toast
- `UpdateBanner` - Fixed update banner
- `VersionInfo` - Version and status display
- `CheckUpdateButton` - Manual update checker

### `offline-message-composer.tsx`
- `OfflineMessageComposer` - Textarea with offline queue support
- `OfflineInput` - Simple offline-aware input
- `PendingMessagesBadge` - Badge showing pending count

### `pwa-scripts.tsx`
Service worker registration and global PWA utilities.

### `pwa-provider.tsx`
Provider component that includes all PWA UI components.

## Usage

```tsx
import { 
  InstallPrompt, 
  OfflineIndicator, 
  UpdateToast,
  OfflineMessageComposer,
  PWAProvider 
} from '@/components/pwa';

// Use individual components
<InstallPrompt />
<OfflineIndicator variant="toast" />
<UpdateToast />

// Or use the provider for everything
<PWAProvider>
  <YourApp />
</PWAProvider>
```
