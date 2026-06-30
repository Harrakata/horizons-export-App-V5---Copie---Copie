import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Cloud } from 'lucide-react';
import { countQueued, subscribeQueue, OFFLINE_FEATURE_KEY } from '@/lib/offlineQueue';
import { flushQueue } from '@/lib/offlineSync';
import { cachedQuery } from '@/lib/offlineCache';
import { supabase } from '@/lib/supabaseClient';
import { APP_SPACE_SETTINGS_KEY } from '@/lib/exploitationProfiles';

/**
 * Indicateur de synchronisation hors-ligne.
 * - Affiche « Hors ligne » quand pas de connexion.
 * - Affiche le nombre d'opérations en attente + un bouton pour synchroniser.
 * - Masqué quand on est en ligne et qu'il n'y a rien en attente.
 */
const OfflineSyncIndicator = () => {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [offlineEnabled, setOfflineEnabled] = useState(false);

  useEffect(() => {
    // Mis en cache : le badge « Hors ligne » doit pouvoir s'afficher… hors-ligne.
    cachedQuery(
      'offline-indicator:space-settings',
      () => supabase.from('app_settings').select('value').eq('key', APP_SPACE_SETTINGS_KEY).maybeSingle(),
    )
      .then(({ data }) => setOfflineEnabled(data?.value?.[OFFLINE_FEATURE_KEY] === true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => countQueued().then((c) => { if (active) setCount(c); }).catch(() => {});
    refresh();
    const unsub = subscribeQueue(refresh);
    const onOnline = () => { setOnline(true); flushQueue().finally(refresh); };
    const onOffline = () => setOnline(false);
    const onSynced = () => refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('offline-queue-synced', onSynced);
    const interval = setInterval(refresh, 8000);
    return () => {
      active = false;
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('offline-queue-synced', onSynced);
      clearInterval(interval);
    };
  }, []);

  // Badge « Hors ligne » seulement si la fonctionnalité est activée.
  const showOfflineBadge = !online && offlineEnabled;
  // Rien à montrer si en ligne sans file, ou hors-ligne avec la fonctionnalité désactivée et file vide.
  if (!showOfflineBadge && count === 0) return null;

  const handleSync = async () => {
    if (!online || syncing) return;
    setSyncing(true);
    try { await flushQueue(); } finally { setSyncing(false); }
  };

  if (showOfflineBadge) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700" title="Hors ligne — vos saisies sont enregistrées et seront synchronisées">
        <CloudOff className="h-3.5 w-3.5" />
        Hors ligne{count > 0 ? ` · ${count}` : ''}
      </span>
    );
  }

  // En ligne avec des éléments en attente
  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60"
      title="Opérations en attente — toucher pour synchroniser"
    >
      {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
      {syncing ? 'Synchro…' : `${count} en attente`}
    </button>
  );
};

export default OfflineSyncIndicator;
