# Progressive Web App (PWA) Support

The RAG Starter Kit includes comprehensive Progressive Web App (PWA) support, enabling offline functionality, install prompts, and app-like behavior.

## Features

### Core PWA Features

- **Web App Manifest** - Installable on mobile and desktop devices
- **Service Worker** - Workbox-based caching for offline support
- **Install Prompt** - Native install prompt for supported browsers
- **Offline Indicator** - Visual feedback when connection is lost
- **Update Notifications** - Automatic update detection and prompts
- **Background Sync** - Queue messages when offline, send when reconnected

### Caching Strategies

| Resource Type | Strategy | Description |
|--------------|----------|-------------|
| Static Assets | Cache First | JS, CSS, fonts cached on install |
| API Calls | Network First | Fall back to cache when offline |
| Documents | Stale While Revalidate | Immediate response, update in background |
| Images | Cache First with Expiration | 30-day cache with automatic cleanup |

## File Structure

```
public/
├── manifest.json          # Web App Manifest
├── sw.js                  # Service Worker
└── icons/                 # App icons (various sizes)
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    └── icon-512x512.png

src/
├── app/
│   └── offline/
│       └── page.tsx       # Offline fallback page
├── components/pwa/
│   ├── install-prompt.tsx         # Install banner/prompt
│   ├── offline-indicator.tsx      # Offline status banner
│   ├── update-toast.tsx           # Update notification
│   ├── offline-message-composer.tsx # Offline-aware input
│   ├── pwa-scripts.tsx            # Service worker registration
│   └── pwa-provider.tsx           # PWA context provider
├── hooks/
│   └── use-pwa.ts         # PWA React hooks
└── lib/pwa/
    ├── pwa-config.ts      # PWA configuration
    └── index.ts           # PWA utilities
```

## Installation

The PWA features are already integrated. To complete setup:

1. **Generate Icons**: Create app icons in the following sizes:
   - 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
   - Place them in `public/icons/`
   - Use a tool like [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)

2. **Update Theme Colors**: Edit `public/manifest.json` and `src/lib/pwa/pwa-config.ts` to match your brand colors.

## Usage

### Basic Integration

The PWA is automatically integrated via the layout:

```tsx
// src/app/layout.tsx
import { PWAScripts } from '@/components/pwa/pwa-scripts';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <PWAScripts />
      </body>
    </html>
  );
}
```

### Using PWA Hooks

#### usePWA Hook

Get PWA status and capabilities:

```tsx
import { usePWA } from '@/hooks/use-pwa';

function App() {
  const { 
    isInstalled,      // App is installed (standalone mode)
    isOnline,         // Network status
    platform,         // 'ios', 'android', 'chrome', etc.
    isServiceWorkerSupported,
    isBackgroundSyncSupported,
    isPushSupported,
  } = usePWA();

  return (
    <div>
      {isOnline ? 'Online' : 'Offline'}
      {isInstalled && <span>Running as installed app</span>}
    </div>
  );
}
```

#### useInstallPrompt Hook

Handle app installation:

```tsx
import { useInstallPrompt } from '@/hooks/use-pwa';

function InstallButton() {
  const { isAvailable, showPrompt, dismiss } = useInstallPrompt();

  if (!isAvailable) return null;

  return (
    <button onClick={showPrompt}>
      Install App
    </button>
  );
}
```

#### useOfflineStatus Hook

Monitor online/offline status:

```tsx
import { useOfflineStatus } from '@/hooks/use-pwa';

function NetworkStatus() {
  const { 
    isOffline, 
    wasOffline, 
    offlineAt, 
    formattedOfflineDuration 
  } = useOfflineStatus();

  if (isOffline) {
    return <span>Offline since {formattedOfflineDuration}</span>;
  }

  if (wasOffline) {
    return <span>Back online!</span>;
  }

  return null;
}
```

#### useServiceWorker Hook

Manage service worker updates:

```tsx
import { useServiceWorker } from '@/hooks/use-pwa';
import { toast } from '@/components/ui/toaster';

function App() {
  const { 
    updateAvailable, 
    update,
    checkForUpdate 
  } = useServiceWorker();

  useEffect(() => {
    if (updateAvailable) {
      toast.info('Update available!', {
        action: { label: 'Update', onClick: update }
      });
    }
  }, [updateAvailable, update]);

  return <AppContent />;
}
```

### Using PWA Components

#### Install Prompt

```tsx
import { InstallPrompt } from '@/components/pwa';

// Banner (default)
<InstallPrompt />

// Card variant
<InstallPrompt variant="card" />

// Minimal variant
<InstallPrompt variant="minimal" />

// With custom delay
<InstallPrompt delay={5000} />
```

#### Offline Indicator

```tsx
import { OfflineIndicator } from '@/components/pwa';

// Banner at top
<OfflineIndicator variant="banner" position="top" />

// Toast notification
<OfflineIndicator variant="toast" />

// Minimal badge
<OfflineIndicator variant="minimal" />
```

#### Update Toast

```tsx
import { UpdateToast } from '@/components/pwa';

<UpdateToast checkOnMount={true} />
```

#### Offline Message Composer

Input field that works offline and queues messages:

```tsx
import { OfflineMessageComposer } from '@/components/pwa';

<OfflineMessageComposer
  conversationId={conversationId}
  onSend={async (content) => {
    await sendMessage(content);
  }}
  placeholder="Type a message..."
/>
```

### PWA Provider (Convenience)

Use the PWAProvider to include all PWA UI components at once:

```tsx
import { PWAProvider } from '@/components/pwa';

function App() {
  return (
    <PWAProvider
      showInstallPrompt={true}
      showUpdateToast={true}
      showOfflineIndicator={true}
      installPromptDelay={5000}
    >
      <YourApp />
    </PWAProvider>
  );
}
```

## Configuration

### PWA Config (`src/lib/pwa/pwa-config.ts`)

```typescript
export const PWA_CONFIG = {
  appName: 'RAG Chatbot',
  shortName: 'RAG Chat',
  version: '1.0.0',
  themeColor: '#18181b',
  backgroundColor: '#ffffff',
  display: 'standalone',
  orientation: 'portrait-primary',
  scope: '/',
  startUrl: '/',
};

export const PWA_FEATURES = {
  enableServiceWorker: true,
  enableBackgroundSync: true,
  enablePushNotifications: false,
  enablePeriodicSync: false,
  enableInstallPrompt: true,
  enableUpdateNotifications: true,
};
```

### Service Worker (`public/sw.js`)

The service worker uses multiple caching strategies:

- **Static assets**: Cache First
- **API calls**: Network First with cache fallback
- **Documents**: Stale While Revalidate
- **Images**: Cache First with expiration

Customize the service worker for your specific needs.

## Platform-Specific Features

### iOS Safari

- Shows custom install instructions (Share → Add to Home Screen)
- Supports standalone mode with `apple-mobile-web-app-capable`
- Status bar style customization
- Touch icon support

### Android/Chrome

- Native install prompt via `beforeinstallprompt` event
- Background sync support
- Push notification support (when enabled)
- Trusted Web Activity support

### Desktop

- Chrome/Edge native install
- Standalone window mode
- Shortcut support

## Testing PWA Features

### Chrome DevTools

1. Open DevTools (F12)
2. Go to **Application** tab
3. Check:
   - **Manifest** - Verify manifest is valid
   - **Service Workers** - Check registration and status
   - **Cache Storage** - View cached resources
   - **Background Services** - Test background sync

### Lighthouse Audit

Run Lighthouse in Chrome DevTools:

1. Go to **Lighthouse** tab
2. Select "Progressive Web App" category
3. Click "Generate report"

### Testing Offline

1. Open DevTools
2. Go to **Network** tab
3. Set throttling to "Offline"
4. Test app functionality

## Troubleshooting

### Service Worker Not Registering

- Check browser console for errors
- Verify `sw.js` is accessible at root
- Ensure HTTPS in production (required for SW)

### Icons Not Showing

- Verify icon paths in `manifest.json`
- Check icon sizes match specifications
- Ensure icons are in `public/icons/` directory

### Install Prompt Not Appearing

- Check if already installed (look for standalone mode)
- Clear site data and refresh
- Check browser support for `beforeinstallprompt`

### Offline Page Not Loading

- Verify `/offline` route exists
- Check service worker is caching the offline page
- Test in Incognito mode

## Best Practices

1. **Always provide offline fallback** - Never show a blank screen
2. **Show network status** - Keep users informed
3. **Queue user actions** - Don't lose data when offline
4. **Respect user preferences** - Allow dismissing prompts
5. **Test on real devices** - Emulators may not catch all issues
6. **Monitor performance** - Large caches can slow down updates

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Web App Manifest | ✅ | ✅ | ✅* | ✅ |
| Install Prompt | ✅ | ❌ | ❌ | ✅ |
| Background Sync | ✅ | ⚠️ | ❌ | ✅ |
| Push Notifications | ✅ | ✅ | ✅* | ✅ |

*Limited support or requires specific configurations

## Resources

- [Web App Manifest Spec](https://w3c.github.io/manifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
