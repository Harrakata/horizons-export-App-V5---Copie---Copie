import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, ClipboardList, Pencil, Search, ShieldAlert, TimerReset, Wrench } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
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
      agence_id: Number(formData.agenceId),
      agence_nom: selectedAgency.nom,
      technicien_id: Number(formData.technicienId),
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
            {canManage && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    className="bg-gradient-to-r from-primary to-green-600 text-white hover:from-primary/90 hover:to-green-600/90"
                    onClick={() => openDialog()}
                    disabled={isLoading}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Planifier une maintenance
                  </Button>
                </DialogTrigger>
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

                  <DialogFooter>
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
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!canManage && readOnlyMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {readOnlyMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <ClipboardList className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Plannings actifs</p>
                  <p className="text-2xl font-bold">{planningStats.totalCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Maintenances effectuées</p>
                  <p className="text-2xl font-bold">{planningStats.completedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <ShieldAlert className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Maintenances non effectuées</p>
                  <p className="text-2xl font-bold">{planningStats.missedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <TimerReset className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Taux de réalisation</p>
                  <p className="text-2xl font-bold">{planningStats.completionRate}%</p>
                </div>
              </CardContent>
            </Card>
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
          <Table>
            <TableCaption>
              {filteredRows.length === 0
                ? emptyTitle
                : `${filteredRows.length} planification(s) maintenance affichée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Créneau</TableHead>
                {showRegionColumn && <TableHead>Région</TableHead>}
                {showAgenceColumn && <TableHead>Agence</TableHead>}
                {showTechnicienColumn && <TableHead>Technicien</TableHead>}
                <TableHead>Suivi</TableHead>
                <TableHead>Interventions</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                    String(selectedPlanningId) === String(row.id) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedPlanningId(row.id)}
                >
                  <TableCell>{formatMaintenancePlanningDate(row.date_planification)}</TableCell>
                  <TableCell>{row.creneauLabel}</TableCell>
                  {showRegionColumn && <TableCell>{row.regionNom}</TableCell>}
                  {showAgenceColumn && <TableCell>{row.agenceNom}</TableCell>}
                  {showTechnicienColumn && (
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.technicienNom}</span>
                        {row.technicienMatricule && (
                          <span className="text-xs text-muted-foreground">{row.technicienMatricule}</span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className={row.executionMeta.className}>
                      {row.executionMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.matchedInterventions.length}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="icon" onClick={(event) => {
                          event.stopPropagation();
                          openDialog(row);
                        }} disabled={isLoading}>
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        {row.executionStatus !== 'annulee' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCancelPlanning(row.id);
                            }}
                            disabled={isLoading}
                          >
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
