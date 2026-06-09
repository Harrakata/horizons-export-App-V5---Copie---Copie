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
      const pdv = await countRows('points_vente_mobi_change_requests', [['guichetiere_matricule', ctx.matricule], ['statut', REQUEST_STATUS.PENDING]]);
      if (pdv > 0) list.push({ key: 'pdv', count: pdv, title: 'Votre demande de point de vente', description: 'En attente de traitement', to: '/espace-guichetiere/mes-points-vente-mobi', severity: 'amber' });
    }

    else if (spaceKey === 'espace-technicien') {
      const [chefStep, expStep] = await Promise.all([
        countRows('planning_maintenance_modification_requests', [['technicien_id', ctx.technicienId], ['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF]]),
        countRows('planning_maintenance_modification_requests', [['technicien_id', ctx.technicienId], ['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION]]),
      ]);
      const total = chefStep + expStep;
      if (total > 0) list.push({ key: 'demande', count: total, title: 'Vos demandes de planning', description: 'En cours de traitement', to: '/espace-technicien', severity: 'amber' });
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
