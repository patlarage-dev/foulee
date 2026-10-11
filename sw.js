// Bump this version when the offline page or its static assets change.
const CACHE_PREFIX = 'foulee-pwa-';
const CACHE_NAME = CACHE_PREFIX + '2026-10-05-v54';
const OFFLINE_FILES = ['/index.html', '/styles.css', '/app-v2.js', '/exercise-module.js', '/pwa.js', '/manifest.webmanifest', '/offline.html', '/icons/shoe-f.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png', '/icons/favicon.png'];
self.addEventListener('install', event => {
  // Activate only after the complete updated shell has been cached.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
    // This release forces open application windows onto the updated shell.
    const windows = await self.clients.matchAll({type: 'window'});
    await Promise.allSettled(windows.map(client => client.navigate(client.url)));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // API requests and private data always go directly to the Mac.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Serve a coherent installed version; updates replace the whole shell atomically.
  const path = request.mode === 'navigate' ? '/index.html' : url.pathname;
  if (OFFLINE_FILES.includes(path)) {
    event.respondWith((async () => {
      return (await caches.match(path, {cacheName: CACHE_NAME})) || fetch(request);
    })());
  }
});
