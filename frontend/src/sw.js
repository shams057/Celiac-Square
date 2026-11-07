/* Celiac Square service worker: the app and the ATMC guide keep working without a connection.
 *
 * Built by the `service-worker` plugin in vite.config.js, which replaces the two placeholders below
 * with the build's hash and its list of files. Served at /sw.js (not cached by the browser: vercel.json).
 *
 * - Pages: network first, the cached app when offline (every route is the same index.html).
 * - Built files (/assets/*): cached at install; they are content-hashed, so cache first.
 * - The guide and the map list (/api/atmc/*, /api/map/spots, /api/map/cities): network first,
 *   the last copy when offline. Those copies carry an `X-Offline-Copy` header with their date, so
 *   the page can say "saved copy from …". The guide is downloaded at install, before it is first opened.
 * - Everything else (search, scanner, accounts, admin, other origins) goes to the network only.
 */
const VERSION = '__SW_VERSION__';
const PRECACHE = __SW_PRECACHE__;

const SHELL_CACHE = `cs-shell-${VERSION}`;
const DATA_CACHE = 'cs-data-v1';
const MEDIA_CACHE = 'cs-media-v1';
const NETWORK_TIMEOUT_MS = 6000;

// GET requests whose last answer is kept for offline use
const OFFLINE_DATA = [/^\/api\/atmc\/(products|categories|stats)$/, /^\/api\/map\/(spots|cities)$/];
// Downloaded at install so the guide works offline even if it was never opened
const WARM_DATA = ['/api/atmc/products', '/api/atmc/categories', '/api/atmc/stats'];

const dataKey = (url) => url.pathname + url.search;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(['/', ...PRECACHE]);
      // The guide download is best effort: the API may be unreachable at install time
      const data = await caches.open(DATA_CACHE);
      await Promise.all(
        WARM_DATA.map(async (path) => {
          try {
            const res = await fetch(path, { credentials: 'same-origin' });
            if (res.ok && (res.headers.get('content-type') || '').includes('json')) await data.put(path, stamp(res));
          } catch {
            // offline during install
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('cs-shell-') && n !== SHELL_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

/** A copy of the response with the date it was saved */
const stamp = (res) => {
  const headers = new Headers(res.headers);
  headers.set('X-Saved-At', new Date().toISOString());
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

/** The saved response, marked as an offline copy */
const asOfflineCopy = (res) => {
  const headers = new Headers(res.headers);
  headers.set('X-Offline-Copy', headers.get('X-Saved-At') || 'unknown');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });

async function networkFirstData(request, url) {
  const cache = await caches.open(DATA_CACHE);
  const key = dataKey(url);
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    // Only real JSON answers replace the saved copy (a host error page must not)
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) await cache.put(key, stamp(res.clone()));
    // Server or gateway down (5xx), or a host page instead of JSON: the saved copy is better than an error
    if (res.status >= 500 || (res.ok && !(res.headers.get('content-type') || '').includes('json'))) {
      const saved = await cache.match(key);
      if (saved) return asOfflineCopy(saved);
    }
    return res;
  } catch (err) {
    const saved = await cache.match(key);
    if (saved) return asOfflineCopy(saved);
    throw err;
  }
}

async function networkFirstPage(request) {
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (res.ok) (await caches.open(SHELL_CACHE)).put('/', res.clone());
    return res;
  } catch (err) {
    const shell = await caches.match('/');
    if (shell) return shell;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') return event.respondWith(networkFirstPage(request));
    if (OFFLINE_DATA.some((re) => re.test(url.pathname))) return event.respondWith(networkFirstData(request, url));
    if (url.pathname.startsWith('/api/')) return undefined;
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) return event.respondWith(cacheFirst(request, SHELL_CACHE));
    // Spot photos (not the videos, which are large and streamed with range requests)
    if (url.pathname.startsWith('/spots/') && /\.(webp|jpe?g|png)$/i.test(url.pathname)) return event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return undefined;
  }
  // Other origins (fonts, map tiles) are left to the browser: the worker's CSP (connect-src) would block
  // its own fetches to them. Offline, text falls back to the system font.
  return undefined;
});
