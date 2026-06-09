import { supabase } from '@/lib/supabaseClient';
import { getQueued, removeQueued } from '@/lib/offlineQueue';

let syncing = false;

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

/**
 * Tente d'insérer toutes les opérations en attente dans Supabase.
 * Les éléments insérés avec succès (ou rejetés pour doublon) sont retirés ;
 * les échecs réseau restent en file pour une prochaine tentative.
 */
export async function flushQueue() {
  if (syncing || !isOnline()) return { synced: 0 };
  syncing = true;
  let synced = 0;
  try {
    const items = await getQueued();
    for (const item of items) {
      try {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (!error) {
          await removeQueued(item.id);
          synced++;
        } else if (/duplicate key|already exists|23505/i.test(error.message || error.code || '')) {
          // Déjà inséré (re-synchro) → on retire de la file.
          await removeQueued(item.id);
        }
        // Sinon (erreur réseau/temporaire) : on garde pour réessayer plus tard.
      } catch {
        // Échec réseau → on garde l'élément en file.
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
