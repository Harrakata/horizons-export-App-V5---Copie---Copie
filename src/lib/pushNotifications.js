import { supabase } from '@/lib/supabaseClient';

// ════════════════════════════════════════════════════════════════════════════
//  Notifications push (Web Push) — abonnement côté client.
//
//  Prérequis : VITE_VAPID_PUBLIC_KEY (clé publique VAPID du déploiement) + service
//  worker avec handlers push (public/push-sw.js, importé par Workbox) + Edge
//  Function `send-push` (envoi). Table : push_subscriptions.
// ════════════════════════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const TABLE = 'push_subscriptions';

/** Le navigateur supporte-t-il le push ? */
export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** Push configuré sur ce déploiement (clé VAPID présente) ? */
export const isPushConfigured = () => !!VAPID_PUBLIC_KEY;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const getRegistration = async () => {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.ready;
};

/** Permission de notification courante : 'granted' | 'denied' | 'default' | 'unsupported'. */
export const getPushPermission = () => (isPushSupported() ? Notification.permission : 'unsupported');

/** Y a-t-il déjà un abonnement actif sur cet appareil ? */
export const hasPushSubscription = async () => {
  try {
    const reg = await getRegistration();
    if (!reg) return false;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
};

const saveSubscription = async (subscription, reader = {}) => {
  const json = subscription.toJSON();
  const row = {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    user_id: reader.id != null ? String(reader.id) : null,
    role: reader.role || null,
    agence_nom: reader.agence || null,
    region: reader.region || null,
    user_nom: reader.nom || null,
    updated_at: new Date().toISOString(),
  };
  await supabase.from(TABLE).upsert(row, { onConflict: 'endpoint' });
};

/**
 * Active le push sur cet appareil : demande la permission, s'abonne, enregistre.
 * @returns { ok, reason? }
 */
export const subscribeToPush = async (reader = {}) => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'not-configured' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission };
    const reg = await getRegistration();
    if (!reg) return { ok: false, reason: 'no-sw' };
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(subscription, reader);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
};

/** Désactive le push sur cet appareil (désabonnement + suppression serveur). */
export const unsubscribeFromPush = async () => {
  try {
    const reg = await getRegistration();
    const subscription = reg && (await reg.pushManager.getSubscription());
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase.from(TABLE).delete().eq('endpoint', endpoint);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
};

/**
 * Déclenche l'envoi d'une notification push ciblée via l'Edge Function `send-push`.
 * @param target { role?, agence_nom?, user_id? } — filtre des abonnés
 * @param payload { title, body, url?, tag? }
 */
export const triggerPush = async (target, payload) => {
  try {
    await supabase.functions.invoke('send-push', { body: { target, payload } });
  } catch {
    /* best-effort : ne bloque jamais le flux applicatif */
  }
};
