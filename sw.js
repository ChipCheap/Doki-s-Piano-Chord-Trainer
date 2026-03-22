const CACHE = 'piano-chord-v2';
const BASE  = '/Doki-s-Piano-Chord-Trainer';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/style.css',
  BASE + '/music.js',
  BASE + '/rendering.js',
  BASE + '/audio.js',
  BASE + '/settings.js',
  BASE + '/midi.js',
  BASE + '/practice.js',
  BASE + '/ui.js',
  BASE + '/manifest.json',
  BASE + '/Trebleclef.png',
  BASE + '/Bassclef.png',
  BASE + '/Doublesharp.png',
  BASE + '/Doubleb.png',
  BASE + '/Sharp.png',
  BASE + '/B.png',
  BASE + '/Doki_chords_192.png',
  BASE + '/Doki_chords_512.png',
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
