import { useEffect, useRef } from 'react';
import { reportSyncHealth } from '@/lib/syncHealth';

const HEARTBEAT_MS = 5 * 60 * 1000; // 5 min

/**
 * Remonte périodiquement l'état de synchro de l'appareil (heartbeat best-effort) :
 * au montage, à chaque synchro réussie (event 'offline-queue-synced'), et toutes
 * les 5 min. À monter dans les espaces qui écrivent hors-ligne.
 *
 * @param identity { userId, nom, role, agence, region }
 * @param enabled  n'émet que si vrai (ex. authentifié && mode hors-ligne actif)
 */
export function useSyncHealthHeartbeat(identity, enabled = true) {
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const identityKey = JSON.stringify(identity || {});

  useEffect(() => {
    if (!enabled) return undefined;
    const beat = (opts) => { reportSyncHealth(identityRef.current, opts); };

    beat(); // au montage
    const onSynced = () => beat({ justSynced: true });
    window.addEventListener('offline-queue-synced', onSynced);
    const interval = setInterval(() => beat(), HEARTBEAT_MS);

    return () => {
      window.removeEventListener('offline-queue-synced', onSynced);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, identityKey]);
}

export default useSyncHealthHeartbeat;
