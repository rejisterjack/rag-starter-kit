/**
 * Production-grade Service Worker using Workbox strategies
 * Provides advanced caching, background sync, and offline-first capabilities.
 *
 * Caching Strategies:
 * - Stale-While-Revalidate: JS/CSS assets (fast first paint, background refresh)
 * - Cache-First: Static media, fonts, icons (long-lived resources)
 * - Network-First: API responses (freshness preferred with cache fallback)
 * - Precache: App shell and critical resources
 *
 * @see https://developer.chrome.com/docs/workbox/
 */

// ─── Workbox CDN Import ───────────────────────────────────────────────────────
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js'
);

const { precaching, routing, strategies, expiration, cacheableResponse, backgroundSync } =
  workbox;

// ─── Configuration ────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'rag-pwa';
const CACHE_VERSION = 'v3';

const CACHE_NAMES = {
  PRECACHE: `${CACHE_PREFIX}-precache-${CACHE_VERSION}`,
  STATIC: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  IMAGES: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  PAGES: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
  FONTS: `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`,
};

const SYNC_QUEUES = {
  API_MUTATIONS: 'api-mutations',
  CHAT_MESSAGES: 'chat-messages',
};

const OFFLINE_PAGE = '/offline';
const NETWORK_TIMEOUT_MS = 3000;

// ─── Skip Waiting & Claim Clients ─────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanOldCaches(),
    ])
  );
});

async function cleanOldCaches() {
  const cacheNames = await caches.keys();
  const validCaches = new Set(Object.values(CACHE_NAMES));
  return Promise.all(
    cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && !validCaches.has(name))
      .map((name) => caches.delete(name))
  );
}

// ─── Precache App Shell ───────────────────────────────────────────────────────

precaching.precacheAndRoute([
  { url: '/offline', revision: '3' },
  { url: '/manifest.json', revision: '3' },
]);

// ─── Navigation Routes (Network-First with offline fallback) ──────────────────

const navigationHandler = new strategies.NetworkFirst({
  cacheName: CACHE_NAMES.PAGES,
  networkTimeoutSeconds: NETWORK_TIMEOUT_MS / 1000,
  plugins: [
    new cacheableResponse.CacheableResponsePlugin({
      statuses: [0, 200],
    }),
    new expiration.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    }),
  ],
});

routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (args) => {
    try {
      return await navigationHandler.handle(args);
    } catch {
      const cache = await caches.open(CACHE_NAMES.PRECACHE);
      const cachedResponse = await cache.match('/offline');
      return cachedResponse || new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }
);

// ─── Stale-While-Revalidate: JS & CSS Assets ─────────────────────────────────

routing.registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' || request.destination === 'style'),
  new strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAMES.STATIC,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year (versioned assets)
      }),
    ],
  })
);

// ─── Stale-While-Revalidate: Next.js chunks ──────────────────────────────────

routing.registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/_next/static/'),
  new strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAMES.STATIC,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

// ─── Cache-First: Images ──────────────────────────────────────────────────────

routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new strategies.CacheFirst({
    cacheName: CACHE_NAMES.IMAGES,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ─── Cache-First: Fonts ───────────────────────────────────────────────────────

routing.registerRoute(
  ({ request }) => request.destination === 'font',
  new strategies.CacheFirst({
    cacheName: CACHE_NAMES.FONTS,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);

// ─── Cache-First: Google Fonts ────────────────────────────────────────────────

routing.registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new strategies.CacheFirst({
    cacheName: CACHE_NAMES.FONTS,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

// ─── Network-First: API Routes ────────────────────────────────────────────────

// Health check endpoint (used by connectivity monitor)
routing.registerRoute(
  ({ url }) => url.pathname === '/api/health',
  new strategies.NetworkOnly()
);

// API data routes - Network-First for freshness, cache fallback
routing.registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/'),
  new strategies.NetworkFirst({
    cacheName: CACHE_NAMES.API,
    networkTimeoutSeconds: NETWORK_TIMEOUT_MS / 1000,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
        headers: {
          'X-Is-Cacheable': 'true', // Only cache responses that opt-in
        },
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

// ─── Fallback API handler for GET requests without cache header ───────────────

routing.registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    request.method === 'GET' &&
    !url.pathname.startsWith('/api/auth/') &&
    !url.pathname.startsWith('/api/health'),
  new strategies.NetworkFirst({
    cacheName: CACHE_NAMES.API,
    networkTimeoutSeconds: NETWORK_TIMEOUT_MS / 1000,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60, // 1 hour for uncategorized
      }),
    ],
  })
);

// ─── Background Sync: API Mutations ───────────────────────────────────────────

const apiMutationSync = new backgroundSync.BackgroundSyncPlugin(
  SYNC_QUEUES.API_MUTATIONS,
  {
    maxRetentionTime: 24 * 60, // 24 hours in minutes
    onSync: async ({ queue }) => {
      let entry;
      while ((entry = await queue.shiftRequest())) {
        try {
          await fetch(entry.request.clone());
          broadcastMessage({
            type: 'SYNC_COMPLETE',
            payload: { url: entry.request.url },
          });
        } catch (error) {
          await queue.unshiftRequest(entry);
          throw error;
        }
      }
    },
  }
);

// Register background sync for POST/PUT/PATCH/DELETE to API
routing.registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    request.method !== 'GET' &&
    request.method !== 'HEAD',
  new strategies.NetworkOnly({
    plugins: [apiMutationSync],
  }),
  'POST'
);

routing.registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    request.method !== 'GET' &&
    request.method !== 'HEAD',
  new strategies.NetworkOnly({
    plugins: [apiMutationSync],
  }),
  'PUT'
);

routing.registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    request.method !== 'GET' &&
    request.method !== 'HEAD',
  new strategies.NetworkOnly({
    plugins: [apiMutationSync],
  }),
  'PATCH'
);

routing.registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    request.method !== 'GET' &&
    request.method !== 'HEAD',
  new strategies.NetworkOnly({
    plugins: [apiMutationSync],
  }),
  'DELETE'
);

// ─── Background Sync: Chat Messages ──────────────────────────────────────────

const chatMessageSync = new backgroundSync.BackgroundSyncPlugin(
  SYNC_QUEUES.CHAT_MESSAGES,
  {
    maxRetentionTime: 24 * 60,
    onSync: async ({ queue }) => {
      let entry;
      while ((entry = await queue.shiftRequest())) {
        try {
          await fetch(entry.request.clone());
          broadcastMessage({
            type: 'CHAT_SYNC_COMPLETE',
            payload: { url: entry.request.url },
          });
        } catch (error) {
          await queue.unshiftRequest(entry);
          throw error;
        }
      }
    },
  }
);

routing.registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname === '/api/chat' &&
    request.method === 'POST',
  new strategies.NetworkOnly({
    plugins: [chatMessageSync],
  }),
  'POST'
);

// ─── Message Handler ──────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      if (payload?.urls) {
        event.waitUntil(cacheUrls(payload.urls, payload.cacheName));
      }
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(payload?.cacheName));
      break;

    case 'GET_CACHE_STATS':
      event.waitUntil(
        getCacheStats().then((stats) => {
          event.source?.postMessage({
            type: 'CACHE_STATS',
            payload: stats,
          });
        })
      );
      break;

    case 'PROCESS_SYNC_QUEUE':
      // Trigger manual sync processing
      event.waitUntil(processSyncQueues());
      break;
  }
});

// ─── Push Notification Handler ────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'RAG Starter Kit';
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'default',
      data: data.data || {},
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Invalid push data
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      const existingClient = clients.find((client) =>
        client.url.includes(self.location.origin)
      );

      if (existingClient) {
        existingClient.focus();
        existingClient.navigate(urlToOpen);
        return existingClient;
      }

      // Open new tab
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// ─── Periodic Background Sync ─────────────────────────────────────────────────

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(periodicContentSync());
  }
});

async function periodicContentSync() {
  try {
    // Prefetch important data in background
    const cacheName = CACHE_NAMES.API;
    const cache = await caches.open(cacheName);

    const urlsToRefresh = ['/api/conversations'];

    await Promise.allSettled(
      urlsToRefresh.map(async (url) => {
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'X-Background-Sync': 'true' },
        });
        if (response.ok) {
          await cache.put(url, response);
        }
      })
    );
  } catch {
    // Background sync failure is non-critical
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function broadcastMessage(message) {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    for (const client of clients) {
      client.postMessage(message);
    }
  });
}

async function cacheUrls(urls, cacheName = CACHE_NAMES.STATIC) {
  const cache = await caches.open(cacheName);
  await cache.addAll(urls);
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .map((key) => caches.delete(key))
    );
  }
}

async function getCacheStats() {
  const stats = {};
  const cacheKeys = await caches.keys();

  for (const key of cacheKeys) {
    if (key.startsWith(CACHE_PREFIX)) {
      const cache = await caches.open(key);
      const keys = await cache.keys();
      stats[key] = {
        entries: keys.length,
      };
    }
  }

  return stats;
}

async function processSyncQueues() {
  // Trigger background sync events
  try {
    await self.registration.sync.register(SYNC_QUEUES.API_MUTATIONS);
    await self.registration.sync.register(SYNC_QUEUES.CHAT_MESSAGES);
  } catch {
    // Background sync not available
  }
}

// ─── Error Reporting ──────────────────────────────────────────────────────────

self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled rejection:', event.reason);
});
