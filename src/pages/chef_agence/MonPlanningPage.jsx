
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, PlusCircle, Copy, Trash2, UserPlus, Repeat } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addWeeks, subWeeks, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useOutletContext } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { Combobox } from '@/components/ui/Combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import {
  REQUEST_STATUS,
  PLANNING_REQUEST_TYPES,
  formatDisplayDate,
  formatDisplayDateTime,
  getPlanningRequestTypeLabel,
  getRequestStatusBadgeClass,
  isMissingSupabaseTableError,
} from '@/lib/guichetiereSpace';

const MonPlanningPage = () => {
  const { nomAgence, chefInfo } = useOutletContext();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [planning, setPlanning] = useState({});
  const [guichetieresAgence, setGuichetieresAgence] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGuichetiereId, setSelectedGuichetiereId] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // { planningId, guichetiereId, date }
  const [replacementGuichetiereId, setReplacementGuichetiereId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('month');
  const [planningRequests, setPlanningRequests] = useState([]);

  const fetchPlanning = useCallback(async () => {
    if (!nomAgence) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('planning')
      .select('id, date, guichetiereId, remplacante_de_id, est_remplacante')
      .eq('agenceNom', nomAgence)
      .gte('date', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
      .lte('date', format(endOfMonth(currentMonth), 'yyyy-MM-dd'));

    if (error) {
      toast({ title: 'Erreur de chargement du planning', description: error.message, variant: 'destructive' });
      setPlanning({});
    } else {
      const newPlanning = {};
      data.forEach(item => {
        const dateStr = item.date;
        if (!newPlanning[dateStr]) newPlanning[dateStr] = [];
        newPlanning[dateStr].push({ 
            guichetiereId: item.guichetiereId, 
            planningId: item.id,
            remplacante_de_id: item.remplacante_de_id,
            est_remplacante: item.est_remplacante
        });
      });
      setPlanning(newPlanning);
    }
    setIsLoading(false);
  }, [nomAgence, currentMonth, toast]);

  const fetchGuichetieres = useCallback(async () => {
    if (!nomAgence) return;
    const { data, error } = await supabase
      .from('guichetieres')
      .select('id, nom, prenom, disponibilite, dateDebutIndisponibilite, dateFinIndisponibilite')
      .eq('agenceAssigne', nomAgence);

    if (error) {
      toast({ title: 'Erreur de chargement des guichetières', description: error.message, variant: 'destructive' });
    } else {
      setGuichetieresAgence(data || []);
    }
  }, [nomAgence, toast]);

  const fetchPlanningRequests = useCallback(async () => {
    if (!nomAgence) return;

    const { data, error } = await supabase
      .from('planning_modification_requests')
      .select('*')
      .eq('agence_nom', nomAgence)
      .gte('date_planning', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
      .lte('date_planning', format(endOfMonth(currentMonth), 'yyyy-MM-dd'))
      .order('created_at', { ascending: false });

    if (error) {
      if (!isMissingSupabaseTableError(error, 'planning_modification_requests')) {
        toast({
          title: 'Erreur chargement demandes planning',
          description: error.message,
          variant: 'destructive',
        });
      }
      setPlanningRequests([]);
    } else {
      setPlanningRequests(data || []);
    }
  }, [currentMonth, nomAgence, toast]);

  useEffect(() => {
    fetchPlanning();
    fetchGuichetieres();
    fetchPlanningRequests();
  }, [fetchPlanning, fetchGuichetieres, fetchPlanningRequests]);

  const days = useMemo(() => {
    const start = viewMode === 'month' ? startOfMonth(currentMonth) : startOfWeek(currentMonth, { weekStartsOn: 1 });
    const end = viewMode === 'month' ? endOfMonth(currentMonth) : endOfWeek(currentMonth, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth, viewMode]);

  const colStartClasses = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const firstDayOfWeek = getDay(firstDayOfMonth); 
    const adjustedFirstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek -1; 
    const classes = ['col-start-1', 'col-start-2', 'col-start-3', 'col-start-4', 'col-start-5', 'col-start-6', 'col-start-7'];
    return classes[adjustedFirstDayOfWeek];
  }, [currentMonth]);


  const handlePrev = () => setCurrentMonth(prev => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1));
  const handleNext = () => setCurrentMonth(prev => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const openAddModal = (date) => {
    setSelectedDate(date);
    setSelectedGuichetiereId('');
    setIsAddModalOpen(true);
  };
  
  const openEditModal = (event, date) => {
    setEditingEvent({ ...event, date });
    setReplacementGuichetiereId('');
    setIsEditModalOpen(true);
  };

  const isGuichetiereAvailable = (guichetiere, date) => {
    if (!guichetiere) return false;
    if (guichetiere.disponibilite === 'Disponible') return true;
    if (guichetiere.disponibilite === 'Absent' || guichetiere.disponibilite === 'Suspendu') {
      if (guichetiere.dateDebutIndisponibilite && guichetiere.dateFinIndisponibilite) {
        const debut = parseISO(guichetiere.dateDebutIndisponibilite);
        const fin = parseISO(guichetiere.dateFinIndisponibilite);
        return !isWithinInterval(date, { start: debut, end: fin });
      }
    }
    return true; 
  };

  const getAvailableGuichetieresForDate = (date, excludeGuichetiereId = null) => {
    if (!date) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    const plannedGuichetieresForDay = (planning[dateStr] || []).map(p => p.guichetiereId);

    return guichetieresAgence
      .filter(g => 
        isGuichetiereAvailable(g, date) && 
        !plannedGuichetieresForDay.includes(g.id) &&
        g.id !== excludeGuichetiereId 
      )
      .map(g => ({ value: g.id, label: `${g.prenom} ${g.nom}` }));
  };
  
  const availableGuichetieresForAddModal = useMemo(() => getAvailableGuichetieresForDate(selectedDate), [guichetieresAgence, selectedDate, planning]);
  const availableGuichetieresForReplaceModal = useMemo(() => editingEvent ? getAvailableGuichetieresForDate(editingEvent.date, editingEvent.guichetiereId) : [], [guichetieresAgence, editingEvent, planning]);


  const handleAddGuichetiereToPlanning = async () => {
    if (!selectedDate || !selectedGuichetiereId || !nomAgence || !chefInfo?.id) {
      toast({ title: 'Erreur', description: 'Informations manquantes pour ajouter au planning.', variant: 'destructive' });
      return;
    }
    // Further checks already handled by Combobox options
    setIsLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { error } = await supabase.from('planning').insert({
      date: dateStr,
      agenceNom: nomAgence,
      guichetiereId: selectedGuichetiereId,
      chefAgenceId: chefInfo.id,
      est_remplacante: false
    });

    if (error) {
      toast({ title: 'Erreur d\'ajout', description: error.message.includes('duplicate key') ? 'Cette guichetière est déjà planifiée.' : error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Succès', description: 'Guichetière ajoutée au planning.', className: "bg-green-500 text-white" });
      fetchPlanning(); 
      setIsAddModalOpen(false);
    }
    setIsLoading(false);
  };

  const handleRemoveGuichetiereFromPlanning = async (planningId) => {
    setIsLoading(true);
    const { error } = await supabase.from('planning').delete().eq('id', planningId);
    if (error) {
      toast({ title: 'Erreur de suppression', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Succès', description: 'Guichetière retirée du planning.', className: "bg-red-500 text-white" });
      fetchPlanning(); 
      setIsEditModalOpen(false);
    }
    setIsLoading(false);
  };

  const handleReplaceGuichetiere = async () => {
    if (!editingEvent || !replacementGuichetiereId) {
        toast({ title: 'Erreur', description: 'Veuillez sélectionner une guichetière remplaçante.', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    const { error } = await supabase
        .from('planning')
        .update({ 
            guichetiereId: replacementGuichetiereId, 
            remplacante_de_id: editingEvent.guichetiereId,
            est_remplacante: true 
        })
        .eq('id', editingEvent.planningId);

    if (error) {
        toast({ title: 'Erreur de remplacement', description: error.message, variant: 'destructive' });
    } else {
        toast({ title: 'Succès', description: 'Guichetière remplacée avec succès.', className: "bg-green-500 text-white" });
        fetchPlanning();
        setIsEditModalOpen(false);
    }
    setIsLoading(false);
  };


  const handleCopyPrevious = async (period) => {
    setIsLoading(true);
    const sourceStart = period === 'month' ? startOfMonth(subMonths(currentMonth, 1)) : startOfWeek(subWeeks(currentMonth, 1), { weekStartsOn: 1 });
    const sourceEnd = period === 'month' ? endOfMonth(subMonths(currentMonth, 1)) : endOfWeek(subWeeks(currentMonth, 1), { weekStartsOn: 1 });
    const targetStart = period === 'month' ? startOfMonth(currentMonth) : startOfWeek(currentMonth, { weekStartsOn: 1 });

    const { data: sourcePlanning, error: fetchError } = await supabase
      .from('planning')
      .select('date, guichetiereId, est_remplacante, remplacante_de_id')
      .eq('agenceNom', nomAgence)
      .gte('date', format(sourceStart, 'yyyy-MM-dd'))
      .lte('date', format(sourceEnd, 'yyyy-MM-dd'));

    if (fetchError) {
      toast({ title: 'Erreur de copie', description: `Impossible de charger le planning précédent: ${fetchError.message}`, variant: 'destructive' });
      setIsLoading(false); return;
    }
    if (!sourcePlanning || sourcePlanning.length === 0) {
      toast({ title: 'Copie impossible', description: `Aucun planning trouvé pour ${period === 'month' ? 'le mois' : 'la semaine'} précédent(e).`, variant: 'warning' });
      setIsLoading(false); return;
    }
    
    const newPlanningEntries = sourcePlanning.map(entry => {
      const sourceDate = parseISO(entry.date);
      const dayOffset = sourceDate.getDate() - sourceStart.getDate();
      const targetDate = new Date(targetStart);
      targetDate.setDate(targetStart.getDate() + dayOffset);
      
      if ( (period === 'month' && !isSameMonth(targetDate, currentMonth)) || 
           (period === 'week' && (targetDate < startOfWeek(currentMonth, { weekStartsOn: 1 }) || targetDate > endOfWeek(currentMonth, { weekStartsOn: 1 }))) ) {
        return null; 
      }
      return {
        date: format(targetDate, 'yyyy-MM-dd'),
        agenceNom: nomAgence,
        guichetiereId: entry.guichetiereId,
        chefAgenceId: chefInfo.id,
        est_remplacante: entry.est_remplacante,
        remplacante_de_id: entry.remplacante_de_id
      };
    }).filter(Boolean);

    if (newPlanningEntries.length > 0) {
      const { error: insertError } = await supabase.from('planning').insert(newPlanningEntries, { upsert: false }); 
      if (insertError) {
        toast({ title: 'Erreur de copie', description: insertError.message.includes('duplicate key') ? 'Certaines affectations existaient déjà.' : insertError.message, variant: insertError.message.includes('duplicate key') ? 'warning' : 'destructive' });
      } else {
        toast({ title: 'Succès', description: `Planning ${period === 'month' ? 'mensuel' : 'hebdomadaire'} précédent copié.`, className: "bg-green-500 text-white" });
      }
      fetchPlanning();
    } else {
       toast({ title: 'Copie non effectuée', description: 'Aucune affectation valide à copier.', variant: 'info' });
    }
    setIsLoading(false);
  };

  const requestsByDate = useMemo(
    () =>
      planningRequests.reduce((accumulator, request) => {
        if (!accumulator[request.date_planning]) {
          accumulator[request.date_planning] = [];
        }
        accumulator[request.date_planning].push(request);
        return accumulator;
      }, {}),
    [planningRequests]
  );

  const requestsByPlanningId = useMemo(
    () =>
      planningRequests.reduce((accumulator, request) => {
        if (!accumulator[String(request.planning_id)]) {
          accumulator[String(request.planning_id)] = request;
        }
        return accumulator;
      }, {}),
    [planningRequests]
  );

  const monthPlanningCount = useMemo(
    () => Object.values(planning).reduce((sum, items) => sum + items.length, 0),
    [planning]
  );
  const guichetieresCount = guichetieresAgence.length;
  const pendingRequestsCount = planningRequests.filter(
    (request) => request.statut === REQUEST_STATUS.PENDING
  ).length;

  const handleProcessPlanningRequest = async (request, nextStatus) => {
    setIsLoading(true);

    try {
      if (nextStatus === REQUEST_STATUS.APPROVED) {
        const { data: planningRow, error: planningError } = await supabase
          .from('planning')
          .select('id, date, guichetiereId, agenceNom')
          .eq('id', request.planning_id)
          .single();

        if (planningError || !planningRow) {
          throw planningError || new Error("L'affectation liée à cette demande est introuvable.");
        }

        if (request.type_demande === PLANNING_REQUEST_TYPES.UNAVAILABILITY) {
          const { error: deleteError } = await supabase.from('planning').delete().eq('id', planningRow.id);
          if (deleteError) throw deleteError;
        }

        if (request.type_demande === PLANNING_REQUEST_TYPES.DATE_CHANGE) {
          if (!request.date_souhaitee) {
            throw new Error('La demande ne contient pas de date souhaitée.');
          }

          const { data: conflictRows, error: conflictError } = await supabase
            .from('planning')
            .select('id')
            .eq('guichetiereId', planningRow.guichetiereId)
            .eq('date', request.date_souhaitee)
            .neq('id', planningRow.id);

          if (conflictError) throw conflictError;

          if ((conflictRows || []).length > 0) {
            throw new Error('Cette guichetière est déjà planifiée à la date demandée.');
          }

          const { error: updatePlanningError } = await supabase
            .from('planning')
            .update({ date: request.date_souhaitee })
            .eq('id', planningRow.id);

          if (updatePlanningError) throw updatePlanningError;
        }
      }

      const commentaireTraitement =
        nextStatus === REQUEST_STATUS.APPROVED
          ? request.type_demande === PLANNING_REQUEST_TYPES.UNAVAILABILITY
            ? 'Indisponibilité validée, créneau retiré du planning.'
            : `Changement de date validé${request.date_souhaitee ? ` vers le ${formatDisplayDate(request.date_souhaitee)}` : '.'}`
          : 'Demande refusée par le chef d’agence.';

      const { error: requestError } = await supabase
        .from('planning_modification_requests')
        .update({
          statut: nextStatus,
          commentaire_traitement: commentaireTraitement,
          traitee_par: chefInfo?.nomChef || 'Chef d’agence',
          date_traitement: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      toast({
        title: nextStatus === REQUEST_STATUS.APPROVED ? 'Demande validée' : 'Demande refusée',
        description: `La demande de ${request.guichetiere_nom || request.guichetiere_matricule} a bien été traitée.`,
        className: nextStatus === REQUEST_STATUS.APPROVED ? 'bg-green-500 text-white' : 'bg-slate-700 text-white',
      });

      fetchPlanning();
      fetchPlanningRequests();
    } catch (error) {
      toast({
        title: 'Traitement impossible',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 md:space-y-6 p-2 md:p-0">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <Calendar className="mr-3 h-8 w-8" />
            Mon Planning
          </CardTitle>
          <CardDescription>
            Gérez le planning de vos guichetières pour l'agence {nomAgence}.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiStatCard
          icon={CalendarDays}
          label="Affectations du mois"
          value={monthPlanningCount}
          helper="Créneaux planifiés sur la période affichée."
          tone="primary"
        />
        <KpiStatCard
          icon={UserPlus}
          label="Guichetières suivies"
          value={guichetieresCount}
          helper="Guichetières rattachées à l’agence du chef."
          tone="blue"
        />
        <KpiStatCard
          icon={Repeat}
          label="Demandes en attente"
          value={pendingRequestsCount}
          helper="Demandes de modification à traiter sur cette période."
          tone="amber"
        />
      </div>

      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="p-3 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-primary flex items-center">
                <Calendar className="mr-2 md:mr-3 h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" /> Mon Planning - {nomAgence}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm md:text-base">Gérez le planning des guichetières pour votre agence.</CardDescription>
            </div>
            <div className="flex gap-2 self-start sm:self-center">
              <Button size="sm" variant={viewMode === 'month' ? 'default' : 'outline'} onClick={() => setViewMode('month')} disabled={isLoading}>Mois</Button>
              <Button size="sm" variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => setViewMode('week')} disabled={isLoading}>Semaine</Button>
            </div>
          </div>
          <div className="mt-3 md:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 md:gap-4">
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev} disabled={isLoading} className="h-8 w-8 md:h-9 md:w-9"><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-foreground whitespace-nowrap">
                {format(currentMonth, viewMode === 'month' ? 'MMMM yyyy' : "'Semaine du' dd MMMM", { locale: fr })}
              </h2>
              <Button variant="outline" size="icon" onClick={handleNext} disabled={isLoading} className="h-8 w-8 md:h-9 md:w-9"><ChevronRight className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={handleToday} disabled={isLoading} className="text-xs md:text-sm">Aujourd'hui</Button>
              <input
                type="date"
                disabled={isLoading}
                value={format(currentMonth, 'yyyy-MM-dd')}
                onChange={(e) => { if (e.target.value) setCurrentMonth(parseISO(e.target.value)); }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                title="Aller à une date"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleCopyPrevious('week')} disabled={isLoading} className="text-xs md:text-sm"><Copy className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" /> Copier Sem.</Button>
              <Button size="sm" variant="outline" onClick={() => handleCopyPrevious('month')} disabled={isLoading} className="text-xs md:text-sm"><Copy className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" /> Copier Mois</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          {isLoading && Object.keys(planning).length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm md:text-base">Chargement du planning...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border shadow-sm">
              {/* En-tête jours */}
              <div className="grid grid-cols-7 bg-muted/60">
                {(viewMode === 'week'
                  ? days.map(d => format(d, 'EEE', { locale: fr }))
                  : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
                ).map((dayName, i) => (
                  <div key={i} className="py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{dayName}</div>
                ))}
              </div>
              {/* Grille compacte */}
              <div className="grid grid-cols-7 divide-x divide-y divide-border">
                {days.map((day, dayIdx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayPlanning = planning[dateStr] || [];
                  const dayRequests = requestsByDate[dateStr] || [];
                  const isCurrentMonthDay = viewMode === 'month' ? isSameMonth(day, currentMonth) : true;
                  const isToday = isSameDay(day, new Date());
                  const isWeekend = [0, 6].includes(getDay(day));

                  return (
                    <div
                      key={day.toString()}
                      className={`group flex min-h-[90px] flex-col
                        ${viewMode === 'month' && dayIdx === 0 ? colStartClasses : ''}
                        ${!isCurrentMonthDay ? 'bg-muted/10' : isWeekend ? 'bg-slate-50/40' : 'bg-card'}
                      `}
                    >
                      {/* Header compact */}
                      <div className={`flex items-center justify-between px-1.5 py-1 ${isToday ? 'bg-primary text-white' : !isCurrentMonthDay ? '' : isWeekend ? 'bg-muted/20' : ''}`}>
                        <time dateTime={dateStr} className={`text-xs font-bold ${isToday ? 'text-white' : !isCurrentMonthDay ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </time>
                        <div className="flex items-center gap-0.5">
                          {dayRequests.length > 0 && (
                            <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${isToday ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                              {dayRequests.length}
                            </span>
                          )}
                          {isCurrentMonthDay && (
                            <button
                              className={`flex h-4 w-4 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 ${isToday ? 'text-white/70 hover:bg-white/20' : 'text-muted-foreground/30 hover:bg-primary/10 hover:text-primary'}`}
                              onClick={() => openAddModal(day)}
                              disabled={isLoading}
                            >
                              <PlusCircle className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Corps compact */}
                      <div className="flex-1 px-1.5 py-1 space-y-0.5">
                        <AnimatePresence>
                          {dayPlanning.map(event => {
                            const guichetiere = guichetieresAgence.find(g => g.id === event.guichetiereId);
                            const linkedRequest = requestsByPlanningId[String(event.planningId)];
                            const initials = guichetiere
                              ? `${guichetiere.prenom.charAt(0)}${guichetiere.nom.charAt(0)}`.toUpperCase()
                              : '?';
                            const name = guichetiere ? `${guichetiere.prenom.charAt(0)}. ${guichetiere.nom}` : 'Inconnue';

                            return (
                              <motion.div
                                key={event.planningId}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70"
                                onClick={() => openEditModal(event, day)}
                              >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] font-bold text-white
                                  ${event.est_remplacante ? 'bg-orange-400' : isToday ? 'bg-white/90 !text-primary' : 'bg-primary'}
                                `}>
                                  {initials}
                                </span>
                                <span className={`truncate text-[0.6rem] font-medium leading-tight ${!isCurrentMonthDay ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                                  {name}
                                </span>
                                {linkedRequest && <span className="ml-auto shrink-0 text-[0.5rem] text-amber-600">!</span>}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Demandes de modification des guichetières</CardTitle>
          <CardDescription>
            Suivez les demandes envoyées par vos guichetières et validez-les directement depuis cet espace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {planningRequests.length === 0
                ? 'Aucune demande de modification sur cette période.'
                : `${planningRequests.length} demande(s) affichée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Guichetière</TableHead>
                <TableHead>Date planifiée</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date souhaitée</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planningRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.guichetiere_nom || request.guichetiere_matricule}</TableCell>
                  <TableCell>{formatDisplayDate(request.date_planning)}</TableCell>
                  <TableCell>{getPlanningRequestTypeLabel(request.type_demande)}</TableCell>
                  <TableCell>{formatDisplayDate(request.date_souhaitee)}</TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal">
                    {request.motif || 'Aucun motif'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getRequestStatusBadgeClass(request.statut)}>{request.statut}</Badge>
                    {request.commentaire_traitement ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.commentaire_traitement}
                        <br />
                        {formatDisplayDateTime(request.date_traitement)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {request.statut === REQUEST_STATUS.PENDING ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleProcessPlanningRequest(request, REQUEST_STATUS.APPROVED)}
                          disabled={isLoading}
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleProcessPlanningRequest(request, REQUEST_STATUS.REFUSED)}
                          disabled={isLoading}
                        >
                          Refuser
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Traitée par {request.traitee_par || 'N/A'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-primary text-lg md:text-xl">Ajouter au Planning</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Pour le {selectedDate && format(selectedDate, 'eeee dd MMMM yyyy', { locale: fr })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 md:py-4 space-y-3 md:space-y-4">
            <Combobox
              options={availableGuichetieresForAddModal}
              value={selectedGuichetiereId}
              onSelect={(value) => setSelectedGuichetiereId(value)}
              placeholder="Sélectionner une guichetière"
              searchPlaceholder="Rechercher..."
              emptyText={availableGuichetieresForAddModal.length === 0 && guichetieresAgence.length > 0 ? "Aucune guichetière disponible." : "Aucune guichetière."}
              disabled={isLoading}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm" disabled={isLoading}>Annuler</Button></DialogClose>
            <Button size="sm" onClick={handleAddGuichetiereToPlanning} disabled={isLoading || !selectedGuichetiereId}>
              {isLoading ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-primary text-lg md:text-xl">Modifier l'Affectation</DialogTitle>
            {editingEvent && (
                <DialogDescription className="text-xs md:text-sm">
                    Guichetière: {guichetieresAgence.find(g => g.id === editingEvent.guichetiereId)?.prenom} {guichetieresAgence.find(g => g.id === editingEvent.guichetiereId)?.nom} <br/>
                    Date: {format(editingEvent.date, 'eeee dd MMMM yyyy', { locale: fr })}
                </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-3 md:py-4 space-y-4">
            <div>
                <Label className="text-xs md:text-sm">Remplacer par :</Label>
                <Combobox
                  options={availableGuichetieresForReplaceModal}
                  value={replacementGuichetiereId}
                  onSelect={(value) => setReplacementGuichetiereId(value)}
                  placeholder="Sélectionner remplaçante"
                  searchPlaceholder="Rechercher..."
                  emptyText={availableGuichetieresForReplaceModal.length === 0 ? "Aucune remplaçante disponible." : "Aucune guichetière."}
                  disabled={isLoading}
                />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="destructive" size="sm" onClick={() => handleRemoveGuichetiereFromPlanning(editingEvent?.planningId)} disabled={isLoading} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4"/> Supprimer l'affectation
            </Button>
            <div className="flex-grow sm:flex-grow-0"></div>
            <DialogClose asChild><Button variant="outline" size="sm" disabled={isLoading} className="w-full sm:w-auto">Annuler</Button></DialogClose>
            <Button size="sm" onClick={handleReplaceGuichetiere} disabled={isLoading || !replacementGuichetiereId} className="w-full sm:w-auto">
                <Repeat className="mr-2 h-4 w-4"/> Remplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default MonPlanningPage;
