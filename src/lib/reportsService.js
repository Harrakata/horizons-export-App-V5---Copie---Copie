// ════════════════════════════════════════════════════════════════════════════
//  Service de rapports — Centre de rapports exportables (Lot 1)
//
//  Source de vérité des rapports disponibles + exécution des requêtes.
//  Chaque rapport expose : { key, label, columns, run(filters) }.
//   - columns : passées telles quelles aux exporteurs (cf. exporters.js).
//   - run(filters) : renvoie les lignes normalisées (objets indexés par col.key).
//
//  Lot 1 : Planning général + Pointages / présence.
//  Lots suivants : états de caisse, CA, maintenance, paiement gros gains.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabaseClient';

/** Liste des agences (pour le filtre) — agences courantes uniquement. */
export const fetchAgenceNames = async () => {
  const { data, error } = await supabase
    .from('agences')
    .select('nom')
    .eq('is_current', true)
    .order('nom', { ascending: true });
  if (error) throw error;
  return (data || []).map((a) => a.nom).filter(Boolean);
};

// ── Rapport : Planning général ─────────────────────────────────────────────────
const planningReport = {
  key: 'planning',
  label: 'Planning général',
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'agence', label: 'Agence' },
    { key: 'matricule', label: 'Matricule' },
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
  ],
  async run({ start, end, agence }) {
    let query = supabase
      .from('planning')
      .select('date, agenceNom, guichetieres ( nom, prenom, matricule )')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    if (agence) query = query.eq('agenceNom', agence);

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
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'heure', label: 'Heure' },
    { key: 'agence', label: 'Agence' },
    { key: 'matricule', label: 'Matricule' },
    { key: 'nom', label: 'Nom' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'gps', label: 'Contrôle GPS' },
  ],
  async run({ start, end, agence }) {
    let query = supabase
      .from('pointages')
      .select('date, time, guichetiereMatricule, agence, geo_verified, geo_refused')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (agence) query = query.eq('agence', agence);

    const [{ data, error }, { data: guichetieres }] = await Promise.all([
      query,
      supabase.from('guichetieres').select('matricule, nom, prenom').eq('is_current', true),
    ]);
    if (error) throw error;

    const nameByMatricule = new Map(
      (guichetieres || []).map((g) => [g.matricule, g])
    );
    return (data || []).map((p) => {
      const g = nameByMatricule.get(p.guichetiereMatricule) || {};
      const gps = p.geo_refused ? 'Refusé' : p.geo_verified ? 'Vérifié' : '—';
      return {
        date: p.date,
        heure: p.time || '',
        agence: p.agence || '',
        matricule: p.guichetiereMatricule || '',
        nom: g.nom || '',
        prenom: g.prenom || '',
        gps,
      };
    });
  },
};

export const REPORTS = [planningReport, pointagesReport];

export const getReport = (key) => REPORTS.find((r) => r.key === key) || null;

/**
 * Exécute un rapport et renvoie { columns, rows }.
 * @throws si le rapport est inconnu ou la requête échoue.
 */
export const runReport = async (key, filters) => {
  const report = getReport(key);
  if (!report) throw new Error(`Rapport inconnu : ${key}`);
  const rows = await report.run(filters);
  return { columns: report.columns, rows, label: report.label };
};
