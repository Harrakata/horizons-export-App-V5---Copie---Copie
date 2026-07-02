import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  isPushSupported, isPushConfigured, hasPushSubscription,
  subscribeToPush, unsubscribeFromPush,
} from '@/lib/pushNotifications';
import {
  notificationsSupported, getNotifPermission, requestNotifPermission,
  setLocalNotifEnabled, isLocalNotifEnabled, notifyLocal, getSwVersion,
} from '@/lib/localNotifications';

/**
 * Active/désactive les notifications pour cet appareil.
 *  - Si le push est configuré (clé VAPID) : abonnement Web Push (alerte même app fermée).
 *  - Sinon : notifications LOCALES (OS), affichées quand l'app est ouverte.
 * S'affiche dès que le navigateur supporte les notifications.
 * @param reader { id, role, nom, agence, region }
 */
const EnablePushButton = ({ reader = {}, className = '', iconOnly = false, asNavButton = false }) => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = notificationsSupported(); // OS notifications suffisent

  useEffect(() => {
    (async () => {
      if (!supported) return;
      const pushOn = (isPushSupported() && isPushConfigured()) ? await hasPushSubscription() : false;
      setEnabled(pushOn || isLocalNotifEnabled());
    })();
  }, [supported]);

  if (!supported) return null;

  const enable = async () => {
    const perm = await requestNotifPermission();
    if (perm !== 'granted') {
      toast({ title: 'Activation impossible', description: 'Autorisation refusée dans le navigateur.', variant: 'destructive' });
      return false;
    }
    // Toujours activer les notifications locales (affichage app ouverte, fiable).
    setLocalNotifEnabled(true);
    // En plus : vrai Web Push si configuré (alerte même app fermée), best-effort.
    let pushOk = false;
    if (isPushSupported() && isPushConfigured()) {
      const res = await subscribeToPush(reader);
      pushOk = !!res.ok;
    }
    // Diagnostic : version du service worker réellement active.
    const swVersion = await getSwVersion();
    // Notification de test immédiate pour confirmer que ça fonctionne.
    await notifyLocal('Notifications activées', { body: `Vous serez alerté des nouveautés.${swVersion ? ` (SW ${swVersion})` : ''}`, tag: 'notif-test' });
    return { ok: true, pushOk, swVersion };
  };

  const disable = async () => {
    if (isPushSupported() && isPushConfigured()) await unsubscribeFromPush();
    setLocalNotifEnabled(false);
  };

  const toggle = async () => {
    setBusy(true);
    if (enabled) { await disable(); setEnabled(false); toast({ title: 'Notifications désactivées' }); }
    else {
      const res = await enable();
      if (res && res.ok) {
        setEnabled(true);
        const mode = res.pushOk
          ? 'Y compris quand l’application est fermée (push).'
          : 'Quand l’application est ouverte. (Push serveur non configuré → app fermée indisponible.)';
        toast({
          title: 'Notifications activées',
          description: `${mode}${res.swVersion ? ` · SW ${res.swVersion}` : ' · SW non détecté'}`,
        });
      }
    }
    setBusy(false);
  };

  // Mode « bouton de barre de navigation » (footer Accueil/Profil/Déconn).
  if (asNavButton) {
    return (
      <button
        type="button" onClick={toggle} disabled={busy}
        className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 text-muted-foreground/70 transition-colors hover:bg-primary/8 hover:text-primary disabled:opacity-60"
        title={enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : enabled ? <BellRing className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5" />}
        <span className="text-[0.6rem] font-semibold">{enabled ? 'Notifs ✓' : 'Notifs'}</span>
      </button>
    );
  }

  return (
    <Button
      variant="outline" size="sm" className={className} onClick={toggle} disabled={busy}
      title={enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <BellRing className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
      {!iconOnly && <span className="ml-1.5">{enabled ? 'Notifications activées' : 'Activer les notifications'}</span>}
    </Button>
  );
};

export default EnablePushButton;
