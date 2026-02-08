const CACHE_NAME = 'sistema-os-v3';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
];

// DEV MODE GUARD — auto-unregister in development
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', () => {
        self.registration.unregister().then(() => {
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => client.navigate(client.url));
            });
        });
    });
    // Do NOT add fetch listener in dev — let all requests pass through
} else {
    // === PRODUCTION ONLY ===

    // Install — pre-cache shell
    self.addEventListener('install', (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
        );
        self.skipWaiting();
    });

    // Activate — clean old caches
    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches.keys().then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
        );
        self.clients.claim();
    });

    // Fetch strategy
    self.addEventListener('fetch', (event) => {
        const { request } = event;
        const url = new URL(request.url);

        // Skip non-HTTP(S) requests
        if (!url.protocol.startsWith('http')) return;

        // Safety: skip Vite dev paths (extra guard)
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
                            cached || new Response(JSON.stringify({ error: 'Offline' }), {
                                status: 503,
                                headers: { 'Content-Type': 'application/json' },
                            })
                        )
                    )
            );
            return;
        }

        // Static assets — Cache First, fallback to network
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

        // Navigation — Network First, fallback to cached index
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

        // Default — Network only, no cache (avoid undefined responses)
        event.respondWith(
            fetch(request).catch(() =>
                new Response('Offline', { status: 503, statusText: 'Offline' })
            )
        );
    });
}

// Background Sync — queue failed mutations
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-mutations') {
        event.waitUntil(replayMutations());
    }
});

async function replayMutations() {
    // Placeholder for offline mutation queue replay
    // Will read from IndexedDB and replay POST/PUT/DELETE requests
}
