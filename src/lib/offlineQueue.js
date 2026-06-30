// Couche de stockage hors-ligne (IndexedDB).
//
// Deux object stores dans une même base :
//  - `queue` : opérations d'écriture effectuées hors-ligne, rejouées à la reconnexion.
//              Chaque élément : { id, op, type, table, payload, match, createdAt }.
//              op = 'insert' (défaut) | 'update'.
//  - `cache` : instantanés de lecture (clé → données) pour faire fonctionner les
//              écrans en lecture quand le réseau est indisponible.
//              Chaque élément : { key, data, ts }.

// Clé maîtresse de la fonctionnalité « Usage hors-ligne » (Profil et Fonctionnalité).
export const OFFLINE_FEATURE_KEY = 'offline_mode';

// Clés granulaires par écran : l'usage hors-ligne peut être activé globalement
// puis affiné écran par écran. Un écran est hors-ligne SSI la clé maîtresse est
// activée ET sa clé d'écran n'est pas explicitement désactivée.
export const OFFLINE_SCREEN_FEATURE_KEYS = {
  pointage: 'offline_mode_pointage',
  maintenance: 'offline_mode_maintenance',
  paiementGrosGain: 'offline_mode_paiement_gros_gain',
};

/**
 * Indique si l'usage hors-ligne est actif pour un écran donné.
 * @param {Object|undefined} functionalities  objet `app_settings.value` (functionalites_espaces).
 * @param {'pointage'|'maintenance'|'paiementGrosGain'} screen
 */
export const isOfflineEnabledForScreen = (functionalities, screen) => {
  if (functionalities?.[OFFLINE_FEATURE_KEY] !== true) return false;
  const childKey = OFFLINE_SCREEN_FEATURE_KEYS[screen];
  if (!childKey) return false;
  return functionalities?.[childKey] !== false;
};

const DB_NAME = 'star3000-offline';
const QUEUE_STORE = 'queue';
const CACHE_STORE = 'cache';
const VERSION = 2;
const listeners = new Set();

let dbPromise = null;

/** Ouvre (et met à niveau) la base partagée. Mémoïsé pour éviter les ré-ouvertures. */
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

const reqToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const txDone = (t) => new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Horodatage strictement croissant : garantit l'ordre de rejeu (ex. l'insert d'une
// demande avant l'upload différé de sa photo), même si plusieurs enqueues tombent
// dans la même milliseconde.
let _lastTs = 0;
const nextTs = () => { const t = Math.max(Date.now(), _lastTs + 1); _lastTs = t; return t; };

const notifyChange = () => { listeners.forEach((l) => { try { l(); } catch { /* noop */ } }); };

/** Abonnement aux changements de la file (renvoie une fonction de désabonnement). */
export const subscribeQueue = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

// ──────────────────────────────────────────────────────────────────────────
// File d'écriture
// ──────────────────────────────────────────────────────────────────────────

/**
 * Ajoute une opération d'écriture à la file hors-ligne.
 * @param {Object} p
 * @param {string} p.type      libellé fonctionnel (pointage, maintenance, …) — pour l'UI.
 * @param {string} [p.table]   table Supabase cible (insert/update, ou maj post-upload).
 * @param {Object} [p.payload] données à insérer ou colonnes à mettre à jour.
 * @param {'insert'|'update'|'upload'} [p.op='insert']
 * @param {Object} [p.match]   pour op='update'/'upload' : critères d'égalité ({ col: valeur }).
 * @param {Object} [p.upload]  pour op='upload' : { bucket, path, fileBase64, contentType, urlField }.
 *                             Après upload, la colonne `urlField` de la ligne `match` reçoit l'URL publique.
 */
export async function enqueueOffline({ type, table = null, payload = null, op = 'insert', match = null, upload = null }) {
  const db = await openDB();
  const rec = { id: newId(), op, type, table, payload, match, upload, createdAt: nextTs(), retries: 0, lastError: null };
  const t = db.transaction(QUEUE_STORE, 'readwrite');
  t.objectStore(QUEUE_STORE).put(rec);
  await txDone(t);
  notifyChange();
  return rec;
}

/** Met à jour partiellement un item de file (ex. compteur de tentatives / dernière erreur). */
export async function updateQueued(id, patch) {
  try {
    const db = await openDB();
    const t = db.transaction(QUEUE_STORE, 'readwrite');
    const store = t.objectStore(QUEUE_STORE);
    const existing = await reqToPromise(store.get(id));
    if (existing) store.put({ ...existing, ...patch });
    await txDone(t);
    notifyChange();
  } catch {
    /* best-effort */
  }
}

export async function getQueued() {
  try {
    const db = await openDB();
    const t = db.transaction(QUEUE_STORE, 'readonly');
    const all = await reqToPromise(t.objectStore(QUEUE_STORE).getAll());
    return (all || []).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function removeQueued(id) {
  const db = await openDB();
  const t = db.transaction(QUEUE_STORE, 'readwrite');
  t.objectStore(QUEUE_STORE).delete(id);
  await txDone(t);
  notifyChange();
}

export async function countQueued() {
  try {
    const db = await openDB();
    const t = db.transaction(QUEUE_STORE, 'readonly');
    return await reqToPromise(t.objectStore(QUEUE_STORE).count());
  } catch {
    return 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cache de lecture
// ──────────────────────────────────────────────────────────────────────────

/** Écrit (ou remplace) un instantané de lecture sous `key`. */
export async function putCache(key, data) {
  try {
    const db = await openDB();
    const t = db.transaction(CACHE_STORE, 'readwrite');
    t.objectStore(CACHE_STORE).put({ key, data, ts: Date.now() });
    await txDone(t);
  } catch { /* le cache est best-effort */ }
}

/** Lit un instantané de lecture. Renvoie { data, ts } ou null. */
export async function getCache(key) {
  try {
    const db = await openDB();
    const t = db.transaction(CACHE_STORE, 'readonly');
    const rec = await reqToPromise(t.objectStore(CACHE_STORE).get(key));
    return rec ? { data: rec.data, ts: rec.ts } : null;
  } catch {
    return null;
  }
}
