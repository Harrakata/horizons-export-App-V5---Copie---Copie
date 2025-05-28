
import { useState, useEffect, useMemo } from 'react';
import { eachDayOfInterval, startOfMonth, endOfMonth, isValid, format } from 'date-fns';
import { getPlanningStatusForAgence } from '@/lib/planningUtils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const usePlanningGeneralData = (currentMonth) => {
  const [agences, setAgences] = useState([]);
  const [chefsAgence, setChefsAgence] = useState([]);
  const [planningData, setPlanningData] = useState([]); 
  const [guichetieres, setGuichetieres] = useState([]);
  const [filterAgence, setFilterAgence] = useState('');
  const [filterChef, setFilterChef] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const { data: agencesData, error: agencesError } = await supabase.from('agences').select('*');
      if (agencesError) toast({ title: "Erreur chargement agences", description: agencesError.message, variant: "destructive" });
      else setAgences(agencesData || []);

      const { data: chefsData, error: chefsError } = await supabase.from('chefs_agence').select('*');
      if (chefsError) toast({ title: "Erreur chargement chefs", description: chefsError.message, variant: "destructive" });
      else setChefsAgence(chefsData || []);

      const { data: guichetieresData, error: guichetieresError } = await supabase.from('guichetieres').select('*');
      if (guichetieresError) toast({ title: "Erreur chargement guichetières", description: guichetieresError.message, variant: "destructive" });
      else setGuichetieres(guichetieresData || []);
      
      if (isValid(currentMonth)) {
        const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        const { data: planning, error: planningError } = await supabase
          .from('planning')
          .select('*')
          .gte('date', monthStart)
          .lte('date', monthEnd);
        if (planningError) toast({ title: "Erreur chargement planning", description: planningError.message, variant: "destructive" });
        else setPlanningData(planning || []);
      }
    };
    fetchData();
  }, [currentMonth, toast]);

  const daysInMonthArray = useMemo(() => {
    if (!currentMonth || !isValid(currentMonth)) {
        return [];
    }
    try {
        return eachDayOfInterval({
            start: startOfMonth(currentMonth),
            end: endOfMonth(currentMonth),
        });
    } catch (error) {
        console.error("Error calculating days in month:", error);
        return [];
    }
  }, [currentMonth]);

  const agencesStatus = useMemo(() => {
    if (!agences || agences.length === 0 || !isValid(currentMonth)) return [];
    
    const planningWithGuichetiereDetails = planningData.map(p => {
      const guichetiere = guichetieres.find(g => g.id === p.guichetiereId);
      return { ...p, guichetiereDetails: guichetiere };
    });

    return agences.map(agence => getPlanningStatusForAgence(agence, currentMonth, planningWithGuichetiereDetails, chefsAgence, daysInMonthArray, guichetieres));
  }, [agences, currentMonth, planningData, chefsAgence, daysInMonthArray, guichetieres]);

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
    filterAgence,
    setFilterAgence,
    filterChef,
    setFilterChef,
    daysInMonthArray,
    filteredAgencesStatus,
    guichetieres
  };
};
