import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cache mémoire global (partagé entre toutes les instances du hook).
 * { [key]: { data, ts } }
 */
const _cache = new Map();

/**
 * Auto-fetch + cache + revalidation quand l'utilisateur revient sur l'onglet.
 *
 * @param {string}   key       Clé unique du cache (ex: 'agences-list')
 * @param {Function} fetcher   Fonction async qui renvoie les données
 * @param {object}   options
 * @param {number}   options.ttlMs           Durée du cache (défaut 30s)
 * @param {boolean}  options.revalidateOnFocus Revalider quand l'onglet redevient actif
 * @param {boolean}  options.enabled         Désactiver l'auto-fetch
 *
 * @returns { data, error, isLoading, isValidating, refetch, mutate }
 *
 * @example
 * const { data: agences, isLoading, refetch } = useSupabaseCache(
 *   'agences-list',
 *   async () => {
 *     const { data, error } = await supabase.from('agences').select('*');
 *     if (error) throw error;
 *     return data;
 *   },
 *   { ttlMs: 60_000 }
 * );
 */
export function useSupabaseCache(key, fetcher, options = {}) {
  const {
    ttlMs              = 30_000,
    revalidateOnFocus  = true,
    enabled            = true,
  } = options;

  const cached = _cache.get(key);
  const isFresh = cached && (Date.now() - cached.ts < ttlMs);

  const [data, setData]                 = useState(cached?.data ?? null);
  const [error, setError]               = useState(null);
  const [isLoading, setIsLoading]       = useState(!cached);
  const [isValidating, setIsValidating] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (background = false) => {
    if (background) setIsValidating(true); else setIsLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      _cache.set(key, { data: result, ts: Date.now() });
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [key]);

  // Premier fetch (ou revalidation silencieuse si cache stale)
  useEffect(() => {
    if (!enabled) return;
    if (!cached)        run(false);                  // jamais récupéré
    else if (!isFresh)  run(true);                   // stale → revalidate en arrière-plan
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revalidation quand l'utilisateur revient sur l'onglet
  useEffect(() => {
    if (!enabled || !revalidateOnFocus) return;
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        const c = _cache.get(key);
        if (!c || Date.now() - c.ts >= ttlMs) run(true);
      }
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, revalidateOnFocus, key, ttlMs, run]);

  /** Force un refetch (skip le cache) */
  const refetch = useCallback(() => run(false), [run]);

  /** Met à jour le cache localement (sans refetch) */
  const mutate = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _cache.set(key, { data: next, ts: Date.now() });
      return next;
    });
  }, [key]);

  return { data, error, isLoading, isValidating, refetch, mutate };
}

/** Invalide une entrée du cache (la prochaine lecture refetchera) */
export function invalidateCache(key) {
  _cache.delete(key);
}

/** Invalide toutes les clés qui matchent un préfixe */
export function invalidateCachePrefix(prefix) {
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

/** Vide tout le cache (utile au logout) */
export function clearCache() {
  _cache.clear();
}
