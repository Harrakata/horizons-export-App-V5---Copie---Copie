import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import PointagePage from '@/pages/PointagePage';
import EspaceExploitationPage from '@/pages/EspaceExploitationPage';
import AgencesPage from '@/pages/exploitation/AgencesPage';
import ChefsAgencePage from '@/pages/exploitation/ChefsAgencePage';
import GuichetieresPageExploitation from '@/pages/exploitation/GuichetieresPage';
import TechniciensPage from '@/pages/exploitation/TechniciensPage';
import ParametresPage from '@/pages/exploitation/ParametresPage';
import StatistiquesPage from '@/pages/exploitation/StatistiquesPage'; 

import EspaceChefAgencePage from '@/pages/EspaceChefAgencePage';
import EspaceMaintenancePage from '@/pages/EspaceMaintenancePage';
import MesGuichetieresPage from '@/pages/chef_agence/MesGuichetieresPage';
import MonPlanningPage from '@/pages/chef_agence/MonPlanningPage';
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
            <Route path="/maintenance-terminaux" element={<EspaceMaintenancePage />} />
            
            <Route path="/espace-exploitation" element={<EspaceExploitationPage />}>
              <Route index element={<Navigate to="guichetieres" replace />} />
              <Route path="agences" element={<AgencesPage />} />
              <Route path="chefs-agence" element={<ChefsAgencePage />} />
              <Route path="guichetieres" element={<GuichetieresPageExploitation />} />
              <Route path="techniciens" element={<TechniciensPage />} />
              <Route path="etat-planning-general" element={<EtatPlanningGeneralPage />} />
              <Route path="statistiques" element={<StatistiquesPage />} />
              <Route path="parametres" element={<ParametresPage />} />
            </Route>

            <Route path="/espace-chef-agence" element={<EspaceChefAgencePage />}>
              <Route index element={<Navigate to="mon-planning" replace />} />
              <Route path="mes-guichetieres" element={<MesGuichetieresPage />} />
              <Route path="mon-planning" element={<MonPlanningPage />} />
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
