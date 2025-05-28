
import React, { useState, useEffect, useCallback } from 'react';

export const usePointageReminders = (currentTime, settings, toast, playSound) => {
  const [soundPlayedForCreneau, setSoundPlayedForCreneau] = useState({});

  const checkAndPlayReminders = useCallback(() => {
    if (!settings.creneauxPointage || settings.creneauxPointage.length === 0 || !playSound) return;

    const now = new Date(currentTime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    settings.creneauxPointage.forEach((creneau, index) => {
      if (!creneau.debut || !creneau.fin) return;

      const [debutH, debutM] = creneau.debut.split(':').map(Number);
      const debutTotalMinutes = debutH * 60 + debutM;
      
      const [finH, finM] = creneau.fin.split(':').map(Number);
      const finTotalMinutes = finH * 60 + finM;
      const rappelFinTime = finTotalMinutes - 5;

      const debutKey = `debut_${index}`;
      const finKey = `fin_${index}`;

      if (settings.rappelDebutCreneau && currentMinutes === debutTotalMinutes && !soundPlayedForCreneau[debutKey]) {
        playSound("debut");
        setSoundPlayedForCreneau(prev => ({...prev, [debutKey]: true}));
        toast({ title: "Rappel Pointage", description: `Le créneau de pointage ${index + 1} (${creneau.debut}-${creneau.fin}) a commencé.`, className:"bg-blue-500 text-white", duration: 7000});
      }
      if (settings.rappelFinCreneau && currentMinutes === rappelFinTime && !soundPlayedForCreneau[finKey]) {
        playSound("rappelFin");
        setSoundPlayedForCreneau(prev => ({...prev, [finKey]: true}));
        toast({ title: "Rappel Pointage", description: `Le créneau de pointage ${index + 1} (${creneau.debut}-${creneau.fin}) se termine dans 5 minutes.`, className:"bg-yellow-500 text-black", duration: 7000});
      }
      
      if(currentMinutes > debutTotalMinutes && !soundPlayedForCreneau[debutKey]) setSoundPlayedForCreneau(prev => ({...prev, [debutKey]: true}));
      if(currentMinutes > rappelFinTime && !soundPlayedForCreneau[finKey]) setSoundPlayedForCreneau(prev => ({...prev, [finKey]: true}));
    });
    
    if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 5) { // Reset once a day
        setSoundPlayedForCreneau({});
    }

  }, [currentTime, settings, playSound, toast, soundPlayedForCreneau]);

  useEffect(() => {
    checkAndPlayReminders();
  }, [checkAndPlayReminders]);
};
