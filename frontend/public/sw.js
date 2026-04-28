// public/sw.js
// ─────────────────────────────────────────────────────────────────────────────
//  Band Planner Service Worker
//
//  Strategies:
//    • App shell (HTML, CSS, JS, fonts) → Cache First
//    • API calls (/gigs, /tours, etc.)  → Network First, fall back to cache
//    • Images / icons                   → Stale While Revalidate
//    • Push notifications               → handled here
//    • Background sync                  → queues failed API writes (RSVP, comment)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION  = 'v1';
const SHELL_CACHE    = `bp-shell-${CACHE_VERSION}`;
const API_CACHE      = `bp-api-${CACHE_VERSION}`;
const IMAGE_CACHE    = `bp-img-${CACHE_VERSION}`;
const SYNC_QUEUE_KEY = 'bp-sync-queue';

// Files that form the app shell — cached on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// API paths to cache for offline reading
const CACHEABLE_API = [
  '/gigs',
  '/venues',
  '/tours',
  '/analytics/summary',
  '/analytics/heatmap',
];

// ── Install: cache the app shell ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting(); // Activate immediately, don't wait for old SW to expire
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const CURRENT_CACHES = [SHELL_CACHE, API_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim(); // Take control of all open tabs immediately
});

// ── Fetch: route requests to the right strategy ──────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // 1. App shell — Cache First
  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 2. API calls — Network First with offline fallback
  if (url.pathname.startsWith('/api/') || isCacheableApiPath(url.pathname)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // 3. Icons and images — Stale While Revalidate
  if (url.pathname.startsWith('/icons/') || url.pathname.match(/\.(png|jpg|svg|webp)$/)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 4. Navigation requests (page loads) — return app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r || caches.match('/offline.html'))
      )
    );
    return;
  }
});

// ── Cache strategies ─────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || fetchPromise;
}

function isCacheableApiPath(pathname) {
  return CACHEABLE_API.some((p) => pathname.startsWith(p));
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Band Planner', body: event.data.text() };
  }

  const {
    title   = 'Band Planner',
    body    = '',
    icon    = '/icons/icon-192.png',
    badge   = '/icons/icon-96.png',
    tag     = 'bp-notification',
    url     = '/gigs',
    actions = [],
    data: notifData = {},
  } = data;

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { url, ...notifData },
    actions,
    vibrate: [100, 50, 100],          // Buzz pattern on Android
    renotify: true,                   // Vibrate even if same tag
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click — open or focus the app at the right URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/gigs';

  // Handle action buttons (e.g. "RSVP Yes" / "View Gig")
  if (event.action === 'rsvp_yes') {
    const gigId = event.notification.data?.gigId;
    if (gigId) {
      event.waitUntil(
        fetch(`/gigs/${gigId}/rsvp`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvp: 'yes' }),
        })
      );
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
// Retries queued writes (RSVP, comment) when connectivity is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'bp-sync-writes') {
    event.waitUntil(flushSyncQueue());
  }
});

async function flushSyncQueue() {
  // Read queued requests from IndexedDB (written by the app when offline)
  const queue = await getFromIDB(SYNC_QUEUE_KEY) || [];
  const remaining = [];

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method:  item.method,
        headers: item.headers,
        body:    item.body,
      });
      if (!response.ok) remaining.push(item);
    } catch {
      remaining.push(item); // Still offline, keep in queue
    }
  }

  await setInIDB(SYNC_QUEUE_KEY, remaining);

  // Notify open clients that sync completed
  const allClients = await clients.matchAll({ type: 'window' });
  allClients.forEach((client) =>
    client.postMessage({ type: 'SYNC_COMPLETE', synced: queue.length - remaining.length })
  );
}

// ── Minimal IndexedDB helpers for sync queue ──────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('band-planner-sw', 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore('kv');
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getFromIDB(key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function setInIDB(key, value) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
