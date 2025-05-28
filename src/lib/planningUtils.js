
import { format, getDaysInMonth } from 'date-fns';

export const getPlanningStatusForAgence = (agence, currentMonth, planningDataArray, chefsAgence, daysInMonthArray, guichetieres) => {
  let plannedDays = 0;
  const totalDaysInMonth = getDaysInMonth(currentMonth);
  const NBRE_TERMINAUX = parseInt(agence.nbreTerminaux) || 1;

  daysInMonthArray.forEach(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    const planningEntriesForAgenceAndDay = (planningDataArray || []).filter(
      p => p.date === dayStr && p.agenceNom === agence.nom
    );

    if (planningEntriesForAgenceAndDay.length >= NBRE_TERMINAUX) {
      plannedDays++;
    }
  });
  
  const completionPercentage = totalDaysInMonth > 0 ? (plannedDays / totalDaysInMonth) * 100 : 0;
  const chef = chefsAgence.find(c => c.agenceEnCharge === agence.nom || c.agenceId === agence.id);
  
  return {
    id: agence.id || agence.nom,
    agenceNom: agence.nom,
    chefNom: chef ? `${chef.prenom} ${chef.nom}` : 'N/A',
    completion: completionPercentage.toFixed(0) + '%',
    isCompliant: completionPercentage >= 90 && (NBRE_TERMINAUX > 0 ? plannedDays > 0 : true),
    joursCouvert: plannedDays,
    joursTotal: totalDaysInMonth,
    nbreTerminaux: agence.nbreTerminaux
  };
};
