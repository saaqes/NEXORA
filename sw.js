/* NEXORA service worker: caché de la app (offline) + notificaciones. NO programa avisos con la app cerrada. */
const V = 'nexora-v1', CORE = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'assets/favicon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== V).map((n) => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
// Punto de extensión para Web Push real (requiere backend; ver docs/NOTIFICACIONES.md)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { /* sin payload */ }
  e.waitUntil(self.registration.showNotification(d.title || 'NEXORA', { body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: d.tag }));
});
