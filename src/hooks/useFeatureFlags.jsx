import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  APP_SPACE_SETTINGS_KEY,
  buildDefaultAppSpaceFunctionalities,
  normalizeAppSpaceFunctionalities,
} from '@/lib/exploitationProfiles';
import {
  getClientConfig,
  loadClientBranding,
  saveClientBranding,
  applyFeatureEnvOverrides,
} from '@/lib/clientConfig';
import {
  getOrgStructure,
  loadOrgStructure,
  saveOrgStructure,
  isSecteurEnabled,
  isGuichetiereAgenceRequired,
  isGuichetiereAgenceVisible,
  getGuichetiereAgenceMode,
} from '@/lib/orgStructureConfig';

// ════════════════════════════════════════════════════════════════════════════
//  Feature flags + identité client (multi-tenant) — couche unifiée
//
//  ⚠ Une seule SOURCE DE VÉRITÉ pour les bascules de fonctionnalités : le système
//  existant `functionalites_espaces` (cf. exploitationProfiles.js). Ce hook ne fait
//  que le LIRE et y appliquer par-dessus l'override env (kill-switch déploiement).
//   - Layout.jsx charge `functionalites_espaces` depuis Supabase au boot, écrit le
//     localStorage et émet 'app-functionalities-updated'.
//   - Ce provider s'initialise depuis le même localStorage et écoute le même event.
//  Il n'effectue donc PAS de second fetch des fonctionnalités (pas de doublon).
//
//  Le branding client (nom/logo) est chargé en plus depuis app_settings/client_branding.
//
//  Usage :
//    const visible = useFeature('ccope');           // bool (override env inclus)
//    const { client } = useFeatureFlags();          // { id, name, displayName, logoUrl }
// ════════════════════════════════════════════════════════════════════════════

const readFunctionalitiesFromCache = () => {
  try {
    return normalizeAppSpaceFunctionalities(
      JSON.parse(window.localStorage.getItem(APP_SPACE_SETTINGS_KEY) || '{}')
    );
  } catch {
    return buildDefaultAppSpaceFunctionalities();
  }
};

const FeatureFlagsContext = createContext({
  flags: applyFeatureEnvOverrides(buildDefaultAppSpaceFunctionalities()),
  client: getClientConfig(),
  org: getOrgStructure(),
  isLoaded: false,
  setBranding: async () => {},
  setOrgStructure: async () => {},
});

export const FeatureFlagsProvider = ({ children }) => {
  // Fonctionnalités : init synchrone depuis le cache (override env appliqué).
  const [flags, setFlags] = useState(() =>
    applyFeatureEnvOverrides(readFunctionalitiesFromCache())
  );
  const [client, setClient] = useState(() => getClientConfig());
  const [org, setOrg] = useState(() => getOrgStructure());
  const [isLoaded, setIsLoaded] = useState(false);

  // Suit les mises à jour du système existant (émises par Layout / page admin).
  useEffect(() => {
    const handler = (event) => {
      setFlags(applyFeatureEnvOverrides(normalizeAppSpaceFunctionalities(event.detail)));
    };
    window.addEventListener('app-functionalities-updated', handler);
    return () => window.removeEventListener('app-functionalities-updated', handler);
  }, []);

  // Charge le branding client + la structure organisationnelle depuis Supabase
  // (en plus des fonctionnalités).
  useEffect(() => {
    let active = true;
    Promise.all([
      loadClientBranding().then((cfg) => { if (active) setClient(cfg); }),
      loadOrgStructure().then((structure) => { if (active) setOrg(structure); }),
    ]).finally(() => { if (active) setIsLoaded(true); });
    return () => { active = false; };
  }, []);

  // Édite le branding client (réservé à l'admin exploitation).
  const setBranding = useCallback(async (partial) => {
    const cfg = await saveClientBranding(partial);
    setClient(cfg);
    return cfg;
  }, []);

  // Édite la structure organisationnelle (réservé à l'admin exploitation).
  const setOrgStructure = useCallback(async (partial) => {
    const structure = await saveOrgStructure(partial);
    setOrg(structure);
    return structure;
  }, []);

  const value = { flags, client, org, isLoaded, setBranding, setOrgStructure };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

/** Accès complet : { flags, client, isLoaded, setBranding }. */
export const useFeatureFlags = () => useContext(FeatureFlagsContext);

/** Raccourci : une fonctionnalité est-elle active ? (override env inclus) */
export const useFeature = (key) => {
  const { flags } = useContext(FeatureFlagsContext);
  return flags[key] !== false;
};

/** Identité/branding du client courant : { id, name, displayName, logoUrl }. */
export const useClient = () => useContext(FeatureFlagsContext).client;

/** Structure organisationnelle courante : { secteur: {enabled}, guichetiere: {agenceRequired} }. */
export const useOrgStructure = () => useContext(FeatureFlagsContext).org;

/** Raccourci : le niveau « secteur » est-il actif dans la hiérarchie ? */
export const useSecteurEnabled = () =>
  isSecteurEnabled(useContext(FeatureFlagsContext).org);

/** Raccourci : une guichetière doit-elle être rattachée à une agence ? */
export const useGuichetiereAgenceRequired = () =>
  isGuichetiereAgenceRequired(useContext(FeatureFlagsContext).org);

/** Raccourci : le champ/colonne Agence des guichetières est-il visible ? */
export const useGuichetiereAgenceVisible = () =>
  isGuichetiereAgenceVisible(useContext(FeatureFlagsContext).org);

/** Raccourci : mode de rattachement agence ('required' | 'optional' | 'hidden'). */
export const useGuichetiereAgenceMode = () =>
  getGuichetiereAgenceMode(useContext(FeatureFlagsContext).org);

/**
 * Composant utilitaire : n'affiche `children` que si la fonctionnalité est active.
 *   <FeatureGate feature="ccope"><CcopePage /></FeatureGate>
 */
export const FeatureGate = ({ feature, children, fallback = null }) => {
  const enabled = useFeature(feature);
  return enabled ? children : fallback;
};

export default useFeatureFlags;
