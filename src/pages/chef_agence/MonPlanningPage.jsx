
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, ChevronLeft, ChevronRight, PlusCircle, Copy, Edit2, Trash2, UserPlus, Repeat } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addWeeks, subWeeks, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useOutletContext } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { Combobox } from '@/components/ui/Combobox';
import { Label } from '@/components/ui/label';

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

  useEffect(() => {
    fetchPlanning();
    fetchGuichetieres();
  }, [fetchPlanning, fetchGuichetieres]);

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


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 md:space-y-6 p-2 md:p-0">
      <Card className="shadow-xl glassmorphism">
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
            <div className={`grid ${viewMode === 'month' ? 'grid-cols-7' : 'grid-cols-7'} gap-px border-l border-t border-border bg-border overflow-hidden rounded-lg`}>
              {viewMode === 'month' && ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(dayName => (
                <div key={dayName} className="py-1 md:py-2 text-center font-medium text-xs md:text-sm text-muted-foreground bg-card border-r border-b">{dayName}</div>
              ))}
              {days.map((day, dayIdx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayPlanning = planning[dateStr] || [];
                const isCurrentMonthDay = viewMode === 'month' ? isSameMonth(day, currentMonth) : true;
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toString()}
                    className={`p-1 md:p-2 min-h-[80px] sm:min-h-[100px] md:min-h-[120px] bg-card border-r border-b relative flex flex-col
                      ${viewMode === 'month' && dayIdx === 0 ? colStartClasses : ''}
                      ${!isCurrentMonthDay ? 'bg-muted/30 dark:bg-muted/10 text-muted-foreground/50' : ''}
                      ${isToday ? 'ring-2 ring-primary z-10' : ''}
                    `}
                  >
                    <time dateTime={dateStr} className={`text-xs md:text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {format(day, 'd')}
                      {viewMode === 'week' && <span className="block text-xs font-normal text-muted-foreground">{format(day, 'EEE', {locale: fr})}</span>}
                    </time>
                    <AnimatePresence>
                      {dayPlanning.map(event => {
                        const guichetiere = guichetieresAgence.find(g => g.id === event.guichetiereId);
                        const remplacanteDe = event.remplacante_de_id ? guichetieresAgence.find(g => g.id === event.remplacante_de_id) : null;
                        const bgColor = event.est_remplacante ? 'bg-orange-400/20 dark:bg-orange-600/30' : 'bg-primary/10 dark:bg-primary/20';
                        const textColor = event.est_remplacante ? 'text-orange-700 dark:text-orange-300' : 'text-black dark:text-white';
                        
                        return (
                          <motion.div
                            key={event.planningId}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className={`mt-1 p-1 rounded-md text-[10px] md:text-xs flex justify-between items-center ${bgColor}`}
                          >
                            <span className={`truncate ${textColor}`}>
                                {guichetiere ? `${guichetiere.prenom.charAt(0)}. ${guichetiere.nom}` : 'Inconnue'}
                                {event.est_remplacante && remplacanteDe && <span className="block text-[8px] md:text-[10px] opacity-80">(R: {remplacanteDe.prenom.charAt(0)}. {remplacanteDe.nom})</span>}
                            </span>
                            <Button variant="ghost" size="icon" className="h-4 w-4 md:h-5 md:w-5 text-blue-500 hover:text-blue-700" onClick={() => openEditModal(event, day)} disabled={isLoading}>
                              <Edit2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            </Button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {isCurrentMonthDay && (
                      <Button variant="ghost" size="icon" className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 h-6 w-6 md:h-7 md:w-7 text-primary hover:bg-primary/10" onClick={() => openAddModal(day)} disabled={isLoading}>
                        <PlusCircle className="h-4 w-4 md:h-5 md:w-5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
