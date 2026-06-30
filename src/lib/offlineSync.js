import { supabase } from '@/lib/supabaseClient';
import { getQueued, removeQueued, updateQueued } from '@/lib/offlineQueue';

let syncing = false;

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

const isDuplicateError = (error) =>
  /duplicate key|already exists|23505/i.test(`${error?.message || ''} ${error?.code || ''}`);

const isAlreadyExistsError = (error) =>
  /exists|duplicate|409/i.test(`${error?.message || ''} ${error?.statusCode || ''}`);

/** Convertit une data URL base64 (ex. "data:image/png;base64,AAAA") en octets. */
const dataUrlToBytes = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',').pop() || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Rejoue un upload storage différé : envoie le fichier puis renseigne l'URL publique
 * sur la ligne ciblée (ex. photoPieceUrl de la demande, retrouvée par codeDemande).
 */
async function replayUpload(item) {
  const u = item.upload || {};
  if (!u.bucket || !u.path || !u.fileBase64) return { ok: false, drop: true }; // élément invalide

  const bytes = dataUrlToBytes(u.fileBase64);
  const { error: upErr } = await supabase.storage.from(u.bucket).upload(u.path, bytes, {
    contentType: u.contentType || 'application/octet-stream',
    cacheControl: '3600',
    upsert: true,
  });
  if (upErr && !isAlreadyExistsError(upErr)) return { ok: false, drop: false };

  const { data: pub } = supabase.storage.from(u.bucket).getPublicUrl(u.path);
  const url = pub?.publicUrl || null;

  // Renseigner l'URL sur la ligne cible. Si la ligne n'existe pas encore (l'insert
  // de la demande n'est pas encore synchronisé), on garde l'élément pour réessayer.
  if (item.table && item.match && u.urlField) {
    const { data, error: updErr } = await supabase
      .from(item.table)
      .update({ [u.urlField]: url })
      .match(item.match)
      .select('id');
    if (updErr) return { ok: false, drop: false };
    if (!data || data.length === 0) return { ok: false, drop: false };
  }
  return { ok: true, drop: true };
}

/**
 * Rejoue une opération de la file vers Supabase.
 * Renvoie { ok, drop } : ok = synchronisé, drop = à retirer même sans succès
 * (ex. doublon déjà inséré). Une erreur réseau laisse l'élément en file.
 */
async function replayItem(item) {
  if (item.op === 'upload') {
    return replayUpload(item);
  }

  if (item.op === 'update') {
    const { error } = await supabase.from(item.table).update(item.payload).match(item.match || {});
    if (!error) return { ok: true, drop: true };
    return { ok: false, drop: false };
  }

  // insert (défaut). Si `item.event` est présent, on journalise un événement d'audit
  // référençant l'ID serveur de la ligne insérée (connu seulement après l'insert).
  if (item.event) {
    const idField = item.event.idSelect || 'id';
    const { data, error } = await supabase.from(item.table).insert(item.payload).select(idField).single();
    if (error) {
      // Déjà inséré (re-synchro) → on retire sans dupliquer l'événement d'audit.
      if (isDuplicateError(error)) return { ok: false, drop: true };
      return { ok: false, drop: false };
    }
    const insertedId = data?.[idField];
    if (insertedId != null && item.event.table) {
      // L'audit est best-effort : son échec ne doit pas faire revivre l'insert (déjà fait).
      try {
        await supabase.from(item.event.table).insert({
          ...item.event.payload,
          [item.event.demandeIdField || 'demandeId']: insertedId,
        });
      } catch { /* audit non bloquant */ }
    }
    return { ok: true, drop: true };
  }

  const { error } = await supabase.from(item.table).insert(item.payload);
  if (!error) return { ok: true, drop: true };
  if (isDuplicateError(error)) return { ok: false, drop: true }; // déjà inséré → on retire
  return { ok: false, drop: false };
}

/**
 * Tente de rejouer toutes les opérations en attente dans Supabase.
 * Les échecs réseau restent en file pour une prochaine tentative.
 */
export async function flushQueue() {
  if (syncing || !isOnline()) return { synced: 0 };
  syncing = true;
  let synced = 0;
  try {
    const items = await getQueued();
    for (const item of items) {
      try {
        const { ok, drop } = await replayItem(item);
        if (ok) synced++;
        if (drop) await removeQueued(item.id);
        else if (!ok) await updateQueued(item.id, { retries: (item.retries || 0) + 1, lastError: 'Rejeu non confirmé' });
      } catch (e) {
        // Échec (réseau / serveur) → on garde l'élément en file et on trace l'erreur.
        await updateQueued(item.id, { retries: (item.retries || 0) + 1, lastError: String(e?.message || e).slice(0, 300) });
      }
    }
  } finally {
    syncing = false;
  }
  if (synced > 0) {
    try {
      window.dispatchEvent(new CustomEvent('offline-queue-synced', { detail: { synced } }));
    } catch { /* noop */ }
  }
  return { synced };
}

/** Initialise la synchro automatique (au retour en ligne + au démarrage). */
export function initOfflineSync() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => { flushQueue(); });
  // Tente une synchro au démarrage si déjà en ligne.
  if (isOnline()) {
    setTimeout(() => { flushQueue(); }, 1500);
  }
}
