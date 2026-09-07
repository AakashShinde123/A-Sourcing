/*
 * EasySourcing Field PWA — minimal, safe service worker.
 *
 * Strategy:
 *  - App shell + icons: precached at install.
 *  - Navigations (HTML): network-first, fall back to cached shell when offline
 *    (the app itself renders the offline-friendly login/home screens).
 *  - Static assets (/_next/static, /icons, fonts): cache-first (immutable).
 *  - API calls (/api/*): ALWAYS network, never cached — verification data must
 *    be live; the app queues user-facing errors itself.
 */
const VERSION = 'es-field-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never touch POST /verify, auth, etc.

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through
  if (url.pathname.startsWith('/api/')) return; // live data only, no SW cache

  // Immutable static assets: cache-first
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navigations & everything else: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.mode === 'navigate') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy)); // keep shell fresh
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('/') : undefined))
      )
  );
});
