// ════════════════════════════════════════════════════════════════════════════
//  Service de rapports — Centre de rapports exportables (Lot 1 + Lot 2)
//
//  Source de vérité des rapports + exécution des requêtes.
//  Chaque rapport expose : { key, label, scopes, columns?, run(filters) }.
//   - scopes  : rôles autorisés à voir/exécuter le rapport
//               ('exploitation' | 'chef-agence' | 'chef-secteur').
//   - columns : colonnes fixes passées aux exporteurs (cf. exporters.js).
//               Si omis, run() renvoie { columns, rows } (colonnes dynamiques).
//   - run(filters) : filters = { start, end, agenceNames? }.
//               agenceNames = liste de noms d'agences pour restreindre le
//               périmètre (null/vide = toutes les agences accessibles).
//               Renvoie soit un tableau de lignes, soit { columns, rows }.
// ════════════════════════════════════════════════════════════════════════════

import { publicSupabase, supabase } from './supabaseClient';

export const REPORT_SCOPES = {
  EXPLOITATION: 'exploitation',
  CHEF_AGENCE: 'chef-agence',
  CHEF_SECTEUR: 'chef-secteur',
};

const ALL_AGENCE_SCOPES = [
  REPORT_SCOPES.EXPLOITATION,
  REPORT_SCOPES.CHEF_AGENCE,
  REPORT_SCOPES.CHEF_SECTEUR,
];

const fmtMontant = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('fr-FR') : '';
};
const fullName = (prenom, nom) => [prenom, nom].filter(Boolean).join(' ').trim();
const hasNames = (agenceNames) => Array.isArray(agenceNames) && agenceNames.length > 0;

/** Liste des agences courantes (nom, région, secteur, id) — base des filtres. */
export const fetchAgences = async () => {
  const { data, error } = await supabase
    .from('agences')
    .select('id, nom, region, secteur')
    .eq('is_current', true)
    .order('nom', { ascending: true });
  if (error) throw error;
  return (data || []).filter((a) => a.nom);
};

// ── Rapport : Planning général ─────────────────────────────────────────────────
const planningReport = {
  key: 'planning',
  label: 'Planning général',
  scopes: ALL_AGENCE_SCOPES,
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'agence', label: 'Agence' },
    { key: 'matricule', label: 'Matricule' },
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
  ],
  async run({ start, end, agenceNames }) {
    let query = supabase
      .from('planning')
      .select('date, agenceNom, guichetieres ( nom, prenom, matricule )')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    if (hasNames(agenceNames)) query = query.in('agenceNom', agenceNames);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((p) => ({
      date: p.date,
      agence: p.agenceNom,
      matricule: p.guichetieres?.matricule || '',
      nom: p.guichetieres?.nom || '',
      prenom: p.guichetieres?.prenom || '',
    }));
  },
};

// ── Rapport : Pointages / présence ──────────────────────────────────────────────
const pointagesReport = {
  key: 'pointages',
  label: 'Pointages / présence',
  scopes: ALL_AGENCE_SCOPES,
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'heure', label: 'Heure' },
    { key: 'agence', label: 'Agence' },
    { key: 'matricule', label: 'Matricule' },
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'gps', label: 'Contrôle GPS' },
  ],
  async run({ start, end, agenceNames }) {
    let query = supabase
      .from('pointages')
      .select('date, time, guichetiereMatricule, agence, geo_verified, geo_refused')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (hasNames(agenceNames)) query = query.in('agence', agenceNames);

    const [{ data, error }, { data: guichetieres }] = await Promise.all([
      query,
      supabase.from('guichetieres').select('matricule, nom, prenom').eq('is_current', true),
    ]);
    if (error) throw error;

    const nameByMatricule = new Map((guichetieres || []).map((g) => [g.matricule, g]));
    return (data || []).map((p) => {
      const g = nameByMatricule.get(p.guichetiereMatricule) || {};
      return {
        date: p.date,
        heure: p.time || '',
        agence: p.agence || '',
        matricule: p.guichetiereMatricule || '',
        nom: g.nom || '',
        prenom: g.prenom || '',
        gps: p.geo_refused ? 'Refusé' : p.geo_verified ? 'Vérifié' : '—',
      };
    });
  },
};

// ── Rapport : État de caisse (versements guichetières) ──────────────────────────
const caisseReport = {
  key: 'caisse',
  label: 'État de caisse (versements)',
  scopes: ALL_AGENCE_SCOPES,
  columns: [
    { key: 'date', label: 'Date versement' },
    { key: 'agence', label: 'Agence' },
    { key: 'code', label: 'Code préposé' },
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'montant', label: 'Montant versé', format: fmtMontant },
  ],
  async run({ start, end, agenceNames }) {
    const { data: guichetieres } = await supabase
      .from('guichetieres')
      .select('codePrepose, nom, prenom, agenceAssigne')
      .eq('is_current', true);
    const byCode = new Map((guichetieres || []).map((g) => [g.codePrepose, g]));

    let allowedCodes = null;
    if (hasNames(agenceNames)) {
      const set = new Set(agenceNames);
      allowedCodes = (guichetieres || [])
        .filter((g) => set.has(g.agenceAssigne))
        .map((g) => g.codePrepose);
      if (allowedCodes.length === 0) return []; // aucune guichetière dans le périmètre
    }

    let query = supabase
      .from('versements_guichetieres')
      .select('guichetiere_code, date_versement, montant')
      .gte('date_versement', start)
      .lte('date_versement', end)
      .order('date_versement', { ascending: true });
    if (allowedCodes) query = query.in('guichetiere_code', allowedCodes);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((v) => {
      const g = byCode.get(v.guichetiere_code) || {};
      return {
        date: v.date_versement,
        agence: g.agenceAssigne || '',
        code: v.guichetiere_code || '',
        nom: g.nom || '',
        prenom: g.prenom || '',
        montant: v.montant,
      };
    });
  },
};

// ── Rapport : Maintenance terminaux (interventions) ─────────────────────────────
const maintenanceReport = {
  key: 'maintenance',
  label: 'Maintenance terminaux',
  scopes: ALL_AGENCE_SCOPES,
  columns: [
    { key: 'date', label: 'Date intervention' },
    { key: 'agence', label: 'Agence' },
    { key: 'terminal', label: 'Terminal' },
    { key: 'type', label: 'Type' },
    { key: 'sousEnsemble', label: 'Sous-ensemble' },
    { key: 'statut', label: 'Statut' },
    { key: 'technicien', label: 'Technicien' },
    { key: 'dateFin', label: 'Date fin' },
  ],
  async run({ start, end, agenceNames }) {
    const [{ data: agences }, { data: terminaux }, { data: techniciens }] = await Promise.all([
      supabase.from('agences').select('id, nom').eq('is_current', true),
      supabase.from('terminaux').select('id, reference, agence_id'),
      supabase.from('techniciens').select('id, nom, prenom'),
    ]);
    const agenceNameById = new Map((agences || []).map((a) => [a.id, a.nom]));
    const terminalById = new Map((terminaux || []).map((t) => [t.id, t]));
    const technicienById = new Map((techniciens || []).map((t) => [t.id, t]));

    let allowedTerminalIds = null;
    if (hasNames(agenceNames)) {
      const nameSet = new Set(agenceNames);
      const agenceIds = new Set((agences || []).filter((a) => nameSet.has(a.nom)).map((a) => a.id));
      allowedTerminalIds = (terminaux || [])
        .filter((t) => agenceIds.has(t.agence_id))
        .map((t) => t.id);
      if (allowedTerminalIds.length === 0) return [];
    }

    let query = supabase
      .from('interventions_maintenance')
      .select('terminal_id, type_intervention, sous_ensemble, statut, date_intervention, date_fin, technicien_id')
      .gte('date_intervention', start)
      .lte('date_intervention', end)
      .order('date_intervention', { ascending: true });
    if (allowedTerminalIds) query = query.in('terminal_id', allowedTerminalIds);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((i) => {
      const terminal = terminalById.get(i.terminal_id) || {};
      const tech = technicienById.get(i.technicien_id) || {};
      return {
        date: i.date_intervention,
        agence: agenceNameById.get(terminal.agence_id) || '',
        terminal: terminal.reference || '',
        type: i.type_intervention || '',
        sousEnsemble: i.sous_ensemble || '',
        statut: i.statut || '',
        technicien: fullName(tech.prenom, tech.nom),
        dateFin: i.date_fin || '',
      };
    });
  },
};

// ── Rapport : Paiement gros gains ───────────────────────────────────────────────
const paiementGainReport = {
  key: 'paiement-gain',
  label: 'Paiement gros gains',
  scopes: ALL_AGENCE_SCOPES,
  columns: [
    { key: 'code', label: 'Code demande' },
    { key: 'dateCourse', label: 'Date course' },
    { key: 'agence', label: 'Agence origine' },
    { key: 'gagnant', label: 'Gagnant' },
    { key: 'ticket', label: 'Ticket' },
    { key: 'montant', label: 'Montant', format: fmtMontant },
    { key: 'mode', label: 'Mode paiement' },
    { key: 'statut', label: 'Statut' },
    { key: 'datePaiement', label: 'Date paiement' },
  ],
  async run({ start, end, agenceNames }) {
    let query = supabase
      .from('demandes_paiement_gain')
      .select('codeDemande, dateCourse, agenceOrigineNom, nomGagnant, prenomGagnant, numeroTicketGagnant, montantGain, modePaiement, statutGlobal, datePaiementFinal')
      .gte('dateCourse', start)
      .lte('dateCourse', end)
      .order('dateCourse', { ascending: true });
    if (hasNames(agenceNames)) query = query.in('agenceOrigineNom', agenceNames);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d) => ({
      code: d.codeDemande || '',
      dateCourse: d.dateCourse || '',
      agence: d.agenceOrigineNom || '',
      gagnant: fullName(d.prenomGagnant, d.nomGagnant),
      ticket: d.numeroTicketGagnant || '',
      montant: d.montantGain,
      mode: d.modePaiement || '',
      statut: d.statutGlobal || '',
      datePaiement: d.datePaiementFinal || '',
    }));
  },
};

// ── Rapport : Chiffre d'affaires (CCOPE) ────────────────────────────────────────
//  Extrait brut des opérations CCOPE sur la période (client public dédié).
//  Colonnes dynamiques (schéma externe). Réservé à l'exploitation.
const caReport = {
  key: 'ca',
  label: "Chiffre d'affaires (CCOPE)",
  scopes: [REPORT_SCOPES.EXPLOITATION],
  // columns dynamiques → run renvoie { columns, rows }.
  async run({ start, end }) {
    const { data, error } = await publicSupabase
      .schema('public')
      .from('cln_fnir_ccope')
      .select('*')
      .gte('date_op', start)
      .lte('date_op', `${end}T23:59:59.999Z`)
      .order('date_op', { ascending: false })
      .range(0, 4999); // garde-fou : 5000 lignes max par export
    if (error) throw error;
    const rows = data || [];
    const keys = rows.length ? Object.keys(rows[0]) : ['date_op'];
    const columns = keys.map((k) => ({ key: k, label: k }));
    return { columns, rows };
  },
};

export const REPORTS = [
  planningReport,
  pointagesReport,
  caisseReport,
  maintenanceReport,
  paiementGainReport,
  caReport,
];

export const getReport = (key) => REPORTS.find((r) => r.key === key) || null;

/** Rapports disponibles pour un périmètre donné. */
export const getReportsForScope = (scope) =>
  REPORTS.filter((r) => r.scopes.includes(scope));

/**
 * Exécute un rapport et renvoie { columns, rows, label }.
 * @throws si le rapport est inconnu ou la requête échoue.
 */
export const runReport = async (key, filters) => {
  const report = getReport(key);
  if (!report) throw new Error(`Rapport inconnu : ${key}`);
  const out = await report.run(filters);
  const rows = Array.isArray(out) ? out : out.rows;
  const columns = report.columns || out.columns;
  return { columns, rows, label: report.label };
};
