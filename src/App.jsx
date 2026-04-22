import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import PointagePage from '@/pages/PointagePage';
import EspaceExploitationPage from '@/pages/EspaceExploitationPage';
import EspaceValidationPaiementGainPage from '@/pages/EspaceValidationPaiementGainPage';
import AgencesPage from '@/pages/exploitation/AgencesPage';
import ChefsAgencePage from '@/pages/exploitation/ChefsAgencePage';
import GuichetieresPageExploitation from '@/pages/exploitation/GuichetieresPage';
import TechniciensPage from '@/pages/exploitation/TechniciensPage';
import TerminauxMobiPage from '@/pages/exploitation/TerminauxMobiPage';
import PointsVenteMobiPage from '@/pages/exploitation/PointsVenteMobiPage';
import RegionsPage from '@/pages/exploitation/RegionsPage';
import MaintenanceTerminauxExploitationPage from '@/pages/exploitation/MaintenanceTerminauxPage';
import ValidationPaiementGainPage from '@/pages/exploitation/ValidationPaiementGainPage';
import AutorisationsPaiementGainPage from '@/pages/exploitation/AutorisationsPaiementGainPage';
import ReferentielParametresPage from '@/pages/exploitation/ReferentielParametresPage';
import ProfilsExploitationPage from '@/pages/exploitation/ProfilsExploitationPage';
import ParametresPage from '@/pages/exploitation/ParametresPage';
import StatistiquesPage from '@/pages/exploitation/StatistiquesPage'; 
import PaiementGrosGainPage from '@/pages/PaiementGrosGainPage';

import EspaceChefAgencePage from '@/pages/EspaceChefAgencePage';
import EspaceMaintenancePage from '@/pages/EspaceMaintenancePage';
import MesGuichetieresPage from '@/pages/chef_agence/MesGuichetieresPage';
import MonPlanningPage from '@/pages/chef_agence/MonPlanningPage';
import MaintenanceTerminauxPage from '@/pages/chef_agence/MaintenanceTerminauxPage';
import MonPlanningMaintenancePage from '@/pages/chef_agence/MonPlanningMaintenancePage';
import PointsVenteMobiChefPage from '@/pages/chef_agence/PointsVenteMobiChefPage';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import EtatPlanningGeneralPage from '@/pages/exploitation/EtatPlanningGeneralPage';


const PlaceholderPage = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-20rem)]">
    <h1 className="text-4xl font-bold text-primary">{title}</h1>
    <p className="text-muted-foreground mt-2">Cette page est en cours de construction.</p>
    <img  alt="Illustration de construction" class="mt-8 w-64 h-auto" src="https://images.unsplash.com/photo-1690868305866-b00e0261ae49" />
  </div>
);

const App = () => {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/pointage" element={<PointagePage />} />
            <Route path="/paiement-gros-gain" element={<PaiementGrosGainPage />} />
            <Route path="/maintenance-terminaux" element={<EspaceMaintenancePage />} />
            <Route path="/validation-paiement-gain" element={<Navigate to="/espace-validation-paiement-gain" replace />} />
            <Route path="/espace-validation-paiement-gain" element={<EspaceValidationPaiementGainPage />} />
            <Route path="/espace-paiement-gros-gain" element={<Navigate to="/paiement-gros-gain" replace />} />
            
            <Route path="/espace-exploitation" element={<EspaceExploitationPage />}>
              <Route index element={<Navigate to="guichetieres" replace />} />
              <Route path="agences" element={<AgencesPage />} />
              <Route path="chefs-agence" element={<ChefsAgencePage />} />
              <Route path="guichetieres" element={<GuichetieresPageExploitation />} />
              <Route path="techniciens" element={<TechniciensPage />} />
              <Route path="maintenance-terminaux" element={<MaintenanceTerminauxExploitationPage />} />
              <Route path="terminaux-mobi" element={<TerminauxMobiPage />} />
              <Route path="points-vente-mobi" element={<PointsVenteMobiPage />} />
              <Route path="regions" element={<RegionsPage />} />
              <Route path="validation-paiement-gain" element={<ValidationPaiementGainPage />} />
              <Route path="autorisation-paiement-gain" element={<AutorisationsPaiementGainPage />} />
              <Route path="referentiel-parametres" element={<ReferentielParametresPage />} />
              <Route path="etat-planning-general" element={<EtatPlanningGeneralPage />} />
              <Route path="statistiques" element={<StatistiquesPage />} />
              <Route path="parametres" element={<ParametresPage />} />
              <Route path="profils-exploitation" element={<ProfilsExploitationPage />} />
            </Route>

            <Route path="/espace-chef-agence" element={<EspaceChefAgencePage />}>
              <Route index element={<Navigate to="mon-planning" replace />} />
              <Route path="mes-guichetieres" element={<MesGuichetieresPage />} />
              <Route path="mon-planning" element={<MonPlanningPage />} />
              <Route path="maintenance-terminaux" element={<MaintenanceTerminauxPage />} />
              <Route path="planning-maintenance" element={<MonPlanningMaintenancePage />} />
              <Route path="points-vente-mobi" element={<PointsVenteMobiChefPage />} />
              <Route path="paiement-gros-gain" element={<PaiementGrosGainPage />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
