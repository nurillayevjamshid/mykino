const VERSION = "v20260602-playgap01";
const STATIC_CACHE = `kp-static-${VERSION}`;
const RUNTIME_CACHE = `kp-runtime-${VERSION}`;
const API_CACHE = `kp-api-${VERSION}`;

const STATIC_ASSETS = [
  "/static/styles.css",
  "/static/app.js",
  "/static/assets/splash.jpg",
  "/static/assets/kino-play-logo.png",
  "/static/assets/my-kino-logo.png",
];

// Faqat shu API yo'llari stale-while-revalidate keshlanadi.
// /api/stream, /api/video-stream va boshqalar keshlanmaydi.
const SWR_API_PATHS = ["/api/movies", "/api/settings", "/api/categories"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("kp-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== API_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/static/");
}

function isImage(request) {
  return request.destination === "image";
}

function isSwrApi(url) {
  return SWR_API_PATHS.some((p) => url.pathname === p);
}

function isStreamingApi(url) {
  return url.pathname.startsWith("/api/stream")
    || url.pathname.startsWith("/api/video-stream")
    || url.pathname.startsWith("/api/drive-stream");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Streaming endpointlarni hech qachon ushlamaslik.
  if (sameOrigin && isStreamingApi(url)) return;

  // SWR keshlanadigan API'lar (movies/settings/categories).
  if (sameOrigin && isSwrApi(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      const cached = await cache.match(req, { ignoreSearch: false });
      const networkPromise = fetch(req).then((fresh) => {
        if (fresh && fresh.ok) {
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      }).catch(() => null);

      if (cached) {
        // Foydalanuvchi keshni darrov ko'radi, fon yangilanadi.
        networkPromise.catch(() => {});
        return cached;
      }
      const fresh = await networkPromise;
      if (fresh) return fresh;
      // Tarmoq ham yo'q, kesh ham yo'q — xato.
      return new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    })());
    return;
  }

  // Boshqa API'lar — keshsiz, tarmoqdan.
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // Cross-origin: faqat rasm keshlash.
  if (!sameOrigin && !isImage(req)) return;

  if (isStaticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req, { ignoreSearch: false });
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const fallback = await cache.match(req, { ignoreSearch: true });
        if (fallback) return fallback;
        throw err;
      }
    })());
    return;
  }

  if (isImage(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })());
  }
});
