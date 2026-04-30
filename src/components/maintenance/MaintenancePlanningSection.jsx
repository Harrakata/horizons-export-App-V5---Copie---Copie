import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { addMonths, addWeeks, endOfMonth, endOfWeek, eachDayOfInterval, format, getDay, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Copy, Pencil, PlusCircle, Search, ShieldAlert, TimerReset, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { supabase } from '@/lib/supabaseClient';
import { buildRegionOptions, fetchRegions } from '@/lib/regions';
import { formatMaintenanceDateTime, getMaintenanceInterventionTypeLabel, normalizeMaintenanceText } from '@/lib/maintenanceMonitoring';
import {
  buildMaintenancePlanningRows,
  checkMaintenancePlanningConflicts,
  extractMaintenancePlanningDateKey,
  formatMaintenancePlanningDate,
  getMaintenancePlanningShiftLabel,
  getMaintenancePlanningStats,
  MAINTENANCE_SHIFT_OPTIONS,
} from '@/lib/maintenancePlanning';

const ALL_FILTER_VALUE = '__all__';

const buildDefaultFormData = ({
  lockedAgency = null,
  lockedRegion = '',
  lockedTechnicienId = null,
  currentPlanning = null,
}) => ({
  date_planification:
    extractMaintenancePlanningDateKey(currentPlanning?.date_planification) ||
    extractMaintenancePlanningDateKey(new Date()),
  creneau: currentPlanning?.creneau || 'matin',
  region: currentPlanning?.region || lockedRegion || lockedAgency?.region || '',
  agenceId: currentPlanning?.agence_id ? String(currentPlanning.agence_id) : lockedAgency?.id ? String(lockedAgency.id) : '',
  technicienId: currentPlanning?.technicien_id
    ? String(currentPlanning.technicien_id)
    : lockedTechnicienId
      ? String(lockedTechnicienId)
      : '',
  notes: currentPlanning?.notes || '',
});

const MaintenancePlanningSection = ({
  title,
  description,
  canManage = false,
  lockedAgenceId = null,
  lockedAgenceName = '',
  lockedRegion = '',
  lockedTechnicienId = null,
  emptyTitle = 'Aucune planification trouvée.',
  readOnlyMessage = '',
}) => {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [terminaux, setTerminaux] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [planningEntries, setPlanningEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPlanning, setCurrentPlanning] = useState(null);
  const [selectedPlanningId, setSelectedPlanningId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [formData, setFormData] = useState(
    buildDefaultFormData({
      lockedAgency: null,
      lockedRegion,
      lockedTechnicienId,
      currentPlanning: null,
    })
  );
  const [filters, setFilters] = useState({
    region: lockedRegion || ALL_FILTER_VALUE,
    agenceId: lockedAgenceId ? String(lockedAgenceId) : ALL_FILTER_VALUE,
    technicienId: lockedTechnicienId ? String(lockedTechnicienId) : ALL_FILTER_VALUE,
    creneau: ALL_FILTER_VALUE,
    statut: ALL_FILTER_VALUE,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [
      { data: regionsData, error: regionsError },
      { data: agencesData, error: agencesError },
      { data: techniciensData, error: techniciensError },
      { data: terminauxData, error: terminauxError },
      { data: interventionsData, error: interventionsError },
      { data: planningData, error: planningError },
    ] = await Promise.all([
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region').order('nom', { ascending: true }),
      supabase.from('techniciens').select('id, matricule, nom, prenom, telephone, email, photo_url').order('nom', { ascending: true }),
      supabase.from('terminaux').select('id, agence_id, reference, type_terminal, position').order('reference', { ascending: true }),
      supabase
        .from('interventions_maintenance')
        .select('id, terminal_id, technicien_id, type_intervention, sous_ensemble, statut, commentaire, date_intervention, date_fin')
        .order('date_intervention', { ascending: false }),
      supabase
        .from('planning_maintenance')
        .select('*')
        .order('date_planification', { ascending: false })
        .order('creneau', { ascending: true }),
    ]);

    if (regionsError) {
      toast({ title: 'Erreur chargement régions', description: regionsError.message, variant: 'destructive' });
    } else {
      setRegions(regionsData || []);
    }

    if (agencesError) {
      toast({ title: 'Erreur chargement agences', description: agencesError.message, variant: 'destructive' });
    } else {
      setAgences(agencesData || []);
    }

    if (techniciensError) {
      toast({ title: 'Erreur chargement techniciens', description: techniciensError.message, variant: 'destructive' });
    } else {
      setTechniciens(techniciensData || []);
    }

    if (terminauxError) {
      toast({ title: 'Erreur chargement terminaux', description: terminauxError.message, variant: 'destructive' });
    } else {
      setTerminaux(terminauxData || []);
    }

    if (interventionsError) {
      toast({ title: 'Erreur chargement interventions', description: interventionsError.message, variant: 'destructive' });
    } else {
      setInterventions(interventionsData || []);
    }

    if (planningError) {
      toast({
        title: 'Erreur chargement planning maintenance',
        description: planningError.message.includes('planning_maintenance')
          ? 'La table planning_maintenance est absente de Supabase. Il faut exécuter le script SQL de planification.'
          : planningError.message,
        variant: 'destructive',
      });
      setPlanningEntries([]);
    } else {
      setPlanningEntries(planningData || []);
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agencesById = useMemo(
    () =>
      agences.reduce((accumulator, agence) => {
        accumulator[String(agence.id)] = agence;
        return accumulator;
      }, {}),
    [agences]
  );

  const techniciensById = useMemo(
    () =>
      techniciens.reduce((accumulator, technicien) => {
        accumulator[String(technicien.id)] = technicien;
        return accumulator;
      }, {}),
    [techniciens]
  );

  const terminauxById = useMemo(
    () =>
      terminaux.reduce((accumulator, terminal) => {
        accumulator[String(terminal.id)] = terminal;
        return accumulator;
      }, {}),
    [terminaux]
  );

  const resolvedLockedAgency = useMemo(() => {
    if (!lockedAgenceId && !lockedAgenceName) return null;

    if (lockedAgenceId) {
      return agences.find((agence) => String(agence.id) === String(lockedAgenceId)) || null;
    }

    return (
      agences.find(
        (agence) => normalizeMaintenanceText(agence.nom) === normalizeMaintenanceText(lockedAgenceName)
      ) || null
    );
  }, [agences, lockedAgenceId, lockedAgenceName]);

  useEffect(() => {
    if (!resolvedLockedAgency && !lockedTechnicienId && !lockedRegion) return;

    setFilters((previousState) => ({
      ...previousState,
      region: lockedRegion || resolvedLockedAgency?.region || previousState.region,
      agenceId: resolvedLockedAgency?.id ? String(resolvedLockedAgency.id) : previousState.agenceId,
      technicienId: lockedTechnicienId ? String(lockedTechnicienId) : previousState.technicienId,
    }));
  }, [lockedRegion, lockedTechnicienId, resolvedLockedAgency]);

  const planningRows = useMemo(
    () =>
      buildMaintenancePlanningRows({
        planningEntries,
        agencesById,
        techniciensById,
        terminauxById,
        interventions,
      }),
    [agencesById, interventions, planningEntries, techniciensById, terminauxById]
  );

  const regionOptions = useMemo(
    () => buildRegionOptions(regions, { includeAllLabel: 'Toutes les régions' }),
    [regions]
  );

  const visibleAgences = useMemo(() => {
    if (resolvedLockedAgency) return [resolvedLockedAgency];

    return agences.filter(
      (agence) =>
        filters.region === ALL_FILTER_VALUE ||
        !filters.region ||
        normalizeMaintenanceText(agence.region) === normalizeMaintenanceText(filters.region)
    );
  }, [agences, filters.region, resolvedLockedAgency]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeMaintenanceText(searchTerm);

    return planningRows
      .filter((row) =>
        resolvedLockedAgency
          ? String(row.agence_id) === String(resolvedLockedAgency.id)
          : filters.agenceId === ALL_FILTER_VALUE
            ? true
            : String(row.agence_id) === String(filters.agenceId)
      )
      .filter((row) =>
        lockedTechnicienId
          ? String(row.technicien_id) === String(lockedTechnicienId)
          : filters.technicienId === ALL_FILTER_VALUE
            ? true
            : String(row.technicien_id) === String(filters.technicienId)
      )
      .filter((row) =>
        lockedRegion || resolvedLockedAgency?.region
          ? normalizeMaintenanceText(row.regionNom) === normalizeMaintenanceText(lockedRegion || resolvedLockedAgency?.region)
          : filters.region === ALL_FILTER_VALUE
            ? true
            : normalizeMaintenanceText(row.regionNom) === normalizeMaintenanceText(filters.region)
      )
      .filter((row) => (filters.creneau === ALL_FILTER_VALUE ? true : row.creneau === filters.creneau))
      .filter((row) => (filters.statut === ALL_FILTER_VALUE ? true : row.executionStatus === filters.statut))
      .filter((row) => !normalizedSearch || row.searchBlob.includes(normalizedSearch));
  }, [filters.agenceId, filters.creneau, filters.region, filters.statut, filters.technicienId, lockedRegion, lockedTechnicienId, planningRows, resolvedLockedAgency, searchTerm]);

  const selectedPlanning =
    filteredRows.find((row) => String(row.id) === String(selectedPlanningId)) || null;

  useEffect(() => {
    const fallbackId = filteredRows[0]?.id || null;

    if (!selectedPlanningId && fallbackId) {
      setSelectedPlanningId(fallbackId);
      return;
    }

    if (
      selectedPlanningId &&
      !filteredRows.some((row) => String(row.id) === String(selectedPlanningId))
    ) {
      setSelectedPlanningId(fallbackId);
    }
  }, [filteredRows, selectedPlanningId]);

  const planningStats = useMemo(() => getMaintenancePlanningStats(filteredRows), [filteredRows]);

  const calendarDays = useMemo(() => {
    const start = viewMode === 'month'
      ? startOfMonth(currentCalendarDate)
      : startOfWeek(currentCalendarDate, { weekStartsOn: 1 });
    const end = viewMode === 'month'
      ? endOfMonth(currentCalendarDate)
      : endOfWeek(currentCalendarDate, { weekStartsOn: 1 });

    return eachDayOfInterval({ start, end });
  }, [currentCalendarDate, viewMode]);

  const colStartClass = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentCalendarDate);
    const firstDayOfWeek = getDay(firstDayOfMonth);
    const adjustedFirstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const classes = ['col-start-1', 'col-start-2', 'col-start-3', 'col-start-4', 'col-start-5', 'col-start-6', 'col-start-7'];
    return classes[adjustedFirstDayOfWeek];
  }, [currentCalendarDate]);

  const filteredRowsByDate = useMemo(
    () =>
      filteredRows.reduce((accumulator, row) => {
        const dateKey = extractMaintenancePlanningDateKey(row.date_planification);
        if (!accumulator[dateKey]) accumulator[dateKey] = [];
        accumulator[dateKey].push(row);
        accumulator[dateKey].sort((firstRow, secondRow) => {
          if (firstRow.creneau !== secondRow.creneau) return firstRow.creneau === 'matin' ? -1 : 1;
          return firstRow.technicienNom.localeCompare(secondRow.technicienNom, 'fr');
        });
        return accumulator;
      }, {}),
    [filteredRows]
  );

  const technicienOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Tous les techniciens' },
      ...techniciens.map((technicien) => ({
        value: String(technicien.id),
        label: `${technicien.prenom} ${technicien.nom}${technicien.matricule ? ` • ${technicien.matricule}` : ''}`,
      })),
    ],
    [techniciens]
  );

  const filteredAgencesForDialog = useMemo(() => {
    if (resolvedLockedAgency) return [resolvedLockedAgency];
    if (!formData.region) return agences;

    return agences.filter(
      (agence) => normalizeMaintenanceText(agence.region) === normalizeMaintenanceText(formData.region)
    );
  }, [agences, formData.region, resolvedLockedAgency]);

  const resetDialogState = useCallback(
    (planning = null) => {
      setCurrentPlanning(planning);
      setFormData(
        buildDefaultFormData({
          lockedAgency: resolvedLockedAgency,
          lockedRegion,
          lockedTechnicienId,
          currentPlanning: planning,
        })
      );
    },
    [lockedRegion, lockedTechnicienId, resolvedLockedAgency]
  );

  const openDialog = (planning = null) => {
    resetDialogState(planning);
    setIsDialogOpen(true);
  };

  const openCreateDialogForDate = (date) => {
    resetDialogState();
    setFormData((previousState) => ({
      ...previousState,
      date_planification: extractMaintenancePlanningDateKey(date),
    }));
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!canManage) {
      toast({ title: 'Lecture seule', description: 'La planification est en lecture seule sur cet écran.', variant: 'destructive' });
      return;
    }

    if (!formData.date_planification || !formData.creneau || !formData.agenceId || !formData.technicienId) {
      toast({ title: 'Champs requis', description: 'Veuillez renseigner la date, le créneau, l’agence et le technicien.', variant: 'destructive' });
      return;
    }

    const selectedAgency = agencesById[String(formData.agenceId)] || null;
    const selectedTechnicien = techniciensById[String(formData.technicienId)] || null;

    if (!selectedAgency || !selectedTechnicien) {
      toast({ title: 'Sélection invalide', description: 'L’agence ou le technicien choisi est introuvable.', variant: 'destructive' });
      return;
    }

    const payload = {
      date_planification: formData.date_planification,
      creneau: formData.creneau,
      region: selectedAgency.region || formData.region || null,
      agence_id: formData.agenceId || null,
      agence_nom: selectedAgency.nom,
      technicien_id: formData.technicienId || null,
      technicien_label: `${selectedTechnicien.prenom} ${selectedTechnicien.nom}`.trim(),
      technicien_matricule: selectedTechnicien.matricule || null,
      notes: formData.notes.trim() || null,
      statut: 'planifiee',
    };

    const conflictMessage = checkMaintenancePlanningConflicts(planningEntries, payload, currentPlanning?.id);
    if (conflictMessage) {
      toast({ title: 'Conflit de planning', description: conflictMessage, variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    const query = currentPlanning
      ? supabase.from('planning_maintenance').update(payload).eq('id', currentPlanning.id)
      : supabase.from('planning_maintenance').insert(payload);

    const { error } = await query;

    if (error) {
      toast({ title: "Erreur d'enregistrement", description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: currentPlanning ? 'Planning mis à jour' : 'Planning créé',
        description: currentPlanning
          ? 'La planification maintenance a été mise à jour.'
          : 'La maintenance a été planifiée avec succès.',
        className: 'bg-green-500 text-white',
      });
      setIsDialogOpen(false);
      resetDialogState();
      loadData();
    }

    setIsLoading(false);
  };

  const handleCancelPlanning = async (planningId) => {
    if (!canManage) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('planning_maintenance')
      .update({ statut: 'annulee' })
      .eq('id', planningId);

    if (error) {
      toast({ title: 'Erreur annulation', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Planification annulée',
        description: 'Le créneau a été retiré du planning actif.',
        className: 'bg-green-500 text-white',
      });
      loadData();
    }

    setIsLoading(false);
  };

  const handlePrev = () => {
    setCurrentCalendarDate((previousDate) =>
      viewMode === 'month' ? subMonths(previousDate, 1) : subWeeks(previousDate, 1)
    );
  };

  const handleNext = () => {
    setCurrentCalendarDate((previousDate) =>
      viewMode === 'month' ? addMonths(previousDate, 1) : addWeeks(previousDate, 1)
    );
  };

  const handleToday = () => {
    setCurrentCalendarDate(new Date());
  };

  const handleCopyPrevious = async (period) => {
    if (!canManage) return;

    const sourceStart = period === 'month'
      ? startOfMonth(subMonths(currentCalendarDate, 1))
      : startOfWeek(subWeeks(currentCalendarDate, 1), { weekStartsOn: 1 });
    const sourceEnd = period === 'month'
      ? endOfMonth(subMonths(currentCalendarDate, 1))
      : endOfWeek(subWeeks(currentCalendarDate, 1), { weekStartsOn: 1 });
    const targetStart = period === 'month'
      ? startOfMonth(currentCalendarDate)
      : startOfWeek(currentCalendarDate, { weekStartsOn: 1 });

    const sourceRows = filteredRows.filter((row) => {
      const planningDate = parseISO(extractMaintenancePlanningDateKey(row.date_planification));
      return planningDate >= sourceStart && planningDate <= sourceEnd && row.executionStatus !== 'annulee';
    });

    if (sourceRows.length === 0) {
      toast({
        title: 'Copie impossible',
        description: `Aucune planification trouvée pour ${period === 'month' ? 'le mois' : 'la semaine'} précédent(e).`,
        variant: 'destructive',
      });
      return;
    }

    const pendingEntries = [];

    sourceRows.forEach((row) => {
      const sourceDate = parseISO(extractMaintenancePlanningDateKey(row.date_planification));
      const targetDate = new Date(targetStart);
      const dayOffset = Math.round((sourceDate.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));
      targetDate.setDate(targetStart.getDate() + dayOffset);

      if (period === 'month' && !isSameMonth(targetDate, currentCalendarDate)) return;

      const payload = {
        date_planification: extractMaintenancePlanningDateKey(targetDate),
        creneau: row.creneau,
        region: row.regionNom || null,
        agence_id: row.agence_id || null,
        agence_nom: row.agenceNom,
        technicien_id: row.technicien_id || null,
        technicien_label: row.technicienNom,
        technicien_matricule: row.technicienMatricule || null,
        notes: row.notes || null,
        statut: 'planifiee',
      };

      const conflictMessage = checkMaintenancePlanningConflicts(
        [
          ...planningEntries,
          ...pendingEntries.map((entry, index) => ({ ...entry, id: `pending-${index}` })),
        ],
        payload
      );

      if (!conflictMessage) {
        pendingEntries.push(payload);
      }
    });

    if (pendingEntries.length === 0) {
      toast({
        title: 'Copie non effectuée',
        description: 'Tous les créneaux étaient déjà pris ou entraient en conflit.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from('planning_maintenance').insert(pendingEntries);

    if (error) {
      toast({ title: 'Erreur de copie', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Planning copié',
        description: `${pendingEntries.length} créneau(x) ont été copiés depuis ${period === 'month' ? 'le mois' : 'la semaine'} précédent(e).`,
        className: 'bg-green-500 text-white',
      });
      loadData();
    }
    setIsLoading(false);
  };

  const showRegionColumn = !resolvedLockedAgency && !lockedRegion;
  const showAgenceColumn = !resolvedLockedAgency;
  const showTechnicienColumn = !lockedTechnicienId;

  return (
    <div className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center text-2xl font-bold text-primary">
                <ClipboardList className="mr-3 h-7 w-7" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex gap-2 self-start sm:self-center">
              <Button
                size="sm"
                variant={viewMode === 'month' ? 'default' : 'outline'}
                onClick={() => setViewMode('month')}
                disabled={isLoading}
              >
                Mois
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'week' ? 'default' : 'outline'}
                onClick={() => setViewMode('week')}
                disabled={isLoading}
              >
                Semaine
              </Button>
            </div>
          </div>

          {!canManage && readOnlyMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {readOnlyMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard
              icon={ClipboardList}
              label="Plannings actifs"
              value={planningStats.totalCount}
              helper="Créneaux de maintenance actuellement visibles sur la période."
              tone="primary"
            />
            <KpiStatCard
              icon={CheckCircle2}
              label="Maintenances effectuées"
              value={planningStats.completedCount}
              helper="Créneaux couverts par une intervention réalisée."
              tone="emerald"
            />
            <KpiStatCard
              icon={ShieldAlert}
              label="Maintenances non effectuées"
              value={planningStats.missedCount}
              helper="Créneaux échus sans intervention constatée."
              tone="red"
            />
            <KpiStatCard
              icon={TimerReset}
              label="Taux de réalisation"
              value={`${planningStats.completionRate}%`}
              helper="Pourcentage de créneaux réellement exécutés."
              tone="blue"
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev} disabled={isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-foreground whitespace-nowrap">
                {format(currentCalendarDate, viewMode === 'month' ? 'MMMM yyyy' : "'Semaine du' dd MMMM", { locale: fr })}
              </h2>
              <Button variant="outline" size="icon" onClick={handleNext} disabled={isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleToday} disabled={isLoading}>
                Aujourd&apos;hui
              </Button>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCopyPrevious('week')} disabled={isLoading}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copier Sem.
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCopyPrevious('month')} disabled={isLoading}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copier Mois
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {showRegionColumn && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Région</p>
                <Select
                  value={filters.region}
                  onValueChange={(value) =>
                    setFilters((previousState) => ({
                      ...previousState,
                      region: value,
                      agenceId: ALL_FILTER_VALUE,
                    }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les régions" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showAgenceColumn && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Agence</p>
                <Select
                  value={filters.agenceId}
                  onValueChange={(value) => setFilters((previousState) => ({ ...previousState, agenceId: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les agences" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>Toutes les agences</SelectItem>
                    {visibleAgences.map((agence) => (
                      <SelectItem key={agence.id} value={String(agence.id)}>
                        {agence.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showTechnicienColumn && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Technicien</p>
                <Select
                  value={filters.technicienId}
                  onValueChange={(value) => setFilters((previousState) => ({ ...previousState, technicienId: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les techniciens" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicienOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Créneau</p>
              <Select
                value={filters.creneau}
                onValueChange={(value) => setFilters((previousState) => ({ ...previousState, creneau: value }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les créneaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Tous les créneaux</SelectItem>
                  {MAINTENANCE_SHIFT_OPTIONS.map((shift) => (
                    <SelectItem key={shift.value} value={shift.value}>
                      {shift.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Suivi</p>
              <Select
                value={filters.statut}
                onValueChange={(value) => setFilters((previousState) => ({ ...previousState, statut: value }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les suivis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Tous les suivis</SelectItem>
                  <SelectItem value="planifiee">Planifiée</SelectItem>
                  <SelectItem value="effectuee">Effectuée</SelectItem>
                  <SelectItem value="non_effectuee">Non effectuée</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-5">
              <p className="text-sm font-medium">Recherche</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Agence, technicien, créneau, commentaire, intervention..."
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && filteredRows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Chargement du planning maintenance...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-border">
              <div className="grid grid-cols-7 gap-px">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((dayName) => (
                  <div key={dayName} className="bg-card py-2 text-center text-sm font-medium text-muted-foreground">
                    {dayName}
                  </div>
                ))}

                {calendarDays.map((day, dayIndex) => {
                  const dateKey = extractMaintenancePlanningDateKey(day);
                  const dayRows = filteredRowsByDate[dateKey] || [];
                  const isCurrentMonthDay = viewMode === 'month' ? isSameMonth(day, currentCalendarDate) : true;
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dateKey}
                      className={`relative min-h-[120px] bg-card p-2 ${
                        viewMode === 'month' && dayIndex === 0 ? colStartClass : ''
                      } ${!isCurrentMonthDay ? 'bg-muted/30 text-muted-foreground/50' : ''} ${isToday ? 'ring-2 ring-primary z-10' : ''}`}
                    >
                      <time dateTime={dateKey} className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {format(day, 'd')}
                        {viewMode === 'week' && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {format(day, 'EEE', { locale: fr })}
                          </span>
                        )}
                      </time>

                      <div className="mt-2 space-y-1">
                        {dayRows.map((row) => (
                          <motion.div
                            key={row.id}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedPlanningId(row.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedPlanningId(row.id);
                              }
                            }}
                            className={`w-full rounded-md border px-2 py-1 text-left text-[11px] transition ${
                              String(selectedPlanningId) === String(row.id)
                                ? 'border-primary bg-primary/10'
                                : 'border-transparent bg-emerald-50 hover:border-primary/30 hover:bg-primary/5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium text-slate-900">
                                {showAgenceColumn ? row.agenceNom : row.technicienNom}
                              </span>
                              {canManage && (
                                <button
                                  type="button"
                                  className="shrink-0 text-blue-500 hover:text-blue-700"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openDialog(row);
                                  }}
                                  disabled={isLoading}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {row.creneauLabel} • {showTechnicienColumn ? row.technicienNom : row.agenceNom}
                            </p>
                          </motion.div>
                        ))}
                      </div>

                      {isCurrentMonthDay && canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute bottom-1 right-1 h-7 w-7 text-primary hover:bg-primary/10"
                          onClick={() => openCreateDialogForDate(day)}
                          disabled={isLoading}
                        >
                          <PlusCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && filteredRows.length === 0 && (
            <p className="pt-4 text-center text-sm text-muted-foreground">{emptyTitle}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-2xl text-primary">
              {currentPlanning ? 'Modifier le planning maintenance' : 'Nouvelle planification maintenance'}
            </DialogTitle>
            <DialogDescription>
              Un même technicien ne peut pas être programmé sur deux agences au même créneau.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="planning-date">Date</Label>
              <Input
                id="planning-date"
                type="date"
                value={formData.date_planification}
                onChange={(event) => setFormData((previousState) => ({ ...previousState, date_planification: event.target.value }))}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Créneau</Label>
              <Select
                value={formData.creneau}
                onValueChange={(value) => setFormData((previousState) => ({ ...previousState, creneau: value }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un créneau" />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_SHIFT_OPTIONS.map((shift) => (
                    <SelectItem key={shift.value} value={shift.value}>
                      {shift.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!resolvedLockedAgency && !lockedRegion && (
              <div className="space-y-2">
                <Label>Région</Label>
                <Select
                  value={formData.region}
                  onValueChange={(value) =>
                    setFormData((previousState) => ({
                      ...previousState,
                      region: value,
                      agenceId: '',
                    }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une région" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildRegionOptions(regions).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Agence</Label>
              <Select
                value={formData.agenceId}
                onValueChange={(value) =>
                  setFormData((previousState) => ({
                    ...previousState,
                    agenceId: value,
                    region: agencesById[String(value)]?.region || previousState.region,
                  }))
                }
                disabled={isLoading || Boolean(resolvedLockedAgency)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une agence" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAgencesForDialog.map((agence) => (
                    <SelectItem key={agence.id} value={String(agence.id)}>
                      {agence.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Technicien</Label>
              <Select
                value={formData.technicienId}
                onValueChange={(value) => setFormData((previousState) => ({ ...previousState, technicienId: value }))}
                disabled={isLoading || Boolean(lockedTechnicienId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un technicien" />
                </SelectTrigger>
                <SelectContent>
                  {techniciens.map((technicien) => (
                    <SelectItem key={technicien.id} value={String(technicien.id)}>
                      {technicien.prenom} {technicien.nom}
                      {technicien.matricule ? ` • ${technicien.matricule}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="planning-notes">Notes</Label>
              <Textarea
                id="planning-notes"
                value={formData.notes}
                onChange={(event) => setFormData((previousState) => ({ ...previousState, notes: event.target.value }))}
                placeholder="Consignes, objectif de la visite, terminaux à prioriser..."
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              {canManage && currentPlanning && currentPlanning.executionStatus !== 'annulee' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleCancelPlanning(currentPlanning.id)}
                  disabled={isLoading}
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Annuler le créneau
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={() => resetDialogState()} disabled={isLoading}>
                  Annuler
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? 'Enregistrement...' : currentPlanning ? 'Sauvegarder' : 'Planifier'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedPlanning && (
        <Card className="shadow-xl glassmorphism">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">
              Détail de la planification du {formatMaintenancePlanningDate(selectedPlanning.date_planification)}
            </CardTitle>
            <CardDescription>
              {selectedPlanning.agenceNom} • {selectedPlanning.creneauLabel} • {selectedPlanning.technicienNom}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Région</p>
                <p className="mt-1 font-medium">{selectedPlanning.regionNom}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Agence</p>
                <p className="mt-1 font-medium">{selectedPlanning.agenceNom}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Créneau</p>
                <p className="mt-1 font-medium">{selectedPlanning.creneauLabel}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Suivi</p>
                <div className="mt-2">
                  <Badge variant="outline" className={selectedPlanning.executionMeta.className}>
                    {selectedPlanning.executionMeta.label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Technicien assigné</p>
                <p className="mt-1 font-medium">{selectedPlanning.technicienNom}</p>
                {selectedPlanning.technicienMatricule && (
                  <p className="mt-1 text-sm text-muted-foreground">Matricule: {selectedPlanning.technicienMatricule}</p>
                )}
                {selectedPlanning.technicienTelephone && (
                  <p className="mt-1 text-sm text-muted-foreground">Téléphone: {selectedPlanning.technicienTelephone}</p>
                )}
                {selectedPlanning.technicienEmail && (
                  <p className="mt-1 text-sm text-muted-foreground">Email: {selectedPlanning.technicienEmail}</p>
                )}
              </div>

              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {selectedPlanning.notes || 'Aucune consigne particulière.'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Interventions enregistrées sur ce créneau
                </p>
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                  {selectedPlanning.matchedInterventions.length}
                </Badge>
              </div>

              {selectedPlanning.matchedInterventions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune intervention n’a encore été rattachée à ce créneau de maintenance.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedPlanning.matchedInterventions.map((intervention) => (
                    <div key={intervention.id} className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium">
                            {intervention.terminalReference || `Terminal #${intervention.terminal_id}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {intervention.sous_ensemble || 'Sous-ensemble non renseigné'}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatMaintenanceDateTime(intervention.date_intervention)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                          {getMaintenanceInterventionTypeLabel(intervention.type_intervention)}
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                          {intervention.statut}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">
                        {intervention.commentaire || 'Aucun commentaire technique.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaintenancePlanningSection;
