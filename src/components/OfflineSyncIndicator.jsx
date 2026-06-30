import React, { useEffect, useState } from 'react';
import { CloudOff, Cloud } from 'lucide-react';
import { countQueued, subscribeQueue, OFFLINE_FEATURE_KEY } from '@/lib/offlineQueue';
import { flushQueue } from '@/lib/offlineSync';
import { cachedQuery } from '@/lib/offlineCache';
import { supabase } from '@/lib/supabaseClient';
import { APP_SPACE_SETTINGS_KEY } from '@/lib/exploitationProfiles';
import MaSynchroDialog from '@/components/MaSynchroDialog';

/**
 * Indicateur de synchronisation hors-ligne.
 * - Affiche « Hors ligne » quand pas de connexion.
 * - Affiche le nombre d'opérations en attente + un bouton pour synchroniser.
 * - Masqué quand on est en ligne et qu'il n'y a rien en attente.
 */
const OfflineSyncIndicator = () => {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const badgeClass = showOfflineBadge
    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
    : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100';

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${badgeClass}`}
        title="Voir le détail de la synchronisation"
      >
        {showOfflineBadge ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
        {showOfflineBadge ? `Hors ligne${count > 0 ? ` · ${count}` : ''}` : `${count} en attente`}
      </button>
      <MaSynchroDialog open={detailsOpen} onOpenChange={setDetailsOpen} online={online} />
    </>
  );
};

export default OfflineSyncIndicator;
