const CACHE = 'piano-chord-v3';

// Paths are relative to this worker's own scope. Absolute '/repo-name/...'
// paths only resolved on GitHub Pages — anywhere else (localhost, a fork under
// a different name) they 404, and because cache.addAll is all-or-nothing a
// single 404 failed the install and the worker never activated at all.
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './music.js',
  './rendering.js',
  './audio.js',
  './settings.js',
  './midi.js',
  './practice.js',
  './ui.js',
  './manifest.json',
  './Trebleclef.png',
  './Bassclef.png',
  './Doublesharp.png',
  './Doubleb.png',
  './Sharp.png',
  './B.png',
  './Doki_chords_192.png',
  './Doki_chords_512.png'
];

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Playfair+Display:wght@400;700&family=Source+Code+Pro:wght@400;600&display=swap';

const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

function cachePut(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(request, copy));
  }
  return response;
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // The font stylesheet is added separately and allowed to fail: a network
      // hiccup on a third-party asset shouldn't take the whole install down.
      .then(cache => cache.addAll(ASSETS).then(() => cache.add(FONT_CSS).catch(() => {})))
      .then(() => self.skipWaiting())
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
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_ORIGINS.includes(url.origin);
  if (!sameOrigin && !isFont) return;

  // The page itself is network-first, so a new build is picked up on the next
  // online visit instead of being pinned until CACHE is renamed by hand.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => cachePut(req, res))
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Fonts never change under a given URL — serve them from cache outright.
  if (isFont) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => cachePut(req, res)))
    );
    return;
  }

  // Everything else is stale-while-revalidate: instant from cache, refreshed in
  // the background so the next load has the new version.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => cachePut(req, res)).catch(() => cached);
      return cached || network;
    })
  );
});
