// File d'attente locale (IndexedDB) pour les opérations effectuées hors-ligne.
// Chaque élément : { id, type, table, payload, createdAt }.

// Clé de la fonctionnalité « Usage hors-ligne » (activable dans Profil et Fonctionnalité).
export const OFFLINE_FEATURE_KEY = 'offline_mode';

const DB_NAME = 'star3000-offline';
const STORE = 'queue';
const VERSION = 1;
const listeners = new Set();

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const reqToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const notifyChange = () => { listeners.forEach((l) => { try { l(); } catch { /* noop */ } }); };

/** Abonnement aux changements de la file (renvoie une fonction de désabonnement). */
export const subscribeQueue = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

export async function enqueueOffline({ type, table, payload }) {
  const db = await openDB();
  const rec = { id: newId(), type, table, payload, createdAt: Date.now() };
  const t = db.transaction(STORE, 'readwrite');
  t.objectStore(STORE).put(rec);
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  notifyChange();
  return rec;
}

export async function getQueued() {
  try {
    const db = await openDB();
    const t = db.transaction(STORE, 'readonly');
    const all = await reqToPromise(t.objectStore(STORE).getAll());
    return (all || []).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function removeQueued(id) {
  const db = await openDB();
  const t = db.transaction(STORE, 'readwrite');
  t.objectStore(STORE).delete(id);
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  notifyChange();
}

export async function countQueued() {
  try {
    const db = await openDB();
    const t = db.transaction(STORE, 'readonly');
    return await reqToPromise(t.objectStore(STORE).count());
  } catch {
    return 0;
  }
}
