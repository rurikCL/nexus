// NÉXUS — service worker: habilita instalación como PWA y notificaciones push.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: 'NÉXUS', body: event.data.text() }; }

  const title = payload.title || 'NÉXUS';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/assets/pwa/icon-192.png',
    badge: payload.badge || '/assets/pwa/icon-192.png',
    tag: payload.tag,
    data: payload.data || {},
    actions: payload.actions || [],
    vibrate: payload.vibrate || [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer click en la notificación, enfoca una pestaña abierta de NÉXUS o abre una nueva en la ruta indicada.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          client.postMessage({ type: 'nx-push-navigate', url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
