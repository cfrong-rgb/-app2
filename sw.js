/* Stitch 私人帳本 — PWA Service Worker（離線殼層 + 執行時快取 CDN） */
const CACHE = "stitch-pwa-v4";

const CDN_ASSETS = [
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js",
  "https://cdn.tailwindcss.com?plugins=forms,container-queries",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap",
];

function scopeUrls() {
  const scope = self.registration.scope;
  return [
    scope,
    new URL("index.html", scope).href,
    new URL("manifest.webmanifest", scope).href,
    new URL("icon.png", scope).href,
    new URL("assets/icon.png", scope).href,
    new URL("sw.js", scope).href,
  ];
}

async function precache() {
  const cache = await caches.open(CACHE);
  const urls = [...scopeUrls(), ...CDN_ASSETS];
  await Promise.all(
    urls.map((url) =>
      cache.add(url).catch(() => {
        /* 單一資源失敗不阻擋安裝 */
      })
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("stitch-pwa-") && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isNavigateRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        } catch (e) {
          if (isNavigateRequest(event.request)) {
            const scope = self.registration.scope;
            const indexUrl = new URL("index.html", scope).href;
            const fallback =
              (await caches.match(indexUrl)) ||
              (await caches.match(scope)) ||
              (await caches.match("/index.html"));
            if (fallback) return fallback;
          }
          throw e;
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      } catch (e) {
        const offline = await caches.match(event.request);
        if (offline) return offline;
        throw e;
      }
    })()
  );
});
