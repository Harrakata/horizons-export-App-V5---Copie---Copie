import { supabase } from '@/lib/supabaseClient';
import { STORAGE_BUCKET } from '@/lib/clientConfig';

export const buildFullName = (prenom, nom) => [prenom, nom].filter(Boolean).join(' ').trim();

export const normalizeBigIntIdentifier = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  const normalizedValue = String(value).trim();

  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isSafeInteger(numericValue) ? numericValue : null;
};

export const recordPaiementGainEvent = async ({
  demandeId,
  codeDemande,
  actionType,
  actorType,
  actorId = null,
  actorName,
  actorFunction = null,
  statusBefore = null,
  statusAfter = null,
  commentaire = null,
}) => {
  if (!demandeId || !codeDemande || !actionType || !actorType || !actorName) {
    return { error: new Error('Informations insuffisantes pour journaliser l’événement.') };
  }

  return supabase.from('paiement_gain_workflow_events').insert({
    demandeId,
    codeDemande,
    actionType,
    actorType,
    actorId: normalizeBigIntIdentifier(actorId),
    actorName,
    actorFunction,
    statusBefore,
    statusAfter,
    commentaire,
  });
};

/**
 * Déclenche l'envoi d'un SMS au parieur via l'Edge Function `notify-parieur-sms`.
 *
 * Volontairement « best-effort » : l'envoi du SMS ne doit jamais bloquer ni faire
 * échouer le workflow métier (autorisation / refus / paiement). Les erreurs sont
 * journalisées côté serveur (table paiement_gain_sms_notifications) et renvoyées
 * ici sans être levées, pour que l'appelant puisse éventuellement informer
 * l'utilisateur sans interrompre l'action principale.
 *
 * @param {number|string} demandeId
 * @param {'authorized'|'rejected'|'paid'} event
 * @returns {Promise<{ data: any|null, error: Error|null }>}
 */
export const notifyParieurBySms = async (demandeId, event) => {
  if (!demandeId || !event) {
    return { data: null, error: new Error('demandeId et event requis pour la notification SMS.') };
  }

  try {
    const { data, error } = await supabase.functions.invoke('notify-parieur-sms', {
      body: { demandeId, event },
    });

    if (error) {
      console.error('notifyParieurBySms error:', error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (invokeError) {
    console.error('notifyParieurBySms exception:', invokeError);
    return { data: null, error: invokeError };
  }
};

export const uploadPaiementGainIdentityPhoto = async (file, codeDemande) => {
  if (!file) return { data: null, error: null };

  const extension = file.name.split('.').pop() || 'png';
  const fileName = `paiement_gros_gain/identites/${codeDemande}_${Date.now()}.${extension}`;

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    return { data: null, error };
  }

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  return { data: publicUrlData.publicUrl, error: null };
};
