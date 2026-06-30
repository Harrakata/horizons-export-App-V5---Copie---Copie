import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  isPushSupported, isPushConfigured, hasPushSubscription,
  subscribeToPush, unsubscribeFromPush,
} from '@/lib/pushNotifications';

/**
 * Bouton d'activation/désactivation des notifications push pour cet appareil.
 * Ne s'affiche que si le navigateur supporte le push ET que le déploiement est
 * configuré (clé VAPID présente).
 * @param reader { id, role, nom, agence, region }
 */
const EnablePushButton = ({ reader = {}, className = '', iconOnly = false }) => {
  const { toast } = useToast();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isPushSupported() && isPushConfigured();

  useEffect(() => { if (supported) hasPushSubscription().then(setSubscribed); }, [supported]);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast({ title: 'Notifications désactivées' });
    } else {
      const { ok, reason } = await subscribeToPush(reader);
      if (ok) {
        setSubscribed(true);
        toast({ title: 'Notifications activées', description: 'Vous recevrez les alertes importantes même app fermée.' });
      } else {
        toast({
          title: 'Activation impossible',
          description: reason === 'denied' ? 'Autorisation refusée dans le navigateur.' : reason === 'not-configured' ? 'Push non configuré côté serveur.' : reason,
          variant: 'destructive',
        });
      }
    }
    setBusy(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={toggle}
      disabled={busy}
      title={subscribed ? 'Désactiver les notifications push' : 'Activer les notifications push'}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : subscribed ? <BellRing className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
      {!iconOnly && <span className="ml-1.5">{subscribed ? 'Notifications activées' : 'Activer les notifications'}</span>}
    </Button>
  );
};

export default EnablePushButton;
