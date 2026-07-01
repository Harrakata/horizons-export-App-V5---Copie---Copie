// ════════════════════════════════════════════════════════════════════════════
//  Notifications LOCALES (API Notifications navigateur/OS) — sans serveur ni VAPID.
//
//  S'affichent quand l'application est ouverte (onglet ou PWA en cours). Pour les
//  alertes « app totalement fermée », il faut le vrai Web Push (cf. pushNotifications.js).
//  On réutilise le service worker (registration.showNotification) pour bénéficier du
//  handler `notificationclick` (public/push-sw.js) — sinon repli sur new Notification().
// ════════════════════════════════════════════════════════════════════════════

const FLAG = 'local_notif_enabled';

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
export const notifyLocal = async (title, { body = '', url = '/', tag } = {}) => {
  if (getNotifPermission() !== 'granted') return false;
  const options = { body, tag, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', data: { url } };
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
