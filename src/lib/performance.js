import { publicSupabase, supabase } from '@/lib/supabaseClient';

// ════════════════════════════════════════════════════════════════════════════
//  Performance — agrégats « cible vs réalisé » par guichetière / agence.
//
//  Réutilise les sources du moteur existant (SalaireGuichetiereTab) sans le
//  dupliquer : CA réalisé depuis CCOPE (operateur = codePrepose, somme mt_enr),
//  annulés (mt_anc/ane/anm/ans), versements (versements_guichetieres), assiduité
//  (pointages vs planning), et les objectifs (objectifs_salaire, period 'mois').
//
//  ⚠ Les métriques purement « salaire » (salaire/prime/pénalité) restent dans
//  l'onglet Salaire (elles dépendent du moteur de paie complet).
// ════════════════════════════════════════════════════════════════════════════

const ccopeTable = () => publicSupabase.schema('public').from('cln_fnir_ccope');
const annuleOf = (r) => (Number(r.mt_anc) || 0) + (Number(r.mt_ane) || 0) + (Number(r.mt_anm) || 0) + (Number(r.mt_ans) || 0);

/** Récupère toutes les opérations CCOPE de la période (paginé). */
const fetchCcopeRange = async (start, end) => {
  const PAGE = 1000;
  let off = 0;
  const rows = [];
  while (true) {
    const { data, error } = await ccopeTable()
      .select('operateur, mt_enr, mt_anc, mt_ane, mt_anm, mt_ans, date_op')
      .gte('date_op', start)
      .lte('date_op', `${end}T23:59:59.999Z`)
      .order('date_op', { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) break;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
    off += PAGE;
  }
  return rows;
};

/** Taux d'atteinte (réalisé / objectif), borné, ou null si pas d'objectif. */
export const atteinte = (realise, objectif) => {
  const o = Number(objectif);
  if (!Number.isFinite(o) || o <= 0) return null;
  return (Number(realise) || 0) / o;
};

/**
 * Calcule la performance sur une période [start, end] (mois) pour un périmètre
 * d'agences (agenceNames = null/[] → toutes).
 * @returns { guichRows, agenceRows }
 */
export const computePerformance = async ({ start, end, agenceNames }) => {
  const scope = Array.isArray(agenceNames) && agenceNames.length ? new Set(agenceNames) : null;
  const inScope = (agence) => !scope || scope.has(agence);

  const [{ data: guichetieres }, ccopeRows, { data: versements }, { data: pointages }, { data: planning }, { data: objectifs }] =
    await Promise.all([
      supabase.from('guichetieres').select('id, codePrepose, matricule, nom, prenom, agenceAssigne').eq('is_current', true),
      fetchCcopeRange(start, end),
      supabase.from('versements_guichetieres').select('guichetiere_code, montant, date_versement').gte('date_versement', start).lte('date_versement', end),
      supabase.from('pointages').select('guichetiereMatricule, date').gte('date', start).lte('date', end).not('geo_refused', 'is', true),
      supabase.from('planning').select('guichetiereId, date').gte('date', start).lte('date', end),
      supabase.from('objectifs_salaire').select('level, target_key, metric, target_value, period_type').eq('period_type', 'mois'),
    ]);

  const byCode = new Map();
  const byId = new Map();
  const byMat = new Map();
  (guichetieres || []).forEach((g) => {
    if (g.codePrepose) byCode.set(String(g.codePrepose).trim(), g);
    if (g.id != null) byId.set(String(g.id), g);
    if (g.matricule) byMat.set(g.matricule, g);
  });

  const acc = new Map(); // codePrepose -> agrégat
  const ensure = (g) => {
    const key = g.codePrepose;
    if (!acc.has(key)) acc.set(key, { g, ca: 0, annule: 0, verse: 0, pointes: new Set(), planifies: new Set() });
    return acc.get(key);
  };

  ccopeRows.forEach((r) => {
    const g = byCode.get(String(r.operateur ?? '').trim());
    if (!g || !inScope(g.agenceAssigne)) return;
    const a = ensure(g);
    a.ca += Number(r.mt_enr) || 0;
    a.annule += annuleOf(r);
  });
  (versements || []).forEach((v) => {
    const g = byCode.get(String(v.guichetiere_code ?? '').trim());
    if (!g || !inScope(g.agenceAssigne)) return;
    ensure(g).verse += Number(v.montant) || 0;
  });
  (pointages || []).forEach((p) => {
    const g = byMat.get(p.guichetiereMatricule);
    if (!g || !inScope(g.agenceAssigne)) return;
    ensure(g).pointes.add(p.date);
  });
  (planning || []).forEach((p) => {
    const g = byId.get(String(p.guichetiereId));
    if (!g || !inScope(g.agenceAssigne)) return;
    ensure(g).planifies.add(p.date);
  });

  const targetFor = (level, key, metric) => {
    const o = (objectifs || []).find((x) => x.level === level && x.target_key === key && x.metric === metric);
    return o ? Number(o.target_value) || 0 : null;
  };

  const guichRows = [...acc.values()].map((a) => {
    const joursPointes = a.pointes.size;
    const joursPlanifies = a.planifies.size;
    return {
      codePrepose: a.g.codePrepose,
      nom: [a.g.prenom, a.g.nom].filter(Boolean).join(' ') || a.g.codePrepose,
      agence: a.g.agenceAssigne || '—',
      ca: a.ca,
      annule: a.annule,
      caNet: a.ca - a.annule,
      verse: a.verse,
      joursPointes,
      joursPlanifies,
      assiduite: joursPlanifies > 0 ? joursPointes / joursPlanifies : null,
      objCa: targetFor('guichetiere', a.g.codePrepose, 'mt_enr'),
      objVerse: targetFor('guichetiere', a.g.codePrepose, 'mt_verse'),
    };
  });

  const agMap = new Map();
  guichRows.forEach((r) => {
    if (!agMap.has(r.agence)) agMap.set(r.agence, { agence: r.agence, ca: 0, caNet: 0, annule: 0, verse: 0, pointes: 0, planifies: 0, count: 0 });
    const a = agMap.get(r.agence);
    a.ca += r.ca; a.caNet += r.caNet; a.annule += r.annule; a.verse += r.verse;
    a.pointes += r.joursPointes; a.planifies += r.joursPlanifies; a.count += 1;
  });
  const agenceRows = [...agMap.values()].map((a) => ({
    ...a,
    assiduite: a.planifies > 0 ? a.pointes / a.planifies : null,
    objCa: targetFor('agence', a.agence, 'mt_enr'),
    objVerse: targetFor('agence', a.agence, 'mt_verse'),
  }));

  return { guichRows, agenceRows };
};
