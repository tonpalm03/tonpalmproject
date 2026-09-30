const CACHE_NAME = 'huaychan-v6';

// Clean old caches and claim clients immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Message listener for skipWaiting and clearCache
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING') || (event.data && event.data.action === 'skipWaiting')) {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE' || (event.data && event.data.type === 'CLEAR_CACHE') || (event.data && event.data.action === 'clearCache')) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip firestore / googleapis / firebase / analytics / chrome-extension
  if (
    url.origin.includes('firestore') ||
    url.origin.includes('googleapis') ||
    url.origin.includes('firebase') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // A) For HTML page requests (navigation) and main entry: ALWAYS fetch from network with no-store
  const isHtml =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isHtml) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // B) For Images, Logos, Icons, Manifest: ALWAYS fetch from network
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|json)$/i)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // C) For Next.js hashed immutable static assets (/_next/static/**)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // D) Default fallback: Network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ==========================================
// 🔔 Web Push & System Notification Handlers
// ==========================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🔔 มีออเดอร์ใหม่!', body: event.data.text() };
    }
  }

  const title = data.title || '🔔 มีออเดอร์ใหม่เข้ามา!';
  const options = {
    body: data.body || 'มีลูกค้าสั่งอาหารใหม่ กรุณาเปิดเพื่อดูและรับออเดอร์',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || ('order-' + Date.now()),
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 400],
    data: data.url || '/'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (urlToOpen && client.navigate) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
