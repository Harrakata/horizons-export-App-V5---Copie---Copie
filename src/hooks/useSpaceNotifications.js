import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { REQUEST_STATUS, getPlanningRequestTypeLabel } from '@/lib/guichetiereSpace';
import {
  MAINTENANCE_REQUEST_STATUSES,
  getMaintenancePlanningRequestTypeLabel,
} from '@/lib/maintenancePlanningRequests';
import { DEMANDE_STATUSES } from '@/lib/paiementGainUtils';
import { normalizeBigIntIdentifier } from '@/lib/paiementGainService';
import { ticketOverdue } from '@/lib/tickets';
import { countBlockedDevices } from '@/lib/syncHealth';
import { countUntreatedRemontees } from '@/lib/messaging';
import { isLocalNotifEnabled, notifyLocal } from '@/lib/localNotifications';
import { hasPushSubscription } from '@/lib/pushNotifications';
import { isNotifTypeEnabled } from '@/lib/notificationSettings';

// Racine de chaque espace (pour ouvrir la cloche à la ré-ouverture depuis une notif message).
const SPACE_ROOTS = {
  'espace-guichetiere': '/espace-guichetiere',
  'espace-technicien': '/espace-technicien',
  'espace-chef-agence': '/espace-chef-agence',
  'espace-chef-secteur': '/espace-chef-secteur',
  'espace-directeur-regional': '/espace-validation-paiement-gain',
  'espace-directeur-general': '/espace-directeur-general',
  'espace-exploitation': '/espace-exploitation',
};

// Signature d'une notification (pour détecter les nouveautés entre deux rafraîchissements).
const notifSignatures = (n) =>
  n.messages?.length ? n.messages.map((m) => `m:${m.id}`) : [`${n.key}:${n.count}`];

// Persistance des signatures « déjà vues » (survit aux refresh/navigations) → permet
// de déclencher une notif OS pour ce qui est apparu pendant l'absence.
const SEEN_PREFIX = 'notif_seen_';
const loadSeen = (spaceKey) => {
  try { const raw = localStorage.getItem(SEEN_PREFIX + spaceKey); return raw ? new Set(JSON.parse(raw)) : null; }
  catch { return null; }
};
const saveSeen = (spaceKey, set) => {
  try { localStorage.setItem(SEEN_PREFIX + spaceKey, JSON.stringify([...set].slice(-200))); }
  catch { /* quota */ }
};

const REFRESH_MS = 30 * 1000;

// Formatte une date ISO en jj/mm/aaaa (fr), ou null si vide/invalide.
const fmtDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
};

// Récupère les demandes en attente d'une table et les met en forme façon « message »
// pour un affichage déplié dans la cloche (réutilise le rendu inline des messages).
// Renvoie [] si un filtre requis est vide (évite de récupérer des lignes hors périmètre).
const fetchDemandMessages = async (table, { filters = [], shape, prefix, categorie = 'urgent' }) => {
  try {
    let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(50);
    for (const [col, val] of filters) {
      if (val === undefined || val === null || val === '') return [];
      query = query.eq(col, val);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => ({
      id: `${prefix}-${row.id}`,
      created_at: row.created_at,
      categorie,
      ...shape(row),
    }));
  } catch {
    return [];
  }
};

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

// Récupère les messages actifs de l'exploitation destinés à un espace donné.
// Retourne le tableau filtré (avec contenu) pour affichage inline dans le popover.
// ctx pour guichetière : { matricule, agenceNom }   (région/secteur déduits si besoin)
// ctx pour technicien  : { technicienId }
const fetchExploitationMessages = async (destinataire, ctx = {}) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('messages_exploitation')
      .select('id, titre, corps, categorie, destinataires, agence_nom, region_nom, secteur_nom, guichetiere_matricules, technicien_ids, envoye_par_nom, created_at')
      .eq('actif', true)
      .or(`expire_a.is.null,expire_a.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    // 'tous' signifie Guichetières & Techniciens, pas tous les espaces
    const includesTous = ['guichetiere', 'technicien'].includes(destinataire);
    const relevant = data.filter((m) => m.destinataires === destinataire || (includesTous && m.destinataires === 'tous'));
    if (!relevant.length) return [];

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
          return m.guichetiere_matricules.includes(ctx.matricule || '');
        if (m.agence_nom)  return m.agence_nom  === ctx.agenceNom;
        if (m.secteur_nom) return m.secteur_nom === secteurNom;
        if (m.region_nom)  return m.region_nom  === regionNom;
        return true;
      }
      if (destinataire === 'technicien') {
        if (m.technicien_ids?.length > 0)
          return m.technicien_ids.map(String).includes(String(ctx.technicienId));
        return true;
      }
      if (destinataire === 'chef_agence') {
        if (m.agence_nom)  return m.agence_nom  === ctx.agenceNom;
        if (m.secteur_nom) return m.secteur_nom === ctx.secteurNom;
        if (m.region_nom)  return m.region_nom  === ctx.regionNom;
        return true;
      }
      if (destinataire === 'chef_secteur') {
        if (m.secteur_nom) return m.secteur_nom === ctx.secteurNom;
        if (m.region_nom)  return m.region_nom  === ctx.regionNom;
        return true;
      }
      if (destinataire === 'directeur_regional') {
        if (m.region_nom) return m.region_nom === ctx.regionNom;
        return true;
      }
      return false;
    });
  } catch {
    return [];
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

// Compte les tickets actifs en RETARD (SLA dépassé) selon des `eq` optionnels.
const countOverdueTickets = async (filters = []) => {
  try {
    let query = supabase
      .from('tickets_incidents')
      .select('priorite, statut, created_at')
      .in('statut', ['ouvert', 'en_cours'])
      .limit(500);
    for (const [col, val] of filters) {
      if (val === undefined || val === null || val === '') continue;
      query = query.eq(col, val);
    }
    const { data, error } = await query;
    if (error || !data) return 0;
    return data.filter(ticketOverdue).length;
  } catch {
    return 0;
  }
};

// Compte les tickets « actifs » (ouvert / en cours), filtrés par des `eq` optionnels.
const countActiveTickets = async (filters = []) => {
  try {
    let query = supabase
      .from('tickets_incidents')
      .select('id', { count: 'exact', head: true })
      .in('statut', ['ouvert', 'en_cours']);
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

// Tables sources écoutées en temps réel (Supabase Realtime) → rafraîchissement quasi immédiat.
const REALTIME_TABLES = [
  'messages_exploitation', 'tickets_incidents', 'demandes_absence',
  'planning_modification_requests', 'planning_maintenance_modification_requests',
  'demandes_paiement_gain', 'points_vente_mobi_change_requests', 'sync_health',
];

/**
 * Calcule la liste des alertes (notifications) pertinentes pour un espace/rôle,
 * dérivées en direct des données existantes. Fonction PURE (pas de hook) → réutilisable
 * par le hook par-page ET par la surveillance globale (Layout).
 *
 * @param {string} spaceKey   ex. 'espace-exploitation'
 * @param {object} ctx        données de rôle (agence, ids, matricule…)
 */
export async function computeSpaceNotifications(spaceKey, ctx = {}) {
  const list = [];

  {
    if (spaceKey === 'espace-exploitation') {
      const [pdvMsgs, maintMsgs, pay] = await Promise.all([
        fetchDemandMessages('points_vente_mobi_change_requests', {
          prefix: 'pdv',
          filters: [['statut', REQUEST_STATUS.PENDING]],
          shape: (r) => ({
            titre: `${r.code_point_vente || 'PDV'} — ${r.guichetiere_nom || r.guichetiere_matricule || ''}`.trim(),
            corps: [
              r.requested_region ? `Région → ${r.requested_region}` : null,
              r.requested_agence_nom ? `Agence → ${r.requested_agence_nom}` : null,
              r.requested_terminal_reference ? `Terminal → ${r.requested_terminal_reference}` : null,
              r.commentaire ? `« ${r.commentaire} »` : null,
            ].filter(Boolean).join('\n') || 'Demande de modification',
            envoye_par_nom: r.guichetiere_nom || r.guichetiere_matricule || null,
          }),
        }),
        fetchDemandMessages('planning_maintenance_modification_requests', {
          prefix: 'maint',
          filters: [['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION]],
          shape: (r) => ({
            titre: `${r.technicien_nom || r.technicien_matricule || 'Technicien'} — ${getMaintenancePlanningRequestTypeLabel(r.type_demande)}`,
            corps: [
              r.agence_nom ? `Agence : ${r.agence_nom}` : null,
              r.date_planification ? `Planning du ${fmtDate(r.date_planification)}` : null,
              r.date_souhaitee ? `Date souhaitée → ${fmtDate(r.date_souhaitee)}` : null,
              r.motif ? `« ${r.motif} »` : null,
            ].filter(Boolean).join('\n'),
            envoye_par_nom: r.technicien_nom || r.technicien_matricule || null,
          }),
        }),
        countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_EXPLOITATION]]),
      ]);
      if (pdvMsgs.length > 0)   list.push({ key: 'pdv',   count: pdvMsgs.length,   title: 'Demandes de modification PDV', description: 'En attente de validation', to: '/espace-exploitation/points-vente-mobi',           severity: 'amber', messages: pdvMsgs });
      if (maintMsgs.length > 0) list.push({ key: 'maint', count: maintMsgs.length, title: 'Demandes de maintenance',      description: 'En attente exploitation', to: '/espace-exploitation/maintenance-terminaux',         severity: 'amber', messages: maintMsgs });
      if (pay > 0)              list.push({ key: 'pay',   count: pay,              title: 'Paiements de gain à autoriser', description: 'En attente exploitation', to: '/espace-exploitation/autorisation-paiement-gain', severity: 'blue' });
      const [ticketsOpen, ticketsLate] = await Promise.all([
        countActiveTickets([['statut', 'ouvert']]),
        countOverdueTickets(),
      ]);
      if (ticketsOpen > 0)     list.push({ key: 'tickets', count: ticketsOpen, title: 'Tickets à traiter', description: 'Incidents ouverts à assigner', to: '/espace-exploitation/tickets', severity: 'amber' });
      if (ticketsLate > 0)     list.push({ key: 'tickets-sla', count: ticketsLate, title: 'Tickets en retard (SLA)', description: 'Délai de résolution dépassé', to: '/espace-exploitation/tickets', severity: 'red' });
      const syncBlocked = await countBlockedDevices();
      if (syncBlocked > 0)     list.push({ key: 'sync-blocked', count: syncBlocked, title: 'Synchro bloquée', description: 'Appareils avec écritures en attente', to: '/espace-exploitation/activites-et-audit?tab=sante-synchro', severity: 'red' });
      const remontees = await countUntreatedRemontees();
      if (remontees > 0)       list.push({ key: 'remontees', count: remontees, title: 'Remontées terrain', description: 'Messages des agents à traiter', to: '/espace-exploitation/notifications-exploitation', severity: 'blue' });
    }

    else if (spaceKey === 'espace-chef-agence') {
      const [maintMsgs, planMsgs, pay, explMsgs] = await Promise.all([
        fetchDemandMessages('planning_maintenance_modification_requests', {
          prefix: 'maint',
          filters: [['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF], ['agence_nom', ctx.agenceNom]],
          shape: (r) => ({
            titre: `${r.technicien_nom || r.technicien_matricule || 'Technicien'} — ${getMaintenancePlanningRequestTypeLabel(r.type_demande)}`,
            corps: [
              r.date_planification ? `Planning du ${fmtDate(r.date_planification)}` : null,
              r.date_souhaitee ? `Date souhaitée → ${fmtDate(r.date_souhaitee)}` : null,
              r.motif ? `« ${r.motif} »` : null,
            ].filter(Boolean).join('\n'),
            envoye_par_nom: r.technicien_nom || r.technicien_matricule || null,
          }),
        }),
        fetchDemandMessages('planning_modification_requests', {
          prefix: 'plang',
          filters: [['statut', REQUEST_STATUS.PENDING], ['agence_nom', ctx.agenceNom]],
          shape: (r) => ({
            titre: `${r.guichetiere_nom || r.guichetiere_matricule || 'Guichetière'} — ${getPlanningRequestTypeLabel(r.type_demande)}`,
            corps: [
              r.date_planning ? `Planning du ${fmtDate(r.date_planning)}` : null,
              r.date_souhaitee ? `Date souhaitée → ${fmtDate(r.date_souhaitee)}` : null,
              r.motif ? `« ${r.motif} »` : null,
            ].filter(Boolean).join('\n'),
            envoye_par_nom: r.guichetiere_nom || r.guichetiere_matricule || null,
          }),
        }),
        countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_CHEF], ['chefAgenceId', normalizeBigIntIdentifier(ctx.chefId)]]),
        fetchExploitationMessages('chef_agence', { agenceNom: ctx.agenceNom }),
      ]);
      if (maintMsgs.length > 0) list.push({ key: 'maint',    count: maintMsgs.length, title: 'Demandes de maintenance',      description: "À valider pour votre agence",    to: '/espace-chef-agence/maintenance-terminaux', severity: 'amber', messages: maintMsgs });
      if (planMsgs.length > 0)  list.push({ key: 'planning', count: planMsgs.length,  title: 'Demandes de planning',        description: "À valider pour votre agence",    to: '/espace-chef-agence/mon-planning',          severity: 'amber', messages: planMsgs });
      if (pay > 0)              list.push({ key: 'pay',      count: pay,              title: 'Paiements de gain à valider', description: 'En attente de votre validation', to: '/espace-chef-agence/paiement-gros-gain',    severity: 'blue'  });
      if (explMsgs.length > 0)  list.push({ key: 'msg-expl', count: explMsgs.length,  title: "Message(s) de l'exploitation", description: 'Cliquez pour lire',             to: null,                                        severity: 'blue', messages: explMsgs });
      const ticketsAgence = await countActiveTickets([['agence_nom', ctx.agenceNom]]);
      if (ticketsAgence > 0)    list.push({ key: 'tickets', count: ticketsAgence, title: 'Tickets / Incidents actifs', description: 'Incidents en cours sur votre agence', to: '/espace-chef-agence/tickets', severity: 'amber' });
    }

    else if (spaceKey === 'espace-chef-secteur') {
      const explMsgs = await fetchExploitationMessages('chef_secteur', { secteurNom: ctx.secteurNom });
      if (explMsgs.length > 0) list.push({ key: 'msg-expl', count: explMsgs.length, title: "Message(s) de l'exploitation", description: 'Cliquez pour lire', to: null, severity: 'blue', messages: explMsgs });
    }

    else if (spaceKey === 'espace-directeur-regional') {
      const [pay, explMsgs] = await Promise.all([
        countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_REGIONAL], ['directeurRegionalId', normalizeBigIntIdentifier(ctx.validatorId)]]),
        fetchExploitationMessages('directeur_regional', { regionNom: ctx.regionNom }),
      ]);
      if (pay > 0)             list.push({ key: 'pay',      count: pay,             title: 'Paiements de gain à valider',  description: 'En attente directeur régional', to: '/espace-validation-paiement-gain', severity: 'blue' });
      if (explMsgs.length > 0) list.push({ key: 'msg-expl', count: explMsgs.length, title: "Message(s) de l'exploitation", description: 'Cliquez pour lire',            to: null,                              severity: 'blue', messages: explMsgs });
    }

    else if (spaceKey === 'espace-directeur-general') {
      const pay = await countRows('demandes_paiement_gain', [['statutGlobal', DEMANDE_STATUSES.PENDING_GENERAL]]);
      if (pay > 0) list.push({ key: 'pay', count: pay, title: 'Paiements de gain à valider', description: 'En attente directeur général', to: '/espace-directeur-general', severity: 'blue' });
    }

    else if (spaceKey === 'espace-guichetiere') {
      const [pdvMsgs, geoRefused, explMsgs] = await Promise.all([
        fetchDemandMessages('points_vente_mobi_change_requests', {
          prefix: 'pdv',
          categorie: 'info',
          filters: [['guichetiere_matricule', ctx.matricule], ['statut', REQUEST_STATUS.PENDING]],
          shape: (r) => ({
            titre: `${r.code_point_vente || 'PDV'} — En attente`,
            corps: [
              r.requested_region ? `Région → ${r.requested_region}` : null,
              r.requested_agence_nom ? `Agence → ${r.requested_agence_nom}` : null,
              r.requested_terminal_reference ? `Terminal → ${r.requested_terminal_reference}` : null,
              r.commentaire ? `« ${r.commentaire} »` : null,
            ].filter(Boolean).join('\n') || 'Demande de modification envoyée',
            envoye_par_nom: null,
          }),
        }),
        countRefused('pointages', 'guichetiereMatricule', ctx.matricule),
        fetchExploitationMessages('guichetiere', { matricule: ctx.matricule, agenceNom: ctx.agenceNom }),
      ]);
      if (pdvMsgs.length > 0)  list.push({ key: 'pdv',        count: pdvMsgs.length,  title: 'Votre demande de point de vente', description: 'En attente de traitement',      to: '/espace-guichetiere/mes-points-vente-mobi', ctaLabel: 'Voir le suivi', severity: 'amber', messages: pdvMsgs });
      if (geoRefused > 0)      list.push({ key: 'geo-refused', count: geoRefused,      title: 'Pointage(s) refusé(s)',           description: 'Hors zone agence — annulé(s)', to: '/espace-guichetiere/mes-pointages',          severity: 'red'   });
      if (explMsgs.length > 0) list.push({ key: 'msg-expl',   count: explMsgs.length, title: "Message(s) de l'exploitation",    description: 'Cliquez pour lire',             to: null,                                        severity: 'blue', messages: explMsgs });
    }

    else if (spaceKey === 'espace-technicien') {
      const tShape = (r) => ({
        titre: `${getMaintenancePlanningRequestTypeLabel(r.type_demande)} — ${r.statut}`,
        corps: [
          r.agence_nom ? `Agence : ${r.agence_nom}` : null,
          r.date_planification ? `Planning du ${fmtDate(r.date_planification)}` : null,
          r.date_souhaitee ? `Date souhaitée → ${fmtDate(r.date_souhaitee)}` : null,
          r.motif ? `« ${r.motif} »` : null,
        ].filter(Boolean).join('\n'),
        envoye_par_nom: null,
      });
      const [chefMsgs, expMsgs, geoRefused, explMsgs] = await Promise.all([
        fetchDemandMessages('planning_maintenance_modification_requests', { prefix: 'maintc', categorie: 'info', filters: [['technicien_id', ctx.technicienId], ['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF]], shape: tShape }),
        fetchDemandMessages('planning_maintenance_modification_requests', { prefix: 'mainte', categorie: 'info', filters: [['technicien_id', ctx.technicienId], ['statut', MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION]], shape: tShape }),
        countRefused('interventions_maintenance', 'technicien_id', ctx.technicienId),
        fetchExploitationMessages('technicien', { technicienId: ctx.technicienId }),
      ]);
      const demandeMsgs = [...chefMsgs, ...expMsgs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      if (demandeMsgs.length > 0) list.push({ key: 'demande',    count: demandeMsgs.length, title: 'Vos demandes de planning',        description: 'En cours de traitement',        to: '/espace-technicien', ctaLabel: 'Voir le suivi', severity: 'amber', messages: demandeMsgs });
      if (geoRefused > 0)         list.push({ key: 'geo-refused', count: geoRefused,         title: 'Intervention(s) refusée(s)',      description: 'Hors zone agence — annulée(s)', to: '/espace-technicien',                         severity: 'red'   });
      if (explMsgs.length > 0)    list.push({ key: 'msg-expl',   count: explMsgs.length,    title: "Message(s) de l'exploitation",    description: 'Cliquez pour lire',             to: null,                                        severity: 'blue', messages: explMsgs });
      const ticketsAssignes = await countActiveTickets([['assigne_a_id', ctx.technicienId != null ? String(ctx.technicienId) : '']]);
      if (ticketsAssignes > 0)    list.push({ key: 'tickets',    count: ticketsAssignes,    title: 'Tickets assignés',                description: 'Incidents à prendre en charge', to: '/espace-technicien',                         severity: 'amber' });
    }

  }

  return list;
}

// Un « type poussé » = notification aussi envoyée en Web Push (message de l'exploitation,
// remontée terrain). Si un abonnement push existe sur l'appareil, le service worker l'affiche
// déjà (app ouverte OU fermée) → on NE refait PAS de notif locale, sinon doublon.
const isPushedType = (n, spaceKey) =>
  (n.messages?.length > 0 && !n.to) ||                              // messages de l'exploitation
  (spaceKey === 'espace-exploitation' && n.key === 'remontees');   // remontées terrain

// Type de réglage global (activer/désactiver) associé à une notification, ou null.
const notifSettingKey = (n, spaceKey) => {
  if (n.messages?.length > 0 && !n.to) return 'message';                          // messages exploitation
  if (spaceKey === 'espace-technicien' && n.key === 'tickets') return 'ticket_assigne';
  return null;
};

// Déclenche une notification OS (locale) pour chaque groupe contenant une nouveauté.
// Fonction PURE : la déduplication s'appuie sur l'état persisté (loadSeen/saveSeen),
// partagé entre le hook par-page et la surveillance globale.
export async function fireLocalForNew(spaceKey, list) {
  const sigs = new Set(list.flatMap(notifSignatures));
  const prev = loadSeen(spaceKey); // null = 1re fois sur cet appareil → baseline (pas de rafale)
  if (prev && isLocalNotifEnabled()) {
    // Abonnement push actif ? → le push couvre déjà messages/remontées (ouvert comme fermé).
    let pushActive = false;
    try { pushActive = await hasPushSubscription(); } catch { /* pas de SW / pas d'abonnement */ }
    let fired = 0;
    for (const n of list) {
      if (fired >= 3) break; // évite les rafales
      if (!notifSignatures(n).some((s) => !prev.has(s))) continue; // rien de nouveau ici
      // Type désactivé globalement (Exploitation → Notifications) → on n'alerte pas.
      const settingKey = notifSettingKey(n, spaceKey);
      if (settingKey && !isNotifTypeEnabled(settingKey)) continue;
      // Déjà couvert par le Web Push → pas de notif locale (évite le doublon push + local).
      if (pushActive && isPushedType(n, spaceKey)) continue;
      // Message sans page dédiée → ouvrir la cloche (racine d'espace + marqueur).
      const isMsg = n.messages?.length > 0 && !n.to;
      notifyLocal(n.title, {
        body: n.description || '',
        url: isMsg ? SPACE_ROOTS[spaceKey] : (n.to || undefined),
        openBell: isMsg,
        tag: n.key,
      });
      fired++;
    }
  }
  saveSeen(spaceKey, sigs);
}

// ── Descripteurs de surveillance (permet de continuer à notifier hors de la page) ──
// Chaque espace enregistre { context, ts } pendant qu'il est ouvert. La surveillance
// globale (Layout) rejoue ces descripteurs → notifications même sur l'accueil / un autre
// espace. TTL de sécurité : au-delà, on cesse (ex. session oubliée). La déconnexion
// appelle clearNotifWatch pour couper immédiatement.
const WATCH_KEY = 'notif_watch';
const WATCH_TTL_MS = 12 * 60 * 60 * 1000;

export const writeNotifWatch = (spaceKey, context = {}) => {
  if (!spaceKey) return;
  try {
    const map = JSON.parse(localStorage.getItem(WATCH_KEY) || '{}');
    map[spaceKey] = { context: context || {}, ts: Date.now() };
    localStorage.setItem(WATCH_KEY, JSON.stringify(map));
  } catch { /* quota / indisponible */ }
};

export const clearNotifWatch = (spaceKey) => {
  try {
    const map = JSON.parse(localStorage.getItem(WATCH_KEY) || '{}');
    if (map[spaceKey]) { delete map[spaceKey]; localStorage.setItem(WATCH_KEY, JSON.stringify(map)); }
  } catch { /* ignore */ }
};

const readNotifWatches = () => {
  try {
    const map = JSON.parse(localStorage.getItem(WATCH_KEY) || '{}');
    const now = Date.now();
    return Object.entries(map)
      .filter(([, v]) => v && now - (v.ts || 0) < WATCH_TTL_MS)
      .map(([spaceKey, v]) => ({ spaceKey, context: v.context || {} }));
  } catch { return []; }
};

/**
 * Hook par-espace : alimente la cloche (état `notifications`) ET maintient à jour le
 * descripteur de surveillance globale. Le déclenchement des notifs OS est mutualisé
 * avec la surveillance globale via fireLocalForNew (dédup persistée partagée).
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

  const refresh = useCallback(() => {
    if (!enabled || !spaceKey) return;
    computeSpaceNotifications(spaceKey, ctxRef.current).then((list) => {
      fireLocalForNew(spaceKey, list);
      // Maintient vivant le descripteur de surveillance globale (ts rafraîchi).
      writeNotifWatch(spaceKey, ctxRef.current);
      setNotifications(list);
    }).catch(() => {});
  }, [enabled, spaceKey]);

  useEffect(() => {
    if (!enabled || !spaceKey) {
      setNotifications([]);
      return undefined;
    }
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    // Rafraîchit immédiatement au retour sur l'onglet / reconnexion (quasi temps réel).
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, spaceKey, ctxKey]);

  // ── Temps réel (Supabase Realtime) ────────────────────────────────────────────
  // Sur tout changement d'une table source, on rafraîchit (débouncé) → notification
  // quasi immédiate. Repli automatique sur le sondage 30 s si Realtime indisponible.
  useEffect(() => {
    if (!enabled || !spaceKey) return undefined;
    let timer;
    const debounced = () => { clearTimeout(timer); timer = setTimeout(() => refresh(), 800); };
    const channel = supabase.channel(`notif-${spaceKey}-${Math.random().toString(36).slice(2, 8)}`);
    REALTIME_TABLES.forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounced));
    channel.subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, spaceKey, ctxKey]);

  const totalCount = useMemo(
    () => notifications.reduce((sum, n) => sum + (n.count || 0), 0),
    [notifications]
  );

  return { notifications, totalCount, refresh };
}

/**
 * Surveillance GLOBALE (à monter UNE fois dans Layout).
 * Rejoue les descripteurs de surveillance persistés par chaque espace ouvert → les
 * notifications OS continuent de se déclencher sur l'accueil, dans un autre espace, ou
 * onglet en arrière-plan (tant que l'app tourne). ⚠ App totalement fermée = Web Push requis.
 */
export function useGlobalNotificationWatcher() {
  useEffect(() => {
    // Rien à faire si le navigateur ne gère pas les notifications.
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;
    let cancelled = false;
    let timer;

    const runOnce = async () => {
      if (!isLocalNotifEnabled()) return;
      const watches = readNotifWatches();
      for (const { spaceKey, context } of watches) {
        try {
          const list = await computeSpaceNotifications(spaceKey, context);
          if (cancelled) return;
          await fireLocalForNew(spaceKey, list);
        } catch { /* espace ignoré */ }
      }
    };

    runOnce();
    const interval = setInterval(runOnce, REFRESH_MS);
    const debounced = () => { clearTimeout(timer); timer = setTimeout(runOnce, 800); };
    const channel = supabase.channel(`notif-global-${Math.random().toString(36).slice(2, 8)}`);
    REALTIME_TABLES.forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounced));
    channel.subscribe();

    const onVisible = () => { if (document.visibilityState === 'visible') runOnce(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', runOnce);
    window.addEventListener('online', runOnce);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', runOnce);
      window.removeEventListener('online', runOnce);
    };
  }, []);
}

export default useSpaceNotifications;
