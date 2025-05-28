
import { parseISO, format } from 'date-fns';

export const getGuichetieresPlanifieesPourAgence = (nomAgence, dateStr) => {
  const allPlanningData = JSON.parse(localStorage.getItem('pmuPlanning')) || [];
  const allGuichetieres = JSON.parse(localStorage.getItem('pmuGuichetieres')) || [];
  
  const planningEntryForTodayAndAgence = allPlanningData.find(p => p.date === dateStr && p.agenceNom === nomAgence);
  
  if (!planningEntryForTodayAndAgence || !planningEntryForTodayAndAgence.events) {
    return [];
  }

  const guichetiereIdsPlanifiees = planningEntryForTodayAndAgence.events.map(event => event.guichetiereId);
  
  return allGuichetieres.filter(g => guichetiereIdsPlanifiees.includes(g.id));
};

export const getPointagesPourGuichetieres = (matricules, dateStr) => {
  const allPointagesStorage = JSON.parse(localStorage.getItem('pmuPointages')) || {};
  const pointagesResult = {};

  matricules.forEach(matricule => {
    const userPointagesToday = (allPointagesStorage[matricule]?.[dateStr] || []).map(p => ({...p, time: new Date(p.time)}));
    pointagesResult[matricule] = userPointagesToday;
  });

  return pointagesResult;
};
