import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { addMonths, addWeeks, endOfMonth, endOfWeek, eachDayOfInterval, format, getDay, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Copy, FileText, MapPinned, Pencil, PlusCircle, Search, ShieldAlert, TimerReset, Wrench } from 'lucide-react';
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
import { Combobox } from '@/components/ui/Combobox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import MaintenanceAgenciesMap from '@/components/maintenance/MaintenanceAgenciesMap';
import { supabase } from '@/lib/supabaseClient';
import { isSupabaseAuthError } from '@/lib/guichetiereSpace';
import { buildRegionOptions, fetchRegions } from '@/lib/regions';
import { formatMaintenanceDateTime, getMaintenanceInterventionTypeLabel, normalizeMaintenanceText } from '@/lib/maintenanceMonitoring';
import {
  buildMaintenancePlanningRows,
  checkMaintenancePlanningConflicts,
  extractMaintenancePlanningDateKey,
  formatMaintenancePlanningDate,
  getMaintenancePlanningShiftLabel,
  getMaintenancePlanningStats,
  getMaintenanceShiftFromDateTime,
  MAINTENANCE_SHIFT_OPTIONS,
} from '@/lib/maintenancePlanning';

const ALL_FILTER_VALUE = '__all__';

// Couleur de la pastille du calendrier selon l'état de réalisation du créneau,
// pour distinguer d'un coup d'œil les maintenances planifiées des effectuées.
const EXECUTION_PIN_STYLES = {
  planifiee: 'bg-blue-500',
  effectuee: 'bg-emerald-500',
  non_effectuee: 'bg-red-500',
  annulee: 'bg-slate-400',
};

const CALENDAR_LEGEND = [
  { status: 'planifiee', label: 'Planifiée', dot: 'bg-blue-500' },
  { status: 'effectuee', label: 'Effectuée', dot: 'bg-emerald-500' },
  { status: 'non_effectuee', label: 'Non effectuée', dot: 'bg-red-500' },
  { status: 'annulee', label: 'Annulée', dot: 'bg-slate-400' },
];

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
  const [showPlanningMap, setShowPlanningMap] = useState(false);
  const [planningMapDate, setPlanningMapDate] = useState(() => extractMaintenancePlanningDateKey(new Date()));
  const [realizedDetail, setRealizedDetail] = useState(null);
  const [ficheDialog, setFicheDialog] = useState({ open: false, html: '', loading: false });

  const openFiche = async (url) => {
    setFicheDialog({ open: true, html: '', loading: true });
    try {
      const res = await fetch(url);
      const html = await res.text();
      setFicheDialog({ open: true, html, loading: false });
    } catch {
      setFicheDialog({ open: false, html: '', loading: false });
      window.open(url, '_blank', 'noreferrer');
    }
  };

  // Catégories de la légende actuellement affichées sur le calendrier.
  const [activeLegendStatuses, setActiveLegendStatuses] = useState(
    () => new Set(CALENDAR_LEGEND.map((item) => item.status))
  );

  const toggleLegendStatus = (status) => {
    setActiveLegendStatuses((previous) => {
      const next = new Set(previous);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };
  const [formData, setFormData] = useState(
    buildDefaultFormData({
      lockedAgency: null,
      lockedRegion,
      lockedTechnicienId,
      currentPlanning: null,
    })
  );
  // Filtres multi-sélection : tableaux de valeurs. Vide = pas de filtre (tout afficher).
  // Les modes verrouillés (chef d'agence/secteur) restent gérés via les props lockedX.
  const [filters, setFilters] = useState({
    region: [],
    agenceId: [],
    technicienId: [],
    creneau: [],
    statut: [],
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
      supabase.from('agences').select('id, nom, codePDV, region, adresse').eq('is_current', true).order('nom', { ascending: true }),
      supabase.from('techniciens').select('id, matricule, nom, prenom, telephone, email, photo_url').order('nom', { ascending: true }),
      supabase.from('terminaux').select('id, agence_id, reference, type_terminal, position').order('reference', { ascending: true }),
      supabase
        .from('interventions_maintenance')
        .select('id, terminal_id, technicien_id, type_intervention, sous_ensemble, statut, commentaire, date_intervention, date_fin, fiche_url, geo_refused')
        .order('date_intervention', { ascending: false }),
      supabase
        .from('planning_maintenance')
        .select('*')
        .order('date_planification', { ascending: false })
        .order('creneau', { ascending: true }),
    ]);

    if (regionsError && !isSupabaseAuthError(regionsError)) {
      toast({ title: 'Erreur chargement régions', description: regionsError.message, variant: 'destructive' });
    } else {
      setRegions(regionsData || []);
    }

    if (agencesError) {
      if (!isSupabaseAuthError(agencesError)) {
        toast({ title: 'Erreur chargement agences', description: agencesError.message, variant: 'destructive' });
      }
    } else {
      setAgences(agencesData || []);
    }

    if (techniciensError && !isSupabaseAuthError(techniciensError)) {
      toast({ title: 'Erreur chargement techniciens', description: techniciensError.message, variant: 'destructive' });
    } else {
      setTechniciens(techniciensData || []);
    }

    if (terminauxError && !isSupabaseAuthError(terminauxError)) {
      toast({ title: 'Erreur chargement terminaux', description: terminauxError.message, variant: 'destructive' });
    } else {
      setTerminaux(terminauxData || []);
    }

    if (interventionsError && !isSupabaseAuthError(interventionsError)) {
      toast({ title: 'Erreur chargement interventions', description: interventionsError.message, variant: 'destructive' });
    } else {
      setInterventions(interventionsData || []);
    }

    if (planningError) {
      if (!isSupabaseAuthError(planningError)) {
        toast({
          title: 'Erreur chargement planning maintenance',
          description: planningError.message.includes('planning_maintenance')
            ? 'La table planning_maintenance est absente de Supabase. Il faut exécuter le script SQL de planification.'
            : planningError.message,
          variant: 'destructive',
        });
      }
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

  // Les interventions refusées (hors zone) sont annulées : exclues de la couche
  // « réalisée » et de l'appariement avec les créneaux planifiés.
  const validInterventions = useMemo(
    () => (interventions || []).filter((i) => i.geo_refused !== true),
    [interventions]
  );

  const planningRows = useMemo(
    () =>
      buildMaintenancePlanningRows({
        planningEntries,
        agencesById,
        techniciensById,
        terminauxById,
        interventions: validInterventions,
      }),
    [agencesById, validInterventions, planningEntries, techniciensById, terminauxById]
  );

  const regionOptions = useMemo(
    () => buildRegionOptions(regions, { includeAllLabel: 'Régions' }),
    [regions]
  );

  const visibleAgences = useMemo(() => {
    if (resolvedLockedAgency) return [resolvedLockedAgency];

    const effectiveRegions = lockedRegion ? [lockedRegion] : filters.region;
    return agences.filter(
      (agence) =>
        effectiveRegions.length === 0 ||
        effectiveRegions.some((r) => normalizeMaintenanceText(r) === normalizeMaintenanceText(agence.region))
    );
  }, [agences, filters.region, lockedRegion, resolvedLockedAgency]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeMaintenanceText(searchTerm);

    return planningRows
      .filter((row) =>
        resolvedLockedAgency
          ? String(row.agence_id) === String(resolvedLockedAgency.id)
          : filters.agenceId.length === 0
            ? true
            : filters.agenceId.includes(String(row.agence_id))
      )
      .filter((row) =>
        lockedTechnicienId
          ? String(row.technicien_id) === String(lockedTechnicienId)
          : filters.technicienId.length === 0
            ? true
            : filters.technicienId.includes(String(row.technicien_id))
      )
      .filter((row) =>
        lockedRegion || resolvedLockedAgency?.region
          ? normalizeMaintenanceText(row.regionNom) === normalizeMaintenanceText(lockedRegion || resolvedLockedAgency?.region)
          : filters.region.length === 0
            ? true
            : filters.region.some((r) => normalizeMaintenanceText(r) === normalizeMaintenanceText(row.regionNom))
      )
      .filter((row) => (filters.creneau.length === 0 ? true : filters.creneau.includes(row.creneau)))
      .filter((row) => (filters.statut.length === 0 ? true : filters.statut.includes(row.executionStatus)))
      .filter((row) => !normalizedSearch || row.searchBlob.includes(normalizedSearch));
  }, [filters.agenceId, filters.creneau, filters.region, filters.statut, filters.technicienId, lockedRegion, lockedTechnicienId, planningRows, resolvedLockedAgency, searchTerm]);

  const selectedPlanning =
    filteredRows.find((row) => String(row.id) === String(selectedPlanningId)) || null;

  useEffect(() => {
    // Le détail s'ouvre uniquement sur clic d'une intervention (Dialog) :
    // on ne fait que purger une sélection devenue obsolète après filtrage.
    if (
      selectedPlanningId &&
      !filteredRows.some((row) => String(row.id) === String(selectedPlanningId))
    ) {
      setSelectedPlanningId(null);
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

  const planningMapRows = useMemo(
    () => (filteredRowsByDate[planningMapDate] || []).filter((row) => row.executionStatus !== 'annulee'),
    [filteredRowsByDate, planningMapDate]
  );

  const planningMapAgencies = useMemo(() => {
    const rowsByAgency = new Map();

    planningMapRows.forEach((row) => {
      const agencyKey = String(row.agence_id || '').trim();
      if (!agencyKey || rowsByAgency.has(agencyKey)) return;

      rowsByAgency.set(agencyKey, agencesById[agencyKey] || {
        id: row.agence_id,
        nom: row.agenceNom,
        region: row.regionNom,
        codePDV: row.codePDV || '',
        adresse: '',
      });
    });

    return Array.from(rowsByAgency.values()).sort((firstAgency, secondAgency) =>
      (firstAgency.region || '').localeCompare(secondAgency.region || '', 'fr') ||
      (firstAgency.nom || '').localeCompare(secondAgency.nom || '', 'fr')
    );
  }, [agencesById, planningMapRows]);

  const planningMapGroups = useMemo(
    () =>
      planningMapRows.map((row) => ({
        id: row.id,
        agenceId: row.agence_id,
        agenceNom: row.agenceNom,
        regionNom: row.regionNom,
        creneau: row.creneau,
      })),
    [planningMapRows]
  );

  // Interventions déjà rattachées à un créneau planifié : on les exclut de la
  // couche « réalisées » pour ne pas les afficher deux fois sur le calendrier.
  const matchedInterventionIds = useMemo(() => {
    const ids = new Set();
    filteredRows.forEach((row) => {
      (row.matchedInterventions || []).forEach((intervention) => ids.add(String(intervention.id)));
    });
    return ids;
  }, [filteredRows]);

  // Interventions réellement réalisées (hors annulées et hors créneaux déjà
  // couverts), regroupées par jour + agence + créneau, en respectant les filtres.
  const realizedByDate = useMemo(() => {
    // Le filtre « Suivi » sur planifiée / non effectuée / annulée masque la couche réalisée.
    if (filters.statut.length > 0 && !filters.statut.includes('effectuee')) return {};

    const lockedRegionValue = lockedRegion || resolvedLockedAgency?.region || '';
    const groups = {};

    (interventions || []).forEach((intervention) => {
      if (intervention.statut === 'Annulée') return;
      // Les refusées (hors zone) RESTENT affichées mais ne seront pas comptées (cf. rendu).
      if (matchedInterventionIds.has(String(intervention.id))) return;

      const terminal = terminauxById[String(intervention.terminal_id)] || null;
      const agence = terminal ? agencesById[String(terminal.agence_id)] || null : null;
      const agenceId = agence ? String(agence.id) : '';
      const agenceNom = agence?.nom || 'Agence non renseignée';
      const regionNom = agence?.region || '';
      // Date LOCALE (cohérente avec l'affichage des cartes) — éviter le décalage UTC.
      const refDate = intervention.date_intervention || intervention.date_fin;
      const dateKey = refDate ? format(new Date(refDate), 'yyyy-MM-dd') : '';
      if (!dateKey) return;
      const creneau = getMaintenanceShiftFromDateTime(intervention.date_intervention);

      // Filtres
      if (resolvedLockedAgency) {
        if (agenceId !== String(resolvedLockedAgency.id)) return;
      } else if (filters.agenceId.length > 0 && !filters.agenceId.includes(agenceId)) {
        return;
      }
      if (lockedRegionValue) {
        if (normalizeMaintenanceText(regionNom) !== normalizeMaintenanceText(lockedRegionValue)) return;
      } else if (
        filters.region.length > 0 &&
        !filters.region.some((r) => normalizeMaintenanceText(r) === normalizeMaintenanceText(regionNom))
      ) {
        return;
      }
      if (lockedTechnicienId) {
        if (String(intervention.technicien_id) !== String(lockedTechnicienId)) return;
      } else if (
        filters.technicienId.length > 0 &&
        !filters.technicienId.includes(String(intervention.technicien_id))
      ) {
        return;
      }
      if (filters.creneau.length > 0 && !filters.creneau.includes(creneau)) return;

      // Regroupement par agence (toutes les interventions d'une agence sur la
      // journée sont réunies, quel que soit le créneau).
      const groupKey = `${dateKey}__${agenceId}`;
      if (!groups[dateKey]) groups[dateKey] = {};
      if (!groups[dateKey][groupKey]) {
        groups[dateKey][groupKey] = {
          key: groupKey,
          dateKey,
          agenceId,
          agenceNom,
          interventions: [],
        };
      }
      groups[dateKey][groupKey].interventions.push(intervention);
    });

    return Object.fromEntries(
      Object.entries(groups).map(([dateKey, byGroup]) => [
        dateKey,
        Object.values(byGroup).sort((a, b) => a.agenceNom.localeCompare(b.agenceNom, 'fr')),
      ])
    );
  }, [
    agencesById,
    filters.agenceId,
    filters.creneau,
    filters.region,
    filters.statut,
    filters.technicienId,
    interventions,
    lockedRegion,
    lockedTechnicienId,
    matchedInterventionIds,
    resolvedLockedAgency,
    terminauxById,
  ]);

  const technicienOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Techniciens' },
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

          <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Navigation période — barre intégrée */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/20 px-1 py-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handlePrev} disabled={isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="flex-1 px-1 text-center text-sm font-semibold capitalize text-foreground whitespace-nowrap sm:text-base">
                {format(currentCalendarDate, viewMode === 'month' ? 'MMMM yyyy' : "'Semaine du' dd MMMM", { locale: fr })}
              </h2>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleNext} disabled={isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={handleToday} disabled={isLoading}>
                <span className="sm:hidden">Auj.</span>
                <span className="hidden sm:inline">Aujourd&apos;hui</span>
              </Button>
            </div>

            {/* Actions — barre intégrée */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-1 py-0.5">
              <Input
                type="date"
                value={planningMapDate}
                onChange={(event) => setPlanningMapDate(event.target.value || extractMaintenancePlanningDateKey(new Date()))}
                className="h-7 w-[7.5rem] text-xs sm:w-[150px]"
                disabled={isLoading}
                title="Journée à visualiser sur la carte"
              />
              <div className="inline-flex items-center divide-x divide-border overflow-hidden rounded-md border border-input">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 rounded-none px-2 text-xs ${showPlanningMap ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                  onClick={() => setShowPlanningMap((currentValue) => !currentValue)}
                  disabled={isLoading}
                  title={showPlanningMap ? 'Masquer la carte' : 'Visualiser sur la carte'}
                >
                  <MapPinned className="h-4 w-4" />
                  <span className="ml-1.5 sm:hidden">{showPlanningMap ? 'Masquer' : 'Carte'}</span>
                  <span className="ml-1.5 hidden sm:inline">{showPlanningMap ? 'Masquer la carte' : 'Visualiser sur carte'}</span>
                </Button>
                {canManage && (
                  <>
                  <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs" onClick={() => handleCopyPrevious('week')} disabled={isLoading} title="Copier le planning de la semaine précédente">
                    <Copy className="h-4 w-4" />
                    <span className="ml-1.5">Sem.</span>
                    <span className="hidden sm:inline">&nbsp;précéd.</span>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs" onClick={() => handleCopyPrevious('month')} disabled={isLoading} title="Copier le planning du mois précédent">
                    <Copy className="h-4 w-4" />
                    <span className="ml-1.5">Mois</span>
                    <span className="hidden sm:inline">&nbsp;précéd.</span>
                  </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {showRegionColumn && (
              <Combobox
                multi
                options={regionOptions}
                value={filters.region}
                onSelect={(arr) => setFilters((p) => ({ ...p, region: arr, agenceId: [] }))}
                searchPlaceholder="Rechercher une région…"
                emptyText="Aucune région."
                disabled={isLoading}
              />
            )}

            {showAgenceColumn && (
              <Combobox
                multi
                options={[{ value: ALL_FILTER_VALUE, label: 'Agences' }, ...visibleAgences.map((agence) => ({ value: String(agence.id), label: agence.nom }))]}
                value={filters.agenceId}
                onSelect={(arr) => setFilters((p) => ({ ...p, agenceId: arr }))}
                searchPlaceholder="Rechercher une agence…"
                emptyText="Aucune agence."
                disabled={isLoading}
              />
            )}

            {showTechnicienColumn && (
              <Combobox
                multi
                options={technicienOptions}
                value={filters.technicienId}
                onSelect={(arr) => setFilters((p) => ({ ...p, technicienId: arr }))}
                searchPlaceholder="Rechercher un technicien…"
                emptyText="Aucun technicien."
                disabled={isLoading}
              />
            )}

            <Combobox
              multi
              options={[{ value: ALL_FILTER_VALUE, label: 'Créneaux' }, ...MAINTENANCE_SHIFT_OPTIONS]}
              value={filters.creneau}
              onSelect={(arr) => setFilters((p) => ({ ...p, creneau: arr }))}
              searchPlaceholder="Rechercher…"
              emptyText="Aucun créneau."
              disabled={isLoading}
            />

            <Combobox
              multi
              options={[
                { value: ALL_FILTER_VALUE, label: 'Suivis' },
                { value: 'planifiee', label: 'Planifiée' },
                { value: 'effectuee', label: 'Effectuée' },
                { value: 'non_effectuee', label: 'Non effectuée' },
                { value: 'annulee', label: 'Annulée' },
              ]}
              value={filters.statut}
              onSelect={(arr) => setFilters((p) => ({ ...p, statut: arr }))}
              searchPlaceholder="Rechercher…"
              emptyText="Aucun suivi."
              disabled={isLoading}
            />

            <div className="space-y-2 col-span-2 md:col-span-3 xl:col-span-5">
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
          {showPlanningMap && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <MaintenanceAgenciesMap
                agencies={planningMapAgencies}
                groups={planningMapGroups}
                mode="planning"
                title="Agences planifiées"
                description={`Agences avec au moins un créneau maintenance le ${formatMaintenancePlanningDate(planningMapDate)}.`}
                emptyMessage="Aucune agence planifiée pour cette journée avec les filtres actuels."
              />
            </div>
          )}

          {isLoading && filteredRows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Chargement du planning maintenance...</p>
          ) : (
            <div className="planning-calendar overflow-hidden rounded-lg border border-border shadow-sm">
              {/* En-tête jours */}
              <div className="grid grid-cols-7 bg-muted/60">
                {(viewMode === 'week'
                  ? calendarDays.map(d => format(d, 'EEE', { locale: fr }))
                  : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
                ).map((dayName, i) => (
                  <div key={i} className="py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                    {dayName}
                  </div>
                ))}
              </div>
              {/* Grille compacte */}
              <div className="grid grid-cols-7 divide-x divide-y divide-border">
                {calendarDays.map((day, dayIndex) => {
                  const dateKey = extractMaintenancePlanningDateKey(day);
                  const dayRows = filteredRowsByDate[dateKey] || [];
                  const isCurrentMonthDay = viewMode === 'month' ? isSameMonth(day, currentCalendarDate) : true;
                  const isToday = isSameDay(day, new Date());
                  const isWeekend = [0, 6].includes(getDay(day));

                  return (
                    <div
                      key={dateKey}
                      className={`group flex min-h-[90px] flex-col
                        ${viewMode === 'month' && dayIndex === 0 ? colStartClass : ''}
                        ${!isCurrentMonthDay ? 'bg-muted/10' : isWeekend ? 'bg-slate-50/40' : 'bg-card'}
                      `}
                    >
                      {/* Header compact */}
                      <div className={`flex items-center justify-between px-1.5 py-1 ${isToday ? 'bg-primary' : isWeekend && isCurrentMonthDay ? 'bg-muted/20' : ''}`}>
                        <time dateTime={dateKey} className={`text-xs font-bold ${isToday ? 'text-white' : !isCurrentMonthDay ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </time>
                        {isCurrentMonthDay && canManage && (
                          <button
                            type="button"
                            className={`flex h-4 w-4 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 ${isToday ? 'text-white/70 hover:bg-white/20' : 'text-muted-foreground/30 hover:bg-primary/10 hover:text-primary'}`}
                            onClick={() => openCreateDialogForDate(day)}
                            disabled={isLoading}
                          >
                            <PlusCircle className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {/* Corps compact */}
                      <div className="flex-1 px-1.5 py-1 space-y-0.5">
                        {dayRows
                          .filter((row) => activeLegendStatuses.has(row.executionStatus))
                          .map((row) => (
                          <motion.div
                            key={row.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            role="button"
                            tabIndex={0}
                            title={`${row.agenceNom} • ${row.creneauLabel} • ${row.technicienNom} • ${row.executionMeta.label}`}
                            onClick={() => setSelectedPlanningId(row.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedPlanningId(row.id);
                              }
                            }}
                            className="flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70"
                          >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] font-bold text-white
                              ${EXECUTION_PIN_STYLES[row.executionStatus] || 'bg-emerald-500'}
                              ${String(selectedPlanningId) === String(row.id) ? 'ring-2 ring-offset-1 ring-primary/50' : ''}
                            `}>
                              {row.executionStatus === 'effectuee'
                                ? <CheckCircle2 className="h-2.5 w-2.5" />
                                : <Wrench className="h-2.5 w-2.5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-[0.6rem] font-medium leading-tight ${!isCurrentMonthDay ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                                {showAgenceColumn ? row.agenceNom : row.technicienNom}
                              </p>
                              <p className="truncate text-[0.55rem] leading-tight text-muted-foreground/70">
                                {row.creneauLabel} • {row.executionMeta.label}
                              </p>
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                className="shrink-0 text-muted-foreground/30 opacity-0 transition-all group-hover:opacity-100 hover:text-blue-500"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDialog(row);
                                }}
                                disabled={isLoading}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </motion.div>
                        ))}

                        {activeLegendStatuses.has('effectuee') && (realizedByDate[dateKey] || []).map((item) => {
                          const realizedCount = item.interventions.filter((i) => i.geo_refused !== true).length;
                          const refusedCount = item.interventions.length - realizedCount;
                          const hasRealized = realizedCount > 0;
                          return (
                            <motion.div
                              key={item.key}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              role="button"
                              tabIndex={0}
                              title={`${item.agenceNom} • ${realizedCount} réalisée(s)${refusedCount ? ` • ${refusedCount} refusée(s)` : ''}`}
                              onClick={() => setRealizedDetail(item)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setRealizedDetail(item);
                                }
                              }}
                              className="flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70"
                            >
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] font-bold text-white ${hasRealized ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-[0.6rem] font-medium leading-tight ${!isCurrentMonthDay ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                                  {showAgenceColumn ? item.agenceNom : 'Réalisée'}
                                </p>
                                <p className="truncate text-[0.55rem] leading-tight text-emerald-700/80">
                                  {realizedCount} réalisée(s)
                                  {refusedCount ? <span className="text-red-600"> · {refusedCount} refusée(s)</span> : null}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Légende / filtre</span>
            {CALENDAR_LEGEND.map((item) => {
              const active = activeLegendStatuses.has(item.status);
              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => toggleLegendStatus(item.status)}
                  aria-pressed={active}
                  title={active ? `Masquer « ${item.label} »` : `Afficher « ${item.label} »`}
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors ${
                    active
                      ? 'border-slate-300 bg-white text-foreground'
                      : 'border-transparent bg-transparent text-muted-foreground/40 line-through'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${item.dot} ${active ? '' : 'opacity-30'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

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

      <Dialog open={Boolean(realizedDetail)} onOpenChange={(open) => !open && setRealizedDetail(null)}>
        <DialogContent className="sm:max-w-2xl glassmorphism">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl text-primary">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              Interventions réalisées
            </DialogTitle>
            <DialogDescription>
              {realizedDetail
                ? `${realizedDetail.agenceNom} • ${formatMaintenancePlanningDate(realizedDetail.dateKey)} • ${realizedDetail.interventions.length} intervention(s)`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
            {(realizedDetail?.interventions || []).map((intervention) => {
              const terminal = terminauxById[String(intervention.terminal_id)] || null;
              const technicien = techniciensById[String(intervention.technicien_id)] || null;
              const isCurative = intervention.type_intervention === 'curative';
              const creneauLabel = getMaintenancePlanningShiftLabel(
                getMaintenanceShiftFromDateTime(intervention.date_intervention)
              );
              return (
                <div
                  key={intervention.id}
                  className={`space-y-2 rounded-xl border p-4 shadow-sm ${isCurative ? 'border-red-100 bg-red-50/40' : 'border-blue-100 bg-blue-50/40'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">
                      {terminal?.reference || `Terminal #${intervention.terminal_id}`}
                    </p>
                    <span className="text-sm text-muted-foreground">
                      {formatMaintenanceDateTime(intervention.date_intervention)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={isCurative ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}>
                      {getMaintenanceInterventionTypeLabel(intervention.type_intervention)}
                    </Badge>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {creneauLabel}
                    </Badge>
                    {intervention.geo_refused === true ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Refusée (hors zone)</Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">{intervention.statut}</Badge>
                    )}
                    {intervention.sous_ensemble && (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                        {intervention.sous_ensemble}
                      </Badge>
                    )}
                  </div>
                  {technicien && (
                    <p className="text-sm text-muted-foreground">
                      Technicien : {technicien.prenom} {technicien.nom}
                      {technicien.matricule ? ` • ${technicien.matricule}` : ''}
                    </p>
                  )}
                  {intervention.commentaire && (
                    <p className="border-t pt-2 text-sm italic text-slate-700">{intervention.commentaire}</p>
                  )}
                  {intervention.fiche_url && (
                    <div className="border-t pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openFiche(intervention.fiche_url)}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Voir la fiche d&apos;intervention
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fermer</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ficheDialog.open} onOpenChange={(open) => !open && setFicheDialog({ open: false, html: '', loading: false })}>
        <DialogContent className="flex h-[90vh] w-full max-w-4xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Fiche d&apos;intervention
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {ficheDialog.loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement de la fiche...</div>
            ) : (
              <iframe
                srcDoc={ficheDialog.html}
                className="h-full w-full border-0"
                title="Fiche d'intervention"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedPlanning)} onOpenChange={(isOpen) => { if (!isOpen) setSelectedPlanningId(null); }}>
        <DialogContent className="sm:max-w-3xl glassmorphism max-h-[85vh] overflow-y-auto">
          {selectedPlanning && (
          <>
          <DialogHeader>
            <DialogTitle className="text-2xl text-primary">
              Détail de la planification du {formatMaintenancePlanningDate(selectedPlanning.date_planification)}
            </DialogTitle>
            <DialogDescription>
              {selectedPlanning.agenceNom} • {selectedPlanning.creneauLabel} • {selectedPlanning.technicienNom}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-2">
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
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaintenancePlanningSection;
