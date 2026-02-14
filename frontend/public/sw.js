const CACHE_NAME = 'kalibrium-v4';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
];

// ─── IndexedDB helpers (duplicated here because SW can't import modules) ───

function openMutationDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('kalibrium-offline', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllMutationsFromDb() {
    const db = await openMutationDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('mutation-queue', 'readonly');
        const store = tx.objectStore('mutation-queue');
        const index = store.index('by-created');
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function deleteMutationFromDb(id) {
    const db = await openMutationDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('mutation-queue', 'readwrite');
        const store = tx.objectStore('mutation-queue');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function updateMutationRetry(id, retries, error) {
    const db = await openMutationDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('mutation-queue', 'readwrite');
        const store = tx.objectStore('mutation-queue');
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const mutation = getReq.result;
            if (mutation) {
                mutation.retries = retries;
                mutation.last_error = error;
                store.put(mutation);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

// ─── DEV MODE GUARD ─────────────────────────────────────────

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', () => {
        self.registration.unregister().then(() => {
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => client.navigate(client.url));
            });
        });
    });
} else {
    // === PRODUCTION ONLY ===

    // ─── Install — pre-cache shell ──────────────────────────

    self.addEventListener('install', (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
        );
        self.skipWaiting();
    });

    // ─── Activate — clean old caches ────────────────────────

    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches.keys().then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
        );
        self.clients.claim();
    });

    // ─── Fetch strategy ─────────────────────────────────────

    self.addEventListener('fetch', (event) => {
        const { request } = event;
        const url = new URL(request.url);

        if (!url.protocol.startsWith('http')) return;

        // Skip dev paths
        if (
            url.pathname.startsWith('/@') ||
            url.pathname.startsWith('/src/') ||
            url.pathname.includes('__vite') ||
            url.pathname.startsWith('/node_modules/')
        ) return;

        // API calls — Network First, fallback to cache
        if (url.pathname.startsWith('/api/')) {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        if (request.method === 'GET' && response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(() =>
                        caches.match(request).then((cached) =>
                            cached || new Response(JSON.stringify({ error: 'Offline', message: 'Sem conexão' }), {
                                status: 503,
                                headers: { 'Content-Type': 'application/json' },
                            })
                        )
                    )
            );
            return;
        }

        // Static assets — Cache First
        if (
            url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
            url.pathname.startsWith('/icons/')
        ) {
            event.respondWith(
                caches.match(request).then((cached) =>
                    cached ||
                    fetch(request).then((response) => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return response;
                    }).catch(() =>
                        new Response('', { status: 503, statusText: 'Offline' })
                    )
                )
            );
            return;
        }

        // Navigation — Network First, shell fallback
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request).catch(() =>
                    caches.match('/').then((cached) =>
                        cached || new Response('Offline', { status: 503 })
                    )
                )
            );
            return;
        }

        // Default — Network only
        event.respondWith(
            fetch(request).catch(() =>
                new Response('Offline', { status: 503, statusText: 'Offline' })
            )
        );
    });
}

// ─── Background Sync — replay offline mutations ─────────────

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-mutations') {
        event.waitUntil(replayMutations());
    }
});

// ─── Message handler — force sync from app ──────────────────

self.addEventListener('message', (event) => {
    if (event.data?.type === 'FORCE_SYNC') {
        replayMutations().then((result) => {
            notifyClients({ type: 'SYNC_COMPLETE', ...result });
        }).catch((err) => {
            notifyClients({ type: 'SYNC_ERROR', error: err.message });
        });
    }

    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ─── Replay mutation queue ──────────────────────────────────

const MAX_RETRIES = 5;

async function replayMutations() {
    let processed = 0;
    let failed = 0;
    const errors = [];

    try {
        const mutations = await getAllMutationsFromDb();

        for (const mutation of mutations) {
            if (mutation.retries >= MAX_RETRIES) {
                errors.push({ id: mutation.id, error: `Max retries (${MAX_RETRIES}) exceeded` });
                failed++;
                continue;
            }

            try {
                const token = await getAuthToken();
                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(mutation.headers || {}),
                };

                const fetchOpts = {
                    method: mutation.method,
                    headers,
                };

                if (mutation.body && mutation.method !== 'DELETE') {
                    fetchOpts.body = JSON.stringify(mutation.body);
                }

                const response = await fetch(mutation.url, fetchOpts);

                if (response.ok || response.status === 409) {
                    // Success or conflict (already applied) — remove from queue
                    await deleteMutationFromDb(mutation.id);
                    processed++;
                } else if (response.status === 422) {
                    // Validation error — remove (won't succeed on retry)
                    errors.push({ id: mutation.id, error: `Validation: ${response.statusText}` });
                    await deleteMutationFromDb(mutation.id);
                    failed++;
                } else {
                    // Transient error — retry later
                    await updateMutationRetry(mutation.id, mutation.retries + 1, response.statusText);
                    failed++;
                }
            } catch (networkErr) {
                // Network still down — stop trying
                await updateMutationRetry(mutation.id, mutation.retries + 1, networkErr.message);
                break;
            }
        }
    } catch (dbErr) {
        console.error('[SW] Failed to read mutation queue:', dbErr);
    }

    return { processed, failed, errors };
}

// ─── Helpers ────────────────────────────────────────────────

async function getAuthToken() {
    try {
        // Read from localStorage (persisted by zustand auth-store)
        const authData = await readFromLocalStorage('auth-store');
        if (authData?.state?.token) return authData.state.token;
    } catch {
        // Fallback: read raw localStorage
    }

    try {
        return self.__auth_token || null;
    } catch {
        return null;
    }
}

function readFromLocalStorage(key) {
    // SW can't access localStorage directly — try reading from clients
    return self.clients.matchAll().then((clients) => {
        if (clients.length === 0) return null;
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => resolve(event.data);
            clients[0].postMessage({ type: 'GET_LOCAL_STORAGE', key }, [channel.port2]);
            setTimeout(() => resolve(null), 1000);
        });
    });
}

async function notifyClients(message) {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => client.postMessage(message));
}

// ─── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = {
            title: 'Kalibrium',
            body: event.data.text(),
        };
    }

    const title = payload.title || 'Kalibrium';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: payload.data || {},
        actions: payload.actions || [],
        tag: payload.tag || 'kalibrium-notification',
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});

