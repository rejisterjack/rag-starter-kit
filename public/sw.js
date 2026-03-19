/**
 * Service Worker for RAG Starter Kit PWA
 * Provides offline support, caching, and background sync
 */

const CACHE_NAME = 'rag-starter-kit-v1';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache First for static assets
  static: async (request) => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      // Refresh cache in background
      fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      }).catch(() => {});
      return cached;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  },
  
  // Network First for API calls
  api: async (request) => {
    const cache = await caches.open(API_CACHE);
    
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      throw error;
    }
  },
  
  // Stale While Revalidate for dynamic content
  dynamic: async (request) => {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);
    
    const networkPromise = fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => cached);
    
    return cached || networkPromise;
  },
  
  // Network Only for mutations
  network: (request) => fetch(request),
};

// Determine strategy based on request
function getStrategy(request) {
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return 'network';
  }
  
  // API calls
  if (url.pathname.startsWith('/api/')) {
    // Read operations can be cached
    if (['GET', 'HEAD'].includes(request.method)) {
      return 'api';
    }
    return 'network';
  }
  
  // Static assets
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf)$/) ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    return 'static';
  }
  
  // Next.js build files
  if (url.pathname.includes('/_next/')) {
    return 'static';
  }
  
  // Everything else
  return 'dynamic';
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_NAME) && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const strategy = getStrategy(request);
  
  event.respondWith(
    CACHE_STRATEGIES[strategy](request)
      .catch((error) => {
        console.error('[SW] Fetch failed:', error);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/offline');
        }
        
        throw error;
      })
  );
});

// Background Sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  const db = await openDB('rag-offline-db', 1);
  const messages = await db.getAll('pending-messages');
  
  for (const message of messages) {
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      });
      
      await db.delete('pending-messages', message.id);
    } catch (error) {
      console.error('[SW] Failed to sync message:', error);
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'RAG Starter Kit',
      options
    )
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const notificationData = event.notification.data;
  const urlToOpen = notificationData?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handling from client
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_NAME });
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((names) => 
          Promise.all(names.map((name) => caches.delete(name)))
        )
      );
      break;
  }
});

// Helper for IndexedDB (simplified version)
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve({
      getAll: (store) => new Promise((res, rej) => {
        const tx = request.result.transaction(store, 'readonly');
        const st = tx.objectStore(store);
        const getAll = st.getAll();
        getAll.onsuccess = () => res(getAll.result);
        getAll.onerror = () => rej(getAll.error);
      }),
      delete: (store, key) => new Promise((res, rej) => {
        const tx = request.result.transaction(store, 'readwrite');
        const st = tx.objectStore(store);
        const del = st.delete(key);
        del.onsuccess = () => res();
        del.onerror = () => rej(del.error);
      }),
    });
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id' });
      }
    };
  });
}

console.log('[SW] Service Worker loaded');
