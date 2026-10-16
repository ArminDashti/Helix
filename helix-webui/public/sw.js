// Helix service worker. The Vite build and dev server (vite.config.js) fill in
// the placeholders. /api is never cached; in dev, app code is never cached (HMR).
const CACHE = "helix-__BUILD_ID__";
const DEV = __DEV__;
const PRECACHE = __PRECACHE_URLS__;
const BASE = new URL("./", self.location).href;
const BASE_PATH = new URL(BASE).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, BASE))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE_PATH) || url.pathname.startsWith(`${BASE_PATH}api/`)) return;

  // Pages: network first so updates show; cached shell when offline (any route).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !DEV) caches.open(CACHE).then((cache) => cache.put(BASE, response.clone()));
          return response;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  // Dev: let Vite serve modules so hot reload keeps working.
  if (DEV) return;

  // Build assets are content-hashed: cache first, then network and store.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
