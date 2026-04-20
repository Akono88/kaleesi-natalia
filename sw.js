/* ═══════════════════════════════════════
   Kaleesi Natalia — Service Worker
   Background Push + Offline Cache
   BUILD: 2026-04-19-v4
   ═══════════════════════════════════════ */

var SW_VERSION = '2026-04-19-v4';
var CACHE_NAME = 'kaleesi-v' + SW_VERSION;
var PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './kaleesi.png'
];

self.addEventListener('install', function(e) {
    console.log('[SW] Installing v' + SW_VERSION);
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(PRECACHE_URLS).catch(function(err) {
                console.warn('[SW] Precache partial fail:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    console.log('[SW] Activating v' + SW_VERSION);
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.map(function(name) {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch: network-first for HTML (fresh content), cache-first for static assets
self.addEventListener('fetch', function(e) {
    var url = new URL(e.request.url);
    // Skip Supabase, analytics, and non-GET
    if (e.request.method !== 'GET') return;
    if (url.hostname.includes('supabase')) return;
    if (url.hostname.includes('cdn.jsdelivr') || url.hostname.includes('cdnjs') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
        // Cache-first for CDN fonts/libs
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                return cached || fetch(e.request).then(function(resp) {
                    if (resp && resp.status === 200) {
                        var copy = resp.clone();
                        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, copy); });
                    }
                    return resp;
                }).catch(function() { return cached; });
            })
        );
        return;
    }

    // For the app itself: network-first with cache fallback
    if (url.origin === self.location.origin) {
        e.respondWith(
            fetch(e.request).then(function(resp) {
                if (resp && resp.status === 200) {
                    var copy = resp.clone();
                    caches.open(CACHE_NAME).then(function(c) { c.put(e.request, copy); });
                }
                return resp;
            }).catch(function() {
                return caches.match(e.request).then(function(cached) {
                    return cached || caches.match('./index.html');
                });
            })
        );
    }
});

self.addEventListener('push', function(e) {
    var title = 'Kaleesi Natalia';
    var body = 'Something happened!';
    var tag = 'kn-push-' + Date.now();

    if (e.data) {
        try {
            var data = e.data.json();
            title = data.title || title;
            body = data.body || body;
            tag = data.tag || tag;
        } catch(err) {
            body = e.data.text() || body;
        }
    }

    e.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            tag: tag
        })
    );
});

self.addEventListener('notificationclick', function(e) {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
            for (var i = 0; i < clients.length; i++) {
                if ('focus' in clients[i]) return clients[i].focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('/kaleesi-natalia/');
        })
    );
});
