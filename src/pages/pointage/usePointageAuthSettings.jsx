
import React, { useState, useEffect } from 'react';
import { INITIAL_SETTINGS } from '@/pages/pointage/pointageConstants';

export const usePointageAuthSettings = () => {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [maxPointages, setMaxPointages] = useState(INITIAL_SETTINGS.nombrePointagesRequis);
  const [chefAgenceInfo, setChefAgenceInfo] = useState(null);
  const [isChefAgenceLoggedIn, setIsChefAgenceLoggedIn] = useState(false);
  const [nomAgenceAffichee, setNomAgenceAffichee] = useState(INITIAL_SETTINGS.isPointageCentraliseActif ? "Agence Centrale" : null);

  useEffect(() => {
    const authData = JSON.parse(localStorage.getItem('pmuChefAuth'));
    if (authData && authData.isAuthenticated && authData.chefInfo) {
      setChefAgenceInfo(authData.chefInfo);
      setIsChefAgenceLoggedIn(true);
      setNomAgenceAffichee(authData.chefInfo.nomAgence || "Agence Centrale");
    } else {
      setIsChefAgenceLoggedIn(false);
      const storedAppSettings = JSON.parse(localStorage.getItem('pmuAppSettings')) || INITIAL_SETTINGS;
      setNomAgenceAffichee(storedAppSettings.isPointageCentraliseActif ? "Agence Centrale" : null);
    }

    const storedAppSettings = JSON.parse(localStorage.getItem('pmuAppSettings')) || INITIAL_SETTINGS;
    setSettings(storedAppSettings);
    setMaxPointages(parseInt(storedAppSettings.nombrePointagesRequis, 10) || INITIAL_SETTINGS.nombrePointagesRequis);
  }, []);

  return {
    settings,
    maxPointages,
    chefAgenceInfo,
    isChefAgenceLoggedIn,
    nomAgenceAffichee,
    setNomAgenceAffichee 
  };
};
