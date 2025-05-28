
import React, { useState, useEffect, useCallback } from 'react';
import { getGuichetieresPlanifieesPourAgence, getPointagesPourGuichetieres } from '@/lib/pointageUtils';

export const usePointageDailyData = (isChefAgenceLoggedIn, chefAgenceInfo, settings, todayDateStr, nomAgenceAffichee) => {
  const [guichetieresPlanifieesAujourdhui, setGuichetieresPlanifieesAujourdhui] = useState([]);
  const [pointagesJournaliersAgence, setPointagesJournaliersAgence] = useState({});

  const loadPointageData = useCallback(() => {
    let agenceToUse = null;
    if (isChefAgenceLoggedIn && chefAgenceInfo && chefAgenceInfo.nomAgence) {
        agenceToUse = chefAgenceInfo.nomAgence;
    } else if (settings.isPointageCentraliseActif) {
        agenceToUse = "Agence Centrale";
    }
    
    if (!agenceToUse) {
        setGuichetieresPlanifieesAujourdhui([]);
        setPointagesJournaliersAgence({});
        return;
    }
    
    const planifiees = getGuichetieresPlanifieesPourAgence(agenceToUse, todayDateStr);
    setGuichetieresPlanifieesAujourdhui(planifiees);
    
    const pointages = getPointagesPourGuichetieres(planifiees.map(g => g.matricule), todayDateStr);
    setPointagesJournaliersAgence(pointages);

  }, [isChefAgenceLoggedIn, chefAgenceInfo, settings, todayDateStr, nomAgenceAffichee]);

  useEffect(() => {
    loadPointageData();
  }, [loadPointageData]);

  return {
    guichetieresPlanifieesAujourdhui,
    pointagesJournaliersAgence,
    loadPointageData,
  };
};
