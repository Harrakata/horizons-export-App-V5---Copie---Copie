import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FeatureFlagsProvider, useClient } from '@/hooks/useFeatureFlags';
import { loadAndApplyTheme, applyThemeFromCache } from '@/lib/theme';

// Application synchrone immédiate depuis le cache (évite le flash au rechargement)
applyThemeFromCache();

// Synchronisation asynchrone depuis Supabase après montage
const ThemeLoader = () => {
  useEffect(() => { loadAndApplyTheme(); }, []);
  return null;
};

// Aligne le titre d'onglet sur le nom du client (branding éditable en base).
// Complète le titre figé au build (VITE_CLIENT_NAME) avec la valeur à jour.
const ClientTitle = () => {
  const client = useClient();
  useEffect(() => {
    const PRODUCT = 'GestionPDV';
    const name = (client?.displayName || '').trim();
    document.title = name && name !== PRODUCT ? `${PRODUCT} ${name}` : PRODUCT;
  }, [client?.displayName]);
  return null;
};

// ── Lazy-load des pages : permet de séparer chaque route dans son propre chunk
//    Premier chargement réduit, le code d'une page n'est téléchargé qu'à sa première visite.
const PointagePage                          = lazy(() => import('@/pages/PointagePage'));
const EspaceExploitationPage                = lazy(() => import('@/pages/EspaceExploitationPage'));
const EspaceValidationPaiementGainPage      = lazy(() => import('@/pages/EspaceValidationPaiementGainPage'));
const EspaceChefAgencePage                  = lazy(() => import('@/pages/EspaceChefAgencePage'));
const EspaceChefSecteurPage                 = lazy(() => import('@/pages/EspaceChefSecteurPage'));
const EspaceGuichetierePage                 = lazy(() => import('@/pages/EspaceGuichetierePage'));
const EspaceMaintenancePage                 = lazy(() => import('@/pages/EspaceMaintenancePage'));
const PaiementGrosGainPage                  = lazy(() => import('@/pages/PaiementGrosGainPage'));
const PbiViewerPage                         = lazy(() => import('@/pages/PbiViewerPage'));
const ResetPasswordPage                     = lazy(() => import('@/pages/ResetPasswordPage'));

// Exploitation
const AgencesPage                           = lazy(() => import('@/pages/exploitation/AgencesPage'));
const ChefsAgencePage                       = lazy(() => import('@/pages/exploitation/ChefsAgencePage'));
const GuichetieresPageExploitation          = lazy(() => import('@/pages/exploitation/GuichetieresPage'));
const TechniciensPage                       = lazy(() => import('@/pages/exploitation/TechniciensPage'));
const TerminauxMobiPage                     = lazy(() => import('@/pages/exploitation/TerminauxMobiPage'));
const PointsVenteMobiPage                   = lazy(() => import('@/pages/exploitation/PointsVenteMobiPage'));
const RegionsPage                           = lazy(() => import('@/pages/exploitation/RegionsPage'));
const SecteursPage                          = lazy(() => import('@/pages/exploitation/SecteursPage'));
const ChefsSecteurPage                      = lazy(() => import('@/pages/exploitation/ChefsSecteurPage'));
const MaintenanceTerminauxExploitationPage  = lazy(() => import('@/pages/exploitation/MaintenanceTerminauxPage'));
const ValidationPaiementGainPage            = lazy(() => import('@/pages/exploitation/ValidationPaiementGainPage'));
const AutorisationsPaiementGainPage         = lazy(() => import('@/pages/exploitation/AutorisationsPaiementGainPage'));
const ReferentielParametresPage             = lazy(() => import('@/pages/exploitation/ReferentielParametresPage'));
const ProfilsExploitationPage               = lazy(() => import('@/pages/exploitation/ProfilsExploitationPage'));
const ParametresPage                        = lazy(() => import('@/pages/exploitation/ParametresPage'));
const ChiffresDaffairesPage                 = lazy(() => import('@/pages/exploitation/ChiffresDaffairesPage'));
const EtatPlanningGeneralPage               = lazy(() => import('@/pages/exploitation/EtatPlanningGeneralPage'));
const SuiviPointageExploitationPage         = lazy(() => import('@/pages/exploitation/SuiviPointagePage'));
const EcartsGpsPage                         = lazy(() => import('@/pages/exploitation/EcartsGpsPage'));
const ActivitesEtAuditPage                  = lazy(() => import('@/pages/exploitation/ActivitesEtAuditPage'));
const TableauDeBordPage                     = lazy(() => import('@/pages/exploitation/TableauDeBordPage'));
const NotificationsExploitationPage         = lazy(() => import('@/pages/exploitation/NotificationsExploitationPage'));
const RapportsPage                          = lazy(() => import('@/pages/exploitation/RapportsPage'));

// Chef d'agence
const MesGuichetieresPage                   = lazy(() => import('@/pages/chef_agence/MesGuichetieresPage'));
const MonPlanningPage                       = lazy(() => import('@/pages/chef_agence/MonPlanningPage'));
const MaintenanceTerminauxPage              = lazy(() => import('@/pages/chef_agence/MaintenanceTerminauxPage'));
const SuiviPointageChefPage                 = lazy(() => import('@/pages/chef_agence/SuiviPointagePage'));
const PointsVenteMobiChefPage               = lazy(() => import('@/pages/chef_agence/PointsVenteMobiChefPage'));

// Guichetière
const RapportsChefAgencePage                = lazy(() => import('@/pages/chef_agence/RapportsChefAgencePage'));
const MonPlanningGuichetierePage            = lazy(() => import('@/pages/guichetiere/MonPlanningGuichetierePage'));
const MesPointagesPage                      = lazy(() => import('@/pages/guichetiere/MesPointagesPage'));
const MesPointsVenteMobiPage                = lazy(() => import('@/pages/guichetiere/MesPointsVenteMobiPage'));
const EtatCaissePage                        = lazy(() => import('@/pages/guichetiere/EtatCaissePage'));

// ── Fallback pendant le chargement d'un chunk de route ──
const RouteLoader = () => (
  <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8v4l3-3-3-3V4a8 8 0 00-8 8z" />
      </svg>
      Chargement…
    </div>
  </div>
);

// Wrap chaque page lazy dans Suspense + ErrorBoundary
const LazyRoute = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<RouteLoader />}>{children}</Suspense>
  </ErrorBoundary>
);

const App = () => (
  <FeatureFlagsProvider>
    <TooltipProvider>
    <BrowserRouter>
      <ThemeLoader />
      <ClientTitle />
      <Routes>
        <Route path="/pbi-viewer" element={<LazyRoute><PbiViewerPage /></LazyRoute>} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/reset-password" element={<LazyRoute><ResetPasswordPage /></LazyRoute>} />
          <Route path="/pointage"                          element={<LazyRoute><PointagePage /></LazyRoute>} />
          <Route path="/paiement-gros-gain"                element={<LazyRoute><PaiementGrosGainPage /></LazyRoute>} />
          <Route path="/maintenance-terminaux"             element={<Navigate to="/espace-technicien" replace />} />
          <Route path="/espace-technicien"                 element={<LazyRoute><EspaceMaintenancePage /></LazyRoute>} />
          <Route path="/validation-paiement-gain"          element={<Navigate to="/espace-validation-paiement-gain" replace />} />
          <Route path="/espace-validation-paiement-gain"   element={<LazyRoute><EspaceValidationPaiementGainPage /></LazyRoute>} />
          <Route path="/espace-directeur-general"          element={<LazyRoute><EspaceValidationPaiementGainPage spaceMode="general" /></LazyRoute>} />
          <Route path="/espace-paiement-gros-gain"         element={<Navigate to="/paiement-gros-gain" replace />} />
          <Route path="/guichetiere"                       element={<Navigate to="/espace-guichetiere" replace />} />
          <Route path="/chef-agence"                       element={<Navigate to="/espace-chef-agence/mon-planning" replace />} />

          <Route path="/espace-guichetiere" element={<LazyRoute><EspaceGuichetierePage /></LazyRoute>}>
            <Route index                          element={<Navigate to="mon-planning" replace />} />
            <Route path="mon-planning"            element={<LazyRoute><MonPlanningGuichetierePage /></LazyRoute>} />
            <Route path="mes-pointages"           element={<LazyRoute><MesPointagesPage /></LazyRoute>} />
            <Route path="mes-points-vente-mobi"   element={<LazyRoute><MesPointsVenteMobiPage /></LazyRoute>} />
            <Route path="etat-caisse"             element={<LazyRoute><EtatCaissePage /></LazyRoute>} />
          </Route>

          <Route path="/espace-exploitation" element={<LazyRoute><EspaceExploitationPage /></LazyRoute>}>
            <Route index                              element={<Navigate to="maintenance-terminaux" replace />} />
            <Route path="tableau-de-bord"             element={<LazyRoute><TableauDeBordPage /></LazyRoute>} />
            <Route path="agences"                     element={<LazyRoute><AgencesPage /></LazyRoute>} />
            <Route path="chefs-agence"                element={<LazyRoute><ChefsAgencePage /></LazyRoute>} />
            <Route path="guichetieres"                element={<LazyRoute><GuichetieresPageExploitation /></LazyRoute>} />
            <Route path="techniciens"                 element={<LazyRoute><TechniciensPage /></LazyRoute>} />
            <Route path="maintenance-terminaux"       element={<LazyRoute><MaintenanceTerminauxExploitationPage /></LazyRoute>} />
            <Route path="suivi-pointage"              element={<LazyRoute><SuiviPointageExploitationPage /></LazyRoute>} />
            <Route path="controle-presence"          element={<LazyRoute><EcartsGpsPage /></LazyRoute>} />
            <Route path="terminaux-mobi"              element={<LazyRoute><TerminauxMobiPage /></LazyRoute>} />
            <Route path="points-vente-mobi"           element={<LazyRoute><PointsVenteMobiPage /></LazyRoute>} />
            <Route path="regions"                     element={<LazyRoute><RegionsPage /></LazyRoute>} />
            <Route path="secteurs"                    element={<LazyRoute><SecteursPage /></LazyRoute>} />
            <Route path="chefs-secteur"               element={<LazyRoute><ChefsSecteurPage /></LazyRoute>} />
            <Route path="validation-paiement-gain"    element={<LazyRoute><ValidationPaiementGainPage scope="regional" /></LazyRoute>} />
            <Route path="direction-generale"          element={<LazyRoute><ValidationPaiementGainPage scope="general" /></LazyRoute>} />
            <Route path="autorisation-paiement-gain"  element={<LazyRoute><AutorisationsPaiementGainPage /></LazyRoute>} />
            <Route path="referentiel-parametres"      element={<LazyRoute><ReferentielParametresPage /></LazyRoute>} />
            <Route path="etat-planning-general"       element={<LazyRoute><EtatPlanningGeneralPage /></LazyRoute>} />
            <Route path="activites-et-audit"          element={<LazyRoute><ActivitesEtAuditPage /></LazyRoute>} />
            <Route path="activites-utilisateurs"      element={<Navigate to="/espace-exploitation/activites-et-audit" replace />} />
            <Route path="journal-audit"               element={<Navigate to="/espace-exploitation/activites-et-audit" replace />} />
            <Route path="chiffres-daffaires"          element={<LazyRoute><ChiffresDaffairesPage /></LazyRoute>} />
            <Route path="parametres"                  element={<LazyRoute><ParametresPage /></LazyRoute>} />
            <Route path="profils-exploitation"              element={<LazyRoute><ProfilsExploitationPage /></LazyRoute>} />
            <Route path="notifications-exploitation"        element={<LazyRoute><NotificationsExploitationPage /></LazyRoute>} />
            <Route path="rapports"                          element={<LazyRoute><RapportsPage /></LazyRoute>} />
          </Route>

          <Route path="/espace-chef-agence" element={<LazyRoute><EspaceChefAgencePage /></LazyRoute>}>
            <Route index                          element={<Navigate to="mon-planning" replace />} />
            <Route path="mes-guichetieres"        element={<LazyRoute><MesGuichetieresPage /></LazyRoute>} />
            <Route path="mon-planning"            element={<LazyRoute><MonPlanningPage /></LazyRoute>} />
            <Route path="maintenance-terminaux"   element={<LazyRoute><MaintenanceTerminauxPage /></LazyRoute>} />
            <Route path="suivi-pointage"          element={<LazyRoute><SuiviPointageChefPage /></LazyRoute>} />
            <Route path="points-vente-mobi"       element={<LazyRoute><PointsVenteMobiChefPage /></LazyRoute>} />
            <Route path="paiement-gros-gain"      element={<LazyRoute><PaiementGrosGainPage /></LazyRoute>} />
            <Route path="rapports"                element={<LazyRoute><RapportsChefAgencePage /></LazyRoute>} />
          </Route>

          <Route path="/espace-chef-secteur" element={<LazyRoute><EspaceChefSecteurPage /></LazyRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
    </TooltipProvider>
  </FeatureFlagsProvider>
);

export default App;
