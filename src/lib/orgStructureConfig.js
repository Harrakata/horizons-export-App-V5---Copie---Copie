import { supabase } from './supabaseClient';

// ════════════════════════════════════════════════════════════════════════════
//  Structure organisationnelle (multi-tenant)
//
//  La hiérarchie « région → secteur → agence → guichetière » n'est pas identique
//  d'un client à l'autre. Ce module rend la STRUCTURE configurable par client,
//  en parallèle du branding (clientConfig.js) et des fonctionnalités
//  (functionalites_espaces). Comme chaque client a sa propre base, la config est
//  stockée dans app_settings/org_structure et naturellement par-client.
//
//  Deux axes pour l'instant (extensible) :
//   1. secteur.enabled        → le niveau « secteur » existe-t-il dans la hiérarchie ?
//   2. guichetiere.agenceRequired → une guichetière doit-elle être rattachée à une agence ?
//
//  Défauts = comportement historique (secteur actif, agence requise) → un client
//  qui n'a rien configuré n'est pas impacté.
//
//  Voir useFeatureFlags.jsx qui unifie lecture du branding + fonctionnalités +
//  structure et expose les hooks React (useOrgStructure, useSecteurEnabled…).
// ════════════════════════════════════════════════════════════════════════════

export const ORG_STRUCTURE_SETTINGS_KEY = 'org_structure';
const ORG_STRUCTURE_CACHE_KEY = 'org_structure_cache';

// ── Override env (kill-switch de déploiement) ──────────────────────────────────
// VITE_HIERARCHY_SECTEUR=off  → force la désactivation du niveau secteur.
// Priorité ABSOLUE sur la configuration en base (utile pour couper net en prod).
const ENV_SECTEUR_DISABLED =
  String(import.meta.env.VITE_HIERARCHY_SECTEUR || '').trim().toLowerCase() === 'off';

// Modes de rattachement d'une guichetière à une agence.
//  - required : agence obligatoire (comportement historique)
//  - optional : agence facultative (champ visible, valeur nullable)
//  - hidden   : pas de rattachement — le champ Agence est masqué partout
export const GUICHETIERE_AGENCE_MODES = {
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  HIDDEN: 'hidden',
};
const AGENCE_MODE_VALUES = Object.values(GUICHETIERE_AGENCE_MODES);

// ── Structure par défaut = comportement historique ─────────────────────────────
export const DEFAULT_ORG_STRUCTURE = {
  secteur: { enabled: true },
  guichetiere: { agenceMode: GUICHETIERE_AGENCE_MODES.REQUIRED },
};

/** Résout le mode de rattachement agence, avec rétrocompat de l'ancien booléen. */
const normalizeAgenceMode = (guichetiere) => {
  const mode = guichetiere?.agenceMode;
  if (AGENCE_MODE_VALUES.includes(mode)) return mode;
  // Rétrocompat : ancienne config booléenne `agenceRequired`.
  if (typeof guichetiere?.agenceRequired === 'boolean') {
    return guichetiere.agenceRequired ? GUICHETIERE_AGENCE_MODES.REQUIRED : GUICHETIERE_AGENCE_MODES.OPTIONAL;
  }
  return DEFAULT_ORG_STRUCTURE.guichetiere.agenceMode;
};

/** Fusionne une config partielle avec les défauts (deep merge des 2 axes connus). */
const normalizeOrgStructure = (raw) => {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    secteur: {
      enabled:
        typeof value?.secteur?.enabled === 'boolean'
          ? value.secteur.enabled
          : DEFAULT_ORG_STRUCTURE.secteur.enabled,
    },
    guichetiere: {
      agenceMode: normalizeAgenceMode(value?.guichetiere),
    },
  };
};

/** Applique les overrides env (kill-switch) à une structure normalisée. */
const applyOrgStructureEnvOverrides = (structure) => {
  if (!ENV_SECTEUR_DISABLED) return structure;
  return { ...structure, secteur: { ...structure.secteur, enabled: false } };
};

// ── Lecture synchrone (cache + défaut + override env) ──────────────────────────
const readOrgStructureCache = () => {
  try {
    const cached = localStorage.getItem(ORG_STRUCTURE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

let _orgStructure = applyOrgStructureEnvOverrides(
  normalizeOrgStructure(readOrgStructureCache() || DEFAULT_ORG_STRUCTURE)
);

/** Structure organisationnelle courante (lecture synchrone). */
export const getOrgStructure = () => _orgStructure;

// ── Helpers de décision ────────────────────────────────────────────────────────
export const isSecteurEnabled = (structure = _orgStructure) =>
  structure?.secteur?.enabled !== false;

/** Mode de rattachement agence courant : 'required' | 'optional' | 'hidden'. */
export const getGuichetiereAgenceMode = (structure = _orgStructure) =>
  normalizeAgenceMode(structure?.guichetiere);

export const isGuichetiereAgenceRequired = (structure = _orgStructure) =>
  getGuichetiereAgenceMode(structure) === GUICHETIERE_AGENCE_MODES.REQUIRED;

/** Le champ/colonne Agence doit-il être affiché ? (faux en mode 'hidden'). */
export const isGuichetiereAgenceVisible = (structure = _orgStructure) =>
  getGuichetiereAgenceMode(structure) !== GUICHETIERE_AGENCE_MODES.HIDDEN;

// ── Synchronisation depuis Supabase ────────────────────────────────────────────
export const loadOrgStructure = async () => {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', ORG_STRUCTURE_SETTINGS_KEY)
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      _orgStructure = applyOrgStructureEnvOverrides(normalizeOrgStructure(data.value));
      try {
        localStorage.setItem(ORG_STRUCTURE_CACHE_KEY, JSON.stringify(normalizeOrgStructure(data.value)));
      } catch { /* quota dépassé */ }
    }
  } catch {
    // Échec silencieux : on conserve cache + défaut.
  }
  return getOrgStructure();
};

/** Persiste la structure organisationnelle (réservé à l'admin exploitation). */
export const saveOrgStructure = async (partial) => {
  // Fusionne par-dessus la valeur courante (sans l'override env, qui n'est pas persisté).
  const merged = normalizeOrgStructure({
    secteur: { ...getOrgStructure().secteur, ...(partial?.secteur || {}) },
    guichetiere: { ...getOrgStructure().guichetiere, ...(partial?.guichetiere || {}) },
  });

  // Pattern select-then-update/insert (cohérent avec saveClientBranding : la table
  // app_settings n'a pas de contrainte unique garantie sur `key`).
  const { data: existing } = await supabase
    .from('app_settings')
    .select('id')
    .eq('key', ORG_STRUCTURE_SETTINGS_KEY)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('app_settings').update({ value: merged }).eq('id', existing.id)
    : await supabase.from('app_settings').insert({ key: ORG_STRUCTURE_SETTINGS_KEY, value: merged });
  if (error) throw error;

  _orgStructure = applyOrgStructureEnvOverrides(merged);
  try {
    localStorage.setItem(ORG_STRUCTURE_CACHE_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
  return getOrgStructure();
};
