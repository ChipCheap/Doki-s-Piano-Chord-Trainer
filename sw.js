const CACHE = 'piano-chord-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Trebleclef.png',
  '/Bassclef.png',
  '/Doublesharp.png',
  '/Doubleb.png',
  '/Sharp.png',
  '/B.png',
  'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Playfair+Display:wght@400;700&family=Source+Code+Pro:wght@400;600&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
