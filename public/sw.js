// Service worker: abre o app sem internet, guarda os posts do último acesso e mostra as notificações.
const VERSION = "armetec-posts-v1";
const SHELL = ["/", "/index.html", "/style.css", "/app.js", "/slides.js", "/fonts/inter.woff2", "/fonts/plus-jakarta-bold.ttf", "/fonts/plus-jakarta-extra-bold.ttf",
  "/fonts/manrope-extra-bold.ttf", "/fonts/nasalization-rg.otf", "/manifest.webmanifest", "/favicon.png", "/icons/logo.png", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  // Da API só os posts são guardados (para abrir sem internet). Login e o resto vão direto pra rede.
  if (url.pathname.startsWith("/api/") && url.pathname !== "/api/banco") return;
  if (url.pathname.startsWith("/media/")) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      else if (res.status === 401) caches.open(VERSION).then((c) => c.delete(req));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("/index.html") : Response.error())))
  );
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Armetec Posts", {
    body: d.body || "Hora de postar.", tag: d.tag || "armetec-post", renotify: true,
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "/", location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(location.origin)) return c.focus();
    return self.clients.openWindow(target);
  }));
});
