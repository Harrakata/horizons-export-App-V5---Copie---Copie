// ════════════════════════════════════════════════════════════════════════════
//  Notifications LOCALES (API Notifications navigateur/OS) — sans serveur ni VAPID.
//
//  S'affichent quand l'application est ouverte (onglet ou PWA en cours). Pour les
//  alertes « app totalement fermée », il faut le vrai Web Push (cf. pushNotifications.js).
//  On réutilise le service worker (registration.showNotification) pour bénéficier du
//  handler `notificationclick` (public/push-sw.js) — sinon repli sur new Notification().
// ════════════════════════════════════════════════════════════════════════════

const FLAG = 'local_notif_enabled';

/** Version du service worker push actif (diagnostic). null si indéterminable. */
export const getSwVersion = () => new Promise((resolve) => {
  try {
    const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!ctrl) return resolve(null);
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1000);
    ch.port1.onmessage = (e) => { clearTimeout(timer); resolve((e.data && e.data.version) || null); };
    ctrl.postMessage({ type: 'get-push-sw-version' }, [ch.port2]);
  } catch { resolve(null); }
});

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export const getNotifPermission = () =>
  notificationsSupported() ? Notification.permission : 'unsupported';

export const requestNotifPermission = async () => {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
};

export const setLocalNotifEnabled = (on) => {
  try { localStorage.setItem(FLAG, on ? '1' : '0'); } catch { /* ignore */ }
};

/** Activé = l'utilisateur a opté ET la permission est accordée. */
export const isLocalNotifEnabled = () => {
  try { return localStorage.getItem(FLAG) === '1' && getNotifPermission() === 'granted'; }
  catch { return false; }
};

/** Affiche une notification OS (via le SW s'il est déjà enregistré, sinon API directe). */
export const notifyLocal = async (title, { body = '', url = null, tag, openBell = false } = {}) => {
  if (getNotifPermission() !== 'granted') return false;
  // url null → au clic, on reste sur la page courante (pas de renvoi à l'accueil).
  // openBell → au clic, ouvre la cloche (message sans page dédiée).
  const options = { body, tag, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', data: { url: url || null, openBell } };
  // On utilise getRegistration() (résolution immédiate) et NON .ready (qui peut
  // ne jamais se résoudre s'il n'y a pas de SW actif → notification jamais affichée).
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification(title, options); return true; }
    }
  } catch { /* repli ci-dessous */ }
  // Repli : Notification directe (fonctionne sur desktop ; sur mobile, le SW est requis).
  try { new Notification(title, options); return true; } catch { return false; }
};
