/**
 * Service Worker — 快取單頁與靜態資源、CDN 腳本，離線可開啟 index.html
 */
const CACHE = "stitch-pwa-v56";

const APP_ASSETS = [
  "index.html",
  "manifest.json",
  "manifest.webmanifest",
  "sw.js",
  "lottery.js",
  "icon.png",
  "assets/icon.png",
  "assets/stitch-themes.css",
];

/** 發票對獎 JSON（GET 成功後快取，離線可沿用最後一次） */
const LOTTERY_DATA_URL = "https://invoice.98goto.com/api/echo_json";

const CDN_ASSETS = [
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js",
  "https://cdn.tailwindcss.com?plugins=forms,container-queries",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap",
];

function scoped(url) {
  return new URL(url, self.registration.scope).href;
}

function precacheUrls() {
  return [...APP_ASSETS.map((p) => scoped(p)), ...CDN_ASSETS];
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    precacheUrls().map((url) =>
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
            const indexUrl = scoped("index.html");
            const scope = self.registration.scope;
            const fallback =
              (await caches.match(indexUrl)) ||
              (await caches.match(scope)) ||
              (await caches.match(new URL("index.html", scope).href));
            if (fallback) return fallback;
          }
          throw e;
        }
      })()
    );
    return;
  }

  if (url.href === LOTTERY_DATA_URL) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        try {
          const res = await fetch(event.request);
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        } catch (e) {
          if (cached) return cached;
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
