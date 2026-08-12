const SHELL_CACHE = "foodsick-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/og.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const sensitivePath = ["/report", "/my-reports", "/admin", "/api"].some((prefix) => url.pathname.startsWith(prefix));
  if (event.request.method !== "GET" || sensitivePath || event.request.mode === "navigate") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
