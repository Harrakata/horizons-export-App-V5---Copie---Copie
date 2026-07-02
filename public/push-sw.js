/* eslint-disable no-restricted-globals */
// ════════════════════════════════════════════════════════════════════════════
//  Handlers Web Push, importés dans le service worker généré par Workbox
//  (cf. vite.config.js → workbox.importScripts). Affiche la notification reçue
//  et gère le clic (focus / ouverture de l'URL cible / ouverture de la cloche).
// ════════════════════════════════════════════════════════════════════════════

// Version du handler — vérifiable depuis la page (message 'get-push-sw-version').
self.__PUSH_SW_VERSION = 'v5';

// Répond à la page qui demande la version active (diagnostic « quel SW tourne »).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'get-push-sw-version') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ version: self.__PUSH_SW_VERSION });
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Notification', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || undefined,
    // ⚠ On propage url ET openBell (sinon le clic d'une notif PUSH perd le contexte
    //    et retombe sur l'accueil).
    data: { url: data.url || null, openBell: !!data.openBell },
    requireInteraction: !!data.requireInteraction,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url;
  const openBell = !!data.openBell;         // message → ouvrir la cloche
  const hasTarget = url && url !== '/';
  // URL d'ouverture quand aucune fenêtre n'est ouverte : cible précise, ou racine
  // d'espace + marqueur pour ouvrir la cloche, sinon accueil.
  const openUrl = openBell ? `${url || '/'}?openNotifs=1` : (hasTarget ? url : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (openBell && 'postMessage' in client) {
            // App déjà ouverte → on demande d'ouvrir la cloche là où on est.
            client.postMessage({ type: 'open-notifications' });
          } else if (hasTarget && 'navigate' in client) {
            try {
              const current = new URL(client.url).pathname;
              if (current !== url) client.navigate(url).catch(() => {});
            } catch (e) { client.navigate(url).catch(() => {}); }
          }
          return undefined;
        }
      }
      // Aucune fenêtre ouverte.
      if (self.clients.openWindow) return self.clients.openWindow(openUrl);
      return undefined;
    })
  );
});
