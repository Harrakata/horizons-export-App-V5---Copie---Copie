import { supabase } from './supabaseClient';
import { APP_SPACE_FUNCTIONALITIES } from './exploitationProfiles';

// ════════════════════════════════════════════════════════════════════════════
//  Configuration client (multi-tenant)
//
//  Chaque client dispose de son PROPRE projet Supabase + son PROPRE déploiement.
//  Ce module ne gère QUE ce qui est spécifique au multi-tenant et qui n'existe
//  pas déjà dans l'application :
//   1. L'identité + le branding du client (nom, logo) — variables d'env du
//      déploiement, avec surcharge éditable en base (app_settings/client_branding).
//   2. L'override des fonctionnalités au niveau DÉPLOIEMENT (kill-switch env).
//
//  ⚠ Les bascules de fonctionnalités (activer/désactiver des modules) NE sont PAS
//  redéfinies ici : elles s'appuient sur le système existant `functionalites_espaces`
//  (cf. exploitationProfiles.js + page « Profil et Fonctionnalité »). Comme chaque
//  client a sa propre base, ce système est déjà naturellement par-client.
//  Voir useFeatureFlags.jsx qui unifie lecture des fonctionnalités + override env.
// ════════════════════════════════════════════════════════════════════════════

// ── Identité du client (déploiement) ───────────────────────────────────────────
export const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'default';
export const CLIENT_NAME = import.meta.env.VITE_CLIENT_NAME || 'PMU';
const ENV_LOGO_URL = import.meta.env.VITE_CLIENT_LOGO_URL || '';

// Nom du bucket de stockage Supabase (photos de profils, pièces jointes, signatures…).
// Configurable par déploiement ; défaut historique = 'pmu-mali-storage'.
export const STORAGE_BUCKET = import.meta.env.VITE_STORAGE_BUCKET || 'pmu-mali-storage';

// Branding éditable en base (surcharge l'env). Stocké dans app_settings.
export const CLIENT_BRANDING_SETTINGS_KEY = 'client_branding';
const BRANDING_CACHE_KEY = 'client_branding_cache';

// ── Override env des fonctionnalités (kill-switch de déploiement) ───────────────
// VITE_FEATURES_DISABLED="ccope,powerbi"  → force ces fonctionnalités à false.
// VITE_FEATURES_ENABLED="ccope"           → force ces fonctionnalités à true.
// Priorité ABSOLUE sur la configuration en base (utile pour couper net en prod).
// Les clés référencent le catalogue existant (APP_SPACE_FUNCTIONALITIES).
const VALID_FEATURE_KEYS = new Set(APP_SPACE_FUNCTIONALITIES.map((f) => f.key));

const parseFeatureList = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((k) => VALID_FEATURE_KEYS.has(k));

export const ENV_FEATURES_DISABLED = parseFeatureList(import.meta.env.VITE_FEATURES_DISABLED);
export const ENV_FEATURES_ENABLED = parseFeatureList(import.meta.env.VITE_FEATURES_ENABLED);

/** Applique l'override env (kill-switch) à une map de fonctionnalités { key: bool }. */
export const applyFeatureEnvOverrides = (functionalities) => {
  const next = { ...functionalities };
  ENV_FEATURES_DISABLED.forEach((k) => { next[k] = false; });
  ENV_FEATURES_ENABLED.forEach((k) => { next[k] = true; });
  return next;
};

// ── Branding : lecture synchrone (cache + env) ─────────────────────────────────
const readBrandingCache = () => {
  try {
    const cached = localStorage.getItem(BRANDING_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

let _branding = {
  displayName: CLIENT_NAME,
  logoUrl: ENV_LOGO_URL,
  ...readBrandingCache(),
};

/** Identité + branding du client courant (lecture synchrone). */
export const getClientConfig = () => ({
  id: CLIENT_ID,
  name: CLIENT_NAME,
  displayName: _branding.displayName || CLIENT_NAME,
  logoUrl: _branding.logoUrl || ENV_LOGO_URL || '',
});

/** Identité/branding figés à l'import (pour usages hors React). */
export const clientConfig = getClientConfig();

// ── Synchronisation du branding depuis Supabase ────────────────────────────────
export const loadClientBranding = async () => {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', CLIENT_BRANDING_SETTINGS_KEY)
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      _branding = {
        displayName: data.value.displayName || CLIENT_NAME,
        logoUrl: data.value.logoUrl || ENV_LOGO_URL,
      };
      try {
        localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(_branding));
      } catch { /* quota dépassé */ }
    }
  } catch {
    // Échec silencieux : on conserve cache + env.
  }
  return getClientConfig();
};

/** Persiste le branding du client (réservé à l'admin exploitation). */
export const saveClientBranding = async ({ displayName, logoUrl }) => {
  const value = {
    displayName: (displayName ?? '').trim() || CLIENT_NAME,
    logoUrl: (logoUrl ?? '').trim(),
  };
  // Pattern select-then-update/insert (cohérent avec le reste de l'app : la
  // table app_settings n'a pas de contrainte unique garantie sur `key`).
  const { data: existing } = await supabase
    .from('app_settings')
    .select('id')
    .eq('key', CLIENT_BRANDING_SETTINGS_KEY)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('app_settings').update({ value }).eq('id', existing.id)
    : await supabase.from('app_settings').insert({ key: CLIENT_BRANDING_SETTINGS_KEY, value });
  if (error) throw error;

  _branding = value;
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(value));
  } catch { /* ignore */ }
  return getClientConfig();
};
