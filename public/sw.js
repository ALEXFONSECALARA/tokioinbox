// TokioInbox PWA — V12: shell offline + Push.
const CACHE = 'tokioinbox-shell-v12';
const SHELL = ['/', '/index.html', '/tokioinbox-mark.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // API is never cached: orders, auth and restaurant data must remain fresh.
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html'))));
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Nova notificação', body: '' };
  try { if (event.data) payload = event.data.json(); }
  catch { payload = { title: 'Nova notificação', body: event.data ? event.data.text() : '' }; }
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    image: payload.image || undefined,
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(payload.title || 'Nova notificação', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  }));
});
