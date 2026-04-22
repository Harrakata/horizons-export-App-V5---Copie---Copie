import { supabase } from '@/lib/supabaseClient';

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

export const uploadPaiementGainIdentityPhoto = async (file, codeDemande) => {
  if (!file) return { data: null, error: null };

  const extension = file.name.split('.').pop() || 'png';
  const fileName = `paiement_gros_gain/identites/${codeDemande}_${Date.now()}.${extension}`;

  const { data, error } = await supabase.storage.from('pmu-mali-storage').upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    return { data: null, error };
  }

  const { data: publicUrlData } = supabase.storage.from('pmu-mali-storage').getPublicUrl(data.path);

  return { data: publicUrlData.publicUrl, error: null };
};
