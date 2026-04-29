/**
 * sw.js — ModuHome service worker.
 *
 * Strategy:
 *  - Pre-cache the app shell on install (/, /embed) so the editor opens
 *    offline.
 *  - Cache-first for static assets (JS chunks, CSS, fonts, GLB/HDR/KTX
 *    textures) — these are content-hashed by Next.js, so a stale entry is
 *    never served against newer HTML.
 *  - Network-first for HTML and /api/*.
 *
 * Bumping CACHE_VERSION invalidates everything on next activate. Any time
 * the static asset URL pattern changes, bump the version.
 */

const CACHE_VERSION = 'moduhome-v1';
const SHELL = ['/', '/embed', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).catch(() => {/* offline install best-effort */}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin only — don't intercept third-party (analytics, fonts CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigations + APIs (fresh content first, fallback to cache).
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') ?? '').includes('text/html');
  const isApi = url.pathname.startsWith('/api/');
  if (isHtml || isApi) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Don't cache /api responses — they're dynamic.
          if (isHtml && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((m) => m ?? caches.match('/'))),
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
