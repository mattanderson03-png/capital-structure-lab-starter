// sw.js: the service worker. It lets the app install and work offline.
// Network first: every visit tries GitHub Pages for the newest files, so each
// merged change shows up. If the network fails (offline), it uses the saved copy.
const CACHE = 'age-capstruct-v1';

// Everything the app needs to run offline. Relative paths, because the site
// lives at https://<username>.github.io/<repository>/, not at a domain's root.
const FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'capstruct.js',
  'manifest.webmanifest',
  'data/cdss.csv',
  'data/assumptions.csv',
  'data/banker_schedule.csv',
  'data/example_firms.csv',
  'data/ebit_scenarios.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  // Remove caches from older versions of this app.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Only handle this site's own GET requests.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
