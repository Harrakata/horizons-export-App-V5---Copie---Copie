import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { REQUEST_STATUS } from '@/lib/guichetiereSpace';
import { MAINTENANCE_REQUEST_STATUSES } from '@/lib/maintenancePlanningRequests';
import { DEMANDE_STATUSES } from '@/lib/paiementGainUtils';

const REFRESH_MS = 90 * 1000;

// Compte (léger, head) le nombre de lignes d'une table selon des filtres `eq`.
// Renvoie 0 en cas d'erreur (table absente, colonne inconnue…) — jamais de crash.
const countRows = async (table, filters = []) => {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const [col, val] of filters) {
      if (val === undefined || val === null || val === '') continue;
      query = query.eq(col, val);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
};

// Compte les messages actifs de l'exploitation destinés à un espace donné.
// Filtre côté client pour supporter : agence, région, secteur, sélection individuelle.
// ctx pour guichetière : { matricule, agenceNom }   (région/secteur déduits si besoin)
// ctx pour technicien  : { technicienId }
const countExploitationMessages = async (destinataire, ctx = {}) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('messages_exploitation')
      .select('id, destinataires, agence_nom, region_nom, secteur_nom, guichetiere_matricules, technicien_ids')
      .eq('actif', true)
      .or(`expire_a.is.null,expire_a.gt.${now}`)
      .limit(200);

    if (error || !data) return 0;

    const relevant = data.filter((m) => m.destinataires === destinataire || m.destinataires === 'tous');
    if (!relevant.length) return 0;

    // Récupération lazy de région/secteur si un message les utilise et qu'on ne les a pas
    let regionNom  = ctx.regionNom  || null;
    let secteurNom = ctx.secteurNom || null;
    if (destinataire === 'guichetiere' && ctx.agenceNom && (!regionNom || !secteurNom)) {
      const needsGeo = relevant.some((m) => m.region_nom || m.secteur_nom);
      if (needsGeo) {
        const { data: ag } = await supabase
          .from('agences').select('region, secteur')
          .eq('nom', ctx.agenceNom).eq('is_current', true).maybeSingle();
        if (ag) { regionNom = ag.region; secteurNom = ag.secteur; }
      }
    }

    return relevant.filter((m) => {
      if (destinataire === 'guichetiere') {
        if (m.guichetiere_matricules?.length > 0)
          return (m.guichetiere_matricules).includes(ctx.matricule || '');
        if (m.agence_nom)  return m.agence_nom  === ctx.agenceNom;
        if (m.secteur_nom) return m.secteur_nom === secteurNom;
        if (m.region_nom)  return m.region_nom  === regionNom;
        return true; // broadcast sans filtre
      }
      if (destinataire === 'technicien') {
        if (m.technicien_ids?.length > 0)
          return (m.technicien_ids).map(Number).includes(Number(ctx.technicienId));
        return true; // broadcast sans filtre
      }
      return false;
    }).length;
  } catch {
    return 0;
  }
};

// Compte les enregistrements REFUSÉS (hors zone) non encore acquittés par le concerné.
const countRefused = async (table, idCol, idVal) => {
  if (!idVal) return 0;
  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(idCol, idVal)
      .eq('geo_refused', true)
      .not('geo_refusal_ack', 'is', true);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
};

/**
 * Construit la liste des alertes (notifications) pertinentes selon l'espace/rôle,
 * dérivées en direct des données existantes. Pas de table dédiée.
 *
 * @param {object}  params
 * @param {string}  params.spaceKey   ex. 'espace-exploitation'
 * @param {boolean} params.enabled
 * @param {object}  params.context    données de rôle (agence, ids, matricule…)
 */
export function useSpaceNotifications({ spaceKey, enabled = true, context = {} }) {
  const [notifications, setNotifications] = useState([]);
  const ctxRef = useRef(context);
  ctxRef.current = context;

  // Clé stable pour relancer le calcul quand le contexte significatif change.
  const ctxKey = JSON.stringify(context || {});

  const compute = useCallback(async () => {
    const ctx = ctxRef.current || {};
    const list = [];

    if (spaceKey === 'espace-exploitation') {
      const [pdv, maint, planning, pay] = await Promise.all([
        countRows('points_vente_mobi_change_requests', [['statut', REQUEST_STATUS.PENDING]]),
        countRows('planning_maintenance_modification_requests', [['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION]]),
        countRows('planning_modification_requests', [['statut', 'En attente exploitation']]),
        countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_EXPLOITATION]]),
      ]);
      if (pdv > 0)      list.push({ key: 'pdv',      count: pdv,      title: 'Demandes de modification PDV', description: 'En attente de validation', to: '/espace-exploitation/points-vente-mobi', severity: 'amber' });
      if (maint > 0)    list.push({ key: 'maint',    count: maint,    title: 'Demandes de maintenance', description: 'En attente exploitation', to: '/espace-exploitation/maintenance-terminaux', severity: 'amber' });
      if (planning > 0) list.push({ key: 'planning', count: planning, title: 'Demandes de planning', description: 'En attente exploitation', to: '/espace-exploitation/etat-planning-general', severity: 'amber' });
      if (pay > 0)      list.push({ key: 'pay',      count: pay,      title: 'Paiements de gain à autoriser', description: 'En attente exploitation', to: '/espace-exploitation/autorisation-paiement-gain', severity: 'blue' });
    }

    else if (spaceKey === 'espace-chef-agence') {
      const [maint, pay] = await Promise.all([
        countRows('planning_maintenance_modification_requests', [['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF], ['agence_nom', ctx.agenceNom]]),
        countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_CHEF], ['chefAgenceId', ctx.chefId]]),
      ]);
      if (maint > 0) list.push({ key: 'maint', count: maint, title: 'Demandes de maintenance', description: 'À valider pour votre agence', to: '/espace-chef-agence/maintenance-terminaux', severity: 'amber' });
      if (pay > 0)   list.push({ key: 'pay',   count: pay,   title: 'Paiements de gain à valider', description: 'En attente de votre validation', to: '/espace-chef-agence/paiement-gros-gain', severity: 'blue' });
    }

    else if (spaceKey === 'espace-directeur-regional') {
      const pay = await countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_REGIONAL], ['directeurRegionalId', ctx.validatorId]]);
      if (pay > 0) list.push({ key: 'pay', count: pay, title: 'Paiements de gain à valider', description: 'En attente directeur régional', to: '/espace-validation-paiement-gain', severity: 'blue' });
    }

    else if (spaceKey === 'espace-directeur-general') {
      const pay = await countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_GENERAL]]);
      if (pay > 0) list.push({ key: 'pay', count: pay, title: 'Paiements de gain à valider', description: 'En attente directeur général', to: '/espace-directeur-general', severity: 'blue' });
    }

    else if (spaceKey === 'espace-guichetiere') {
      const [pdv, geoRefused, msgs] = await Promise.all([
        countRows('points_vente_mobi_change_requests', [['guichetiere_matricule', ctx.matricule], ['statut', REQUEST_STATUS.PENDING]]),
        countRefused('pointages', 'guichetiereMatricule', ctx.matricule),
        countExploitationMessages('guichetiere', { matricule: ctx.matricule, agenceNom: ctx.agenceNom }),
      ]);
      if (pdv > 0)        list.push({ key: 'pdv',        count: pdv,        title: 'Votre demande de point de vente',  description: 'En attente de traitement',      to: '/espace-guichetiere/mes-points-vente-mobi', severity: 'amber' });
      if (geoRefused > 0) list.push({ key: 'geo-refused', count: geoRefused, title: 'Pointage(s) refusé(s)',            description: 'Hors zone agence — annulé(s)',  to: '/espace-guichetiere/mes-pointages',          severity: 'red'   });
      if (msgs > 0)       list.push({ key: 'msg-expl',   count: msgs,       title: "Message(s) de l'exploitation",     description: 'Consultez vos notifications',   to: '/espace-guichetiere',                        severity: 'blue'  });
    }

    else if (spaceKey === 'espace-technicien') {
      const [chefStep, expStep, geoRefused, msgs] = await Promise.all([
        countRows('planning_maintenance_modification_requests', [['technicien_id', ctx.technicienId], ['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF]]),
        countRows('planning_maintenance_modification_requests', [['technicien_id', ctx.technicienId], ['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION]]),
        countRefused('interventions_maintenance', 'technicien_id', ctx.technicienId),
        countExploitationMessages('technicien', { technicienId: ctx.technicienId }),
      ]);
      const total = chefStep + expStep;
      if (total > 0)      list.push({ key: 'demande',    count: total,      title: 'Vos demandes de planning',         description: 'En cours de traitement',        to: '/espace-technicien',                         severity: 'amber' });
      if (geoRefused > 0) list.push({ key: 'geo-refused', count: geoRefused, title: 'Intervention(s) refusée(s)',       description: 'Hors zone agence — annulée(s)', to: '/espace-technicien',                         severity: 'red'   });
      if (msgs > 0)       list.push({ key: 'msg-expl',   count: msgs,       title: "Message(s) de l'exploitation",     description: 'Consultez vos notifications',   to: '/espace-technicien',                         severity: 'blue'  });
    }

    return list;
  }, [spaceKey]);

  const refresh = useCallback(() => {
    if (!enabled || !spaceKey) return;
    compute().then((list) => setNotifications(list)).catch(() => {});
  }, [enabled, spaceKey, compute]);

  useEffect(() => {
    if (!enabled || !spaceKey) {
      setNotifications([]);
      return undefined;
    }
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, spaceKey, ctxKey]);

  const totalCount = useMemo(
    () => notifications.reduce((sum, n) => sum + (n.count || 0), 0),
    [notifications]
  );

  return { notifications, totalCount, refresh };
}

export default useSpaceNotifications;
