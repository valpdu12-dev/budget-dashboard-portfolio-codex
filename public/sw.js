// Service worker de la démonstration statique.
const CACHE_NAME = "budget-dashboard-portfolio-codex-v1";
const APP_ROOT = new URL("./", self.registration.scope).href;
const PRECACHE_URLS = [
  "./",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./data/transactions.json",
  "./data/salary.json",
  "./data/config.json",
  "./data/budgets.json",
  "./modeles/Budget_v1.xlsx",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.includes("/assets/") || url.pathname.includes("/icons/") || url.pathname.includes("/modeles/") || url.pathname.endsWith("/favicon.svg")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.includes("/data/") || request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
      ?? (await cache.match(APP_ROOT))
      ?? new Response("Hors ligne", { status: 503 });
  }
}
