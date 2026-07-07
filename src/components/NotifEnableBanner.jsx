import React, { useEffect, useState } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  isPushSupported, isPushConfigured, hasPushSubscription, subscribeToPush,
} from '@/lib/pushNotifications';
import {
  notificationsSupported, getNotifPermission, requestNotifPermission,
  setLocalNotifEnabled, isLocalNotifEnabled,
} from '@/lib/localNotifications';

const DISMISS_KEY = 'notif_banner_dismissed_until';
const DISMISS_DAYS = 3;

/**
 * Bannière incitant l'agent à activer ses notifications sur CET appareil, tant que
 * l'abonnement n'existe pas. Reportable (masquée quelques jours). Une fois activée,
 * disparaît. `reader { id, role, nom, agence, region }` sert au ciblage push.
 */
const NotifEnableBanner = ({ reader = {}, className = '' }) => {
  const { toast } = useToast();
  const [needs, setNeeds] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (!notificationsSupported()) { setNeeds(false); return; }
    // Reporté récemment ?
    let dismissed = false;
    try { dismissed = Date.now() < Number(localStorage.getItem(DISMISS_KEY) || 0); } catch { /* ignore */ }
    if (dismissed) { setNeeds(false); return; }
    // Déjà pleinement activé sur cet appareil ?
    const permOk = getNotifPermission() === 'granted';
    const pushWanted = isPushSupported() && isPushConfigured();
    const pushOk = pushWanted ? await hasPushSubscription().catch(() => false) : true;
    const enabled = permOk && isLocalNotifEnabled() && pushOk;
    setNeeds(!enabled);
  };

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!needs) return null;

  const enable = async () => {
    setBusy(true);
    const perm = await requestNotifPermission();
    if (perm !== 'granted') {
      setBusy(false);
      toast({ title: 'Autorisation refusée', description: 'Autorisez les notifications dans le navigateur.', variant: 'destructive' });
      return;
    }
    setLocalNotifEnabled(true);
    if (isPushSupported() && isPushConfigured()) {
      try { await subscribeToPush(reader); } catch { /* best-effort */ }
    }
    setBusy(false);
    setNeeds(false);
    toast({ title: 'Notifications activées', description: 'Vous serez alerté, même application fermée.' });
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000)); } catch { /* ignore */ }
    setNeeds(false);
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-900 shadow-sm ${className}`}>
      <BellRing className="h-5 w-5 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <span className="font-semibold">Activez vos notifications</span> pour être alerté même quand l'application est fermée.
      </p>
      <Button size="sm" onClick={enable} disabled={busy} className="shrink-0 gap-1.5">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} Activer
      </Button>
      <button type="button" onClick={dismiss} title="Plus tard" className="shrink-0 rounded-lg p-1 text-amber-600 transition-colors hover:bg-amber-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default NotifEnableBanner;
