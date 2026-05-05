/**
 * Service Worker with resilient Workbox loading
 *
 * If Workbox CDN is unreachable, the SW still installs successfully
 * and provides basic fetch handling without caching strategies.
 */

const CACHE_PREFIX = 'rag-pwa';
const CACHE_VERSION = 'v4';

const CACHE_NAMES = {
  PRECACHE: `${CACHE_PREFIX}-precache-${CACHE_VERSION}`,
  STATIC: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  IMAGES: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  PAGES: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
  FONTS: `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`,
};

const OFFLINE_PAGE = '/offline';

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

// ─── Try loading Workbox ──────────────────────────────────────────────────────

let workboxLoaded = false;

try {
  importScripts(
    'https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js'
  );
  workboxLoaded = typeof workbox !== 'undefined';
} catch {
  // Workbox CDN unavailable — fall through to basic fetch handler
}

if (workboxLoaded) {
  const { precaching, routing, strategies, expiration, cacheableResponse, backgroundSync } =
    workbox;

  // ─── Precache App Shell ───────────────────────────────────────────────────────

  precaching.precacheAndRoute([
    { url: '/offline', revision: '4' },
    { url: '/manifest.json', revision: '4' },
  ]);

  // ─── Navigation Routes ────────────────────────────────────────────────────────

  const navigationHandler = new strategies.NetworkFirst({
    cacheName: CACHE_NAMES.PAGES,
    networkTimeoutSeconds: 3,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60,
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

  // ─── Stale-While-Revalidate: JS & CSS ─────────────────────────────────────────

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
          maxAgeSeconds: 365 * 24 * 60 * 60,
        }),
      ],
    })
  );

  // ─── Next.js static chunks ────────────────────────────────────────────────────

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
          maxAgeSeconds: 30 * 24 * 60 * 60,
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
          maxAgeSeconds: 365 * 24 * 60 * 60,
        }),
      ],
    })
  );

  // ─── Google Fonts ─────────────────────────────────────────────────────────────

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

  // ─── Network-Only: Health check ───────────────────────────────────────────────

  routing.registerRoute(
    ({ url }) => url.pathname === '/api/health',
    new strategies.NetworkOnly()
  );

  // ─── Network-First: API Routes ────────────────────────────────────────────────

  routing.registerRoute(
    ({ url }) =>
      url.origin === self.location.origin &&
      url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/api/auth/'),
    new strategies.NetworkFirst({
      cacheName: CACHE_NAMES.API,
      networkTimeoutSeconds: 3,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
          headers: {
            'X-Is-Cacheable': 'true',
          },
        }),
        new expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    })
  );

  // ─── Background Sync: API Mutations ───────────────────────────────────────────

  const apiMutationSync = new backgroundSync.BackgroundSyncPlugin(
    'api-mutations',
    {
      maxRetentionTime: 24 * 60,
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

  ['POST', 'PUT', 'PATCH', 'DELETE'].forEach((method) => {
    routing.registerRoute(
      ({ url, request }) =>
        url.origin === self.location.origin &&
        url.pathname.startsWith('/api/') &&
        request.method === method,
      new strategies.NetworkOnly({
        plugins: [apiMutationSync],
      }),
      method
    );
  });

  // ─── Background Sync: Chat Messages ──────────────────────────────────────────

  const chatMessageSync = new backgroundSync.BackgroundSyncPlugin(
    'chat-messages',
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

} else {
  // ─── Fallback: Basic pass-through without Workbox ─────────────────────────────

  self.addEventListener('fetch', (event) => {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE) || new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response('', { status: 503 });
      })
    );
  });
}

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
      const existingClient = clients.find((client) =>
        client.url.includes(self.location.origin)
      );

      if (existingClient) {
        existingClient.focus();
        existingClient.navigate(urlToOpen);
        return existingClient;
      }

      return self.clients.openWindow(urlToOpen);
    })
  );
});

// ─── Utilities ─────────────────────────────────────────────────────────────────

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

// ─── Error Reporting ──────────────────────────────────────────────────────────

self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled rejection:', event.reason);
});
