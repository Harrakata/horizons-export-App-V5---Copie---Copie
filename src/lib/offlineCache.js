// Helpers de lecture résiliente au réseau.
//
// `cachedQuery` exécute une requête de lecture Supabase et :
//  - en ligne et OK  → met le résultat en cache (IndexedDB) puis le renvoie ;
//  - en ligne mais en échec réseau, OU hors-ligne → renvoie le dernier instantané
//    mis en cache au lieu de remonter une erreur bloquante.
//
// C'est ce qui permet aux écrans (borne pointage, maintenance, paiement) de
// continuer à afficher leurs données de référence quand la connexion tombe.

import { getCache, putCache } from '@/lib/offlineQueue';

/** Vrai si le navigateur se déclare en ligne (signal best-effort). */
export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

/**
 * Exécute une requête de lecture avec repli sur le cache.
 *
 * @param {string} key        clé de cache stable (inclure les paramètres : agence, date…).
 * @param {() => PromiseLike<{data:any, error:any}>} queryFn  renvoie un builder Supabase (thenable).
 * @returns {Promise<{data:any, error:any, fromCache:boolean, ts:number|null}>}
 */
// PGRST116 = « aucune/0+ ligne » renvoyé par .single() : c'est un résultat vide
// légitime (pas une panne réseau), on le traite comme un succès à mettre en cache.
const isEmptyResult = (error) => error?.code === 'PGRST116';

export async function cachedQuery(key, queryFn) {
  if (isOnline()) {
    try {
      const res = await queryFn();
      if (!res.error || isEmptyResult(res.error)) {
        // On ne met en cache que les lectures réussies (data peut être [] ou null).
        const data = res.error ? (res.data ?? null) : res.data;
        await putCache(key, data);
        return { data, error: null, fromCache: false, ts: Date.now() };
      }
      // Erreur applicative (ex. RLS) : on tente quand même un repli sur le cache.
      const cached = await getCache(key);
      if (cached) return { data: cached.data, error: null, fromCache: true, ts: cached.ts };
      return { data: res.data ?? null, error: res.error, fromCache: false, ts: null };
    } catch (err) {
      // Échec réseau (fetch a levé) alors que navigator.onLine était vrai : repli cache.
      const cached = await getCache(key);
      if (cached) return { data: cached.data, error: null, fromCache: true, ts: cached.ts };
      return { data: null, error: err, fromCache: false, ts: null };
    }
  }

  // Hors-ligne : on sert directement le cache.
  const cached = await getCache(key);
  if (cached) return { data: cached.data, error: null, fromCache: true, ts: cached.ts };
  return { data: null, error: new Error('offline-no-cache'), fromCache: true, ts: null };
}
