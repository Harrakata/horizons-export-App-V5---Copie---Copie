import { useState, useEffect, useMemo, useCallback } from 'react';
import { eachDayOfInterval, startOfMonth, endOfMonth, isValid, format, getDaysInMonth } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';


export const getPlanningStatusForAgence = (agence, dateRange, planningDataForAgence, chefsAgence, guichetieres) => {
  if (!agence || !dateRange || !dateRange.start || !dateRange.end || !isValid(dateRange.start) || !isValid(dateRange.end)) {
    return {
      id: agence?.id || agence?.nom || 'unknown',
      agenceNom: agence?.nom || 'Inconnue',
      chefNom: 'N/A',
      completion: '0%',
      isCompliant: false,
      joursCouvert: 0,
      joursTotal: 0,
      nbreTerminaux: agence?.nbreTerminaux || 0
    };
  }

  const daysInPeriodArray = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  const totalDaysInPeriod = daysInPeriodArray.length;
  const NBRE_TERMINAUX = parseInt(agence.nbreTerminaux) || 1;
  let plannedDays = 0;

  daysInPeriodArray.forEach(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const planningEntriesForDay = planningDataForAgence.filter(p => p.date === dayStr);
    
    const uniqueGuichetieresCount = new Set(planningEntriesForDay.map(p => p.guichetiereId)).size;

    if (uniqueGuichetieresCount === NBRE_TERMINAUX) {
      plannedDays++;
    }
  });
  
  const totalRequiredPlannings = NBRE_TERMINAUX * totalDaysInPeriod;
  
  let totalPlannedGuichetieres = 0;
  daysInPeriodArray.forEach(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const planningEntriesForDay = planningDataForAgence.filter(p => p.date === dayStr);
    totalPlannedGuichetieres += new Set(planningEntriesForDay.map(p => p.guichetiereId)).size;
  });

  const completionPercentage = totalRequiredPlannings > 0 ? 
    Math.min(100, (totalPlannedGuichetieres / totalRequiredPlannings) * 100) : 0;
  
  const chef = chefsAgence.find(c => c.agenceEnCharge === agence.nom || c.codePDV === agence.codePDV); // Use codePDV as fallback if agenceId is not there
  
  return {
    id: agence.id || agence.nom,
    agenceNom: agence.nom,
    chefNom: chef ? `${chef.prenom} ${chef.nom}` : 'N/A',
    completion: completionPercentage.toFixed(0) + '%',
    isCompliant: completionPercentage >= 90 && (NBRE_TERMINAUX > 0 ? plannedDays > 0 : true),
    joursCouvert: plannedDays,
    joursTotal: totalDaysInPeriod,
    nbreTerminaux: agence.nbreTerminaux
  };
};


export const usePlanningGeneralData = (startDate, endDate) => {
  const [agences, setAgences] = useState([]);
  const [chefsAgence, setChefsAgence] = useState([]);
  const [planningData, setPlanningData] = useState([]); 
  const [guichetieres, setGuichetieres] = useState([]);
  const [filterAgence, setFilterAgence] = useState('');
  const [filterChef, setFilterChef] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const refetchData = useCallback(async () => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
      setAgences([]);
      setChefsAgence([]);
      setPlanningData([]);
      setGuichetieres([]);
      return;
    }
    setIsLoading(true);

    try {
      const { data: agencesData, error: agencesError } = await supabase.from('agences').select('*');
      if (agencesError) throw agencesError;
      setAgences(agencesData || []);

      const { data: chefsData, error: chefsError } = await supabase.from('chefs_agence').select('*');
      if (chefsError) throw chefsError;
      setChefsAgence(chefsData || []);
      
      const { data: guichetieresData, error: guichetieresError } = await supabase.from('guichetieres').select('id, nom, prenom, matricule');
      if (guichetieresError) throw guichetieresError;
      setGuichetieres(guichetieresData || []);

      const { data: planningRecords, error: planningError } = await supabase
        .from('planning')
        .select('date, agenceNom, guichetiereId')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));
      if (planningError) throw planningError;
      setPlanningData(planningRecords || []);

    } catch (error) {
      toast({ title: "Erreur de chargement des données", description: error.message, variant: "destructive" });
      setAgences([]);
      setChefsAgence([]);
      setPlanningData([]);
      setGuichetieres([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, toast]);

  useEffect(() => {
    refetchData();
  }, [refetchData]);


  const agencesStatus = useMemo(() => {
    if (!agences || agences.length === 0 || !isValid(startDate) || !isValid(endDate)) return [];
    return agences.map(agence => {
      const planningForThisAgence = planningData.filter(p => p.agenceNom === agence.nom);
      return getPlanningStatusForAgence(agence, {start: startDate, end: endDate}, planningForThisAgence, chefsAgence, guichetieres);
    });
  }, [agences, startDate, endDate, planningData, chefsAgence, guichetieres]);

  const filteredAgencesStatus = useMemo(() => {
    return agencesStatus.filter(status => 
      (filterAgence ? status.agenceNom.toLowerCase().includes(filterAgence.toLowerCase()) : true) &&
      (filterChef ? status.chefNom.toLowerCase().includes(filterChef.toLowerCase()) : true)
    );
  }, [agencesStatus, filterAgence, filterChef]);

  return {
    agences,
    chefsAgence,
    planningData, 
    guichetieres,
    filterAgence,
    setFilterAgence,
    filterChef,
    setFilterChef,
    filteredAgencesStatus,
    isLoading,
    refetchData
  };
};
