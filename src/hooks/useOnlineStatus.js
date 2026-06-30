import { useEffect, useState } from 'react';

/**
 * État de connexion réseau (basé sur navigator.onLine + événements online/offline).
 * Renvoie `true` tant qu'aucune information ne dit le contraire (SSR-safe).
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
