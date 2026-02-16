/**
 * Kalibrium — Service Worker (PWA Offline)
 * 
 * Estratégias:
 * - Shell (HTML/CSS/JS): Cache-first, atualiza em background
 * - API Reads (GET): Network-first com fallback para cache
 * - API Writes (POST/PUT/DELETE): Queue offline, sync quando online
 * - Fotos/Uploads: IndexedDB queue, upload em background
 */

const CACHE_NAME = 'kalibrium-v1';
const API_CACHE = 'kalibrium-api-v1';

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// URLs de API que devem ser cacheadas para uso offline do técnico
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/me$/,
  /\/api\/v1\/work-orders/,
  /\/api\/v1\/equipments/,
  /\/api\/v1\/standard-weights/,
  /\/api\/v1\/customers/,
  /\/api\/v1\/checklists/,
  /\/api\/v1\/services/,
  /\/api\/v1\/products/,
];

// ─── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_URLS).catch(() => {
        // Silently fail for optional shell URLs
        console.log('[SW] Some shell URLs failed to cache, continuing...');
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-GET requests for caching (writes go to sync queue)
  if (event.request.method !== 'GET') {
    // Para writes offline: interceptar e adicionar à fila
    if (!navigator.onLine && isApiRequest(url)) {
      event.respondWith(handleOfflineWrite(event.request));
      return;
    }
    return;
  }

  // API requests: Network-first com fallback
  if (isApiRequest(url) && isCacheableApi(url)) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // Shell/assets: Cache-first com atualização em background
  if (isShellRequest(url)) {
    event.respondWith(cacheFirstWithRefresh(event.request));
    return;
  }
});

// ─── SYNC (Background Sync) ──────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Kalibrium', body: 'Nova notificação', url: '/' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    data.body = event.data?.text() || data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Dispensar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ─── MESSAGE (comunicação com o app) ─────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_API_DATA') {
    // Pre-cache dados do técnico quando conectado
    const urls = event.data.urls || [];
    caches.open(API_CACHE).then((cache) => {
      urls.forEach((url) => {
        fetch(url, { headers: event.data.headers || {} })
          .then((response) => {
            if (response.ok) cache.put(url, response);
          })
          .catch(() => {});
      });
    });
  }

  if (event.data?.type === 'GET_SYNC_STATUS') {
    getOfflineQueueCount().then((count) => {
      event.ports[0]?.postMessage({ pendingCount: count });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isCacheableApi(url) {
  return CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function isShellRequest(url) {
  return url.origin === self.location.origin && !isApiRequest(url);
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ error: 'offline', message: 'Sem conexão. Dados em cache não disponíveis.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || (await networkFetch) || new Response('Offline', { status: 503 });
}

async function handleOfflineWrite(request) {
  try {
    const body = await request.clone().text();
    await addToOfflineQueue({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    // Register background sync
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-offline-queue');
    }

    return new Response(JSON.stringify({
      message: 'Salvo offline. Será sincronizado quando a conexão for restabelecida.',
      offline: true,
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Falha ao salvar offline' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── IndexedDB para fila offline ─────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('kalibrium-offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToOfflineQueue(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync-queue', 'readwrite');
    tx.objectStore('sync-queue').add(data);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getOfflineQueueCount() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('sync-queue', 'readonly');
      const req = tx.objectStore('sync-queue').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function processOfflineQueue() {
  const db = await openDB();
  const tx = db.transaction('sync-queue', 'readonly');
  const store = tx.objectStore('sync-queue');

  const items = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok || response.status < 500) {
        // Remove da fila
        const delTx = db.transaction('sync-queue', 'readwrite');
        delTx.objectStore('sync-queue').delete(item.id);
      }
    } catch (err) {
      // Mantém na fila para próxima tentativa
      console.log('[SW] Sync failed for item', item.id, err);
    }
  }

  // Notifica o app
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE', remaining: items.length });
  });
}
