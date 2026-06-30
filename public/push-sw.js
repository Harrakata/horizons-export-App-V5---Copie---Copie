/* eslint-disable no-restricted-globals */
// ════════════════════════════════════════════════════════════════════════════
//  Handlers Web Push, importés dans le service worker généré par Workbox
//  (cf. vite.config.js → workbox.importScripts). Affiche la notification reçue
//  et gère le clic (focus / ouverture de l'URL cible).
// ════════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Notification', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
    requireInteraction: !!data.requireInteraction,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && url) client.navigate(url).catch(() => {});
          return undefined;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
