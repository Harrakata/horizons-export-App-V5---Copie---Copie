import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePageState } from '@/hooks/usePageState';
import { motion } from 'framer-motion';
import { Activity, CalendarClock, ChevronDown, ChevronUp, List, MapPinned, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import ConfigurationTab from '@/pages/maintenance/ConfigurationTab';
import MaintenanceAnalyticsSection from '@/components/maintenance/MaintenanceAnalyticsSection';
import MaintenancePlanningSection from '@/components/maintenance/MaintenancePlanningSection';
import MaintenanceAgenciesMap from '@/components/maintenance/MaintenanceAgenciesMap';
import { formatDisplayDate, formatDisplayDateTime, isSupabaseAuthError } from '@/lib/guichetiereSpace';
import {
  isMissingMaintenancePlanningRequestTableError,
  MAINTENANCE_REQUEST_STATUSES,
  getMaintenancePlanningRequestStatusBadgeClass,
  getMaintenancePlanningRequestTypeLabel,
} from '@/lib/maintenancePlanningRequests';
import {
  buildTerminalMonitoringGroups,
  formatMaintenanceDateTime,
  getMaintenanceInterventionStatusClass,
  getMaintenanceInterventionTypeLabel,
  normalizeMaintenanceText,
} from '@/lib/maintenanceMonitoring';
import { APP_SPACE_TAB_SETTINGS_KEY, isAppSpaceUserTabAllowed, normalizeAppSpaceTabFunctionalities } from '@/lib/exploitationProfiles';

const ALL_FILTER_VALUE = '__all__';

const MaintenanceTerminauxPage = () => {
  const { nomAgence, chefDetails } = useOutletContext();
  const { toast } = useToast();
  const [agenceRecord, setAgenceRecord] = useState(null);
  const [terminaux, setTerminaux] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = usePageState('chef-maintenance', 'searchTerm', '');
  const [expandedTerminalIds, setExpandedTerminalIds] = useState({});
  const [seHistoryOpen, setSeHistoryOpen] = useState({});
  const [seHistoryLimit, setSeHistoryLimit] = useState({});
  const [ficheDialog, setFicheDialog] = useState({ open: false, html: '', loading: false });
  const [selectedInterventionId, setSelectedInterventionId] = useState(null);
  const [showMaintenanceMap, setShowMaintenanceMap] = usePageState('chef-maintenance', 'showMaintenanceMap', false);
  const [maintenanceFollowUpFilter, setMaintenanceFollowUpFilter] = usePageState('chef-maintenance', 'maintenanceFollowUpFilter', ALL_FILTER_VALUE);
  const [planningRequests, setPlanningRequests] = useState([]);
  const [isPlanningRequestTableMissing, setIsPlanningRequestTableMissing] = useState(false);
  const [filters, setFilters] = usePageState('chef-maintenance', 'filters', {
    terminalId: ALL_FILTER_VALUE,
    type: ALL_FILTER_VALUE,
    statut: ALL_FILTER_VALUE,
    sousEnsemble: ALL_FILTER_VALUE,
  });
  const [activeTab, setActiveTab] = usePageState('chef-maintenance', 'activeTab', 'suivi');

  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}'));
    } catch { return normalizeAppSpaceTabFunctionalities({}); }
  });
  useEffect(() => {
    const handler = (e) => setSpaceTabFunctionalities(normalizeAppSpaceTabFunctionalities(e.detail || {}));
    window.addEventListener('app-space-tabs-updated', handler);
    return () => window.removeEventListener('app-space-tabs-updated', handler);
  }, []);
  const tabEnabled = (key) =>
    spaceTabFunctionalities?.['espace-chef-agence']?.[key] !== false
    && isAppSpaceUserTabAllowed(chefDetails?.appSpaceProfile, key);

  const loadData = useCallback(async () => {
    if (!nomAgence) return;

    setIsLoading(true);

    try {
      let agence = null;

      const agenceByNameResponse = await supabase
        .from('agences')
        .select('id, nom, codePDV, region, adresse')
        .eq('nom', nomAgence)
        .eq('is_current', true)
        .limit(1);

      if (agenceByNameResponse.error) {
        throw agenceByNameResponse.error;
      }

      agence = agenceByNameResponse.data?.[0] || null;

      if (!agence && chefDetails?.codePDV) {
        const agenceByCodeResponse = await supabase
          .from('agences')
          .select('id, nom, codePDV, region, adresse')
          .eq('codePDV', chefDetails.codePDV)
          .eq('is_current', true)
          .limit(1);

        if (agenceByCodeResponse.error) {
          throw agenceByCodeResponse.error;
        }

        agence = agenceByCodeResponse.data?.[0] || null;
      }

      setAgenceRecord(agence);

      if (!agence?.id) {
        setTerminaux([]);
        setInterventions([]);
        return;
      }

      const terminauxResponse = await supabase
        .from('terminaux')
        .select('id, agence_id, reference, type_terminal, position, statut, adresse_ip, imprimante_reference, lecteur_reference, ecran_reference')
        .eq('agence_id', agence.id)
        .order('reference', { ascending: true });

      if (terminauxResponse.error) {
        throw terminauxResponse.error;
      }

      const terminauxData = terminauxResponse.data || [];
      setTerminaux(terminauxData);

      const terminalIds = terminauxData.map((terminal) => terminal.id);

      if (terminalIds.length === 0) {
        setInterventions([]);
      }

      const planningRequestsResponse = await supabase
        .from('planning_maintenance_modification_requests')
        .select('*')
        .eq('agence_nom', agence.nom || nomAgence)
        .order('created_at', { ascending: false });

      if (planningRequestsResponse.error) {
        if (
          !isMissingMaintenancePlanningRequestTableError(planningRequestsResponse.error) &&
          !isSupabaseAuthError(planningRequestsResponse.error)
        ) {
          throw planningRequestsResponse.error;
        }
        setIsPlanningRequestTableMissing(true);
        setPlanningRequests([]);
      } else {
        setIsPlanningRequestTableMissing(false);
        setPlanningRequests(planningRequestsResponse.data || []);
      }

      if (terminalIds.length === 0) {
        return;
      }

      const [
        interventionsResponse,
        codesPannesResponse,
        codesInterventionsResponse,
        techniciensResponse,
      ] = await Promise.all([
        supabase
          .from('interventions_maintenance')
          .select('*')
          .in('terminal_id', terminalIds)
          .order('date_intervention', { ascending: false }),
        supabase.from('codes_pannes').select('id, code, libelle'),
        supabase.from('codes_interventions').select('id, code, libelle'),
        supabase.from('techniciens').select('id, nom, prenom, matricule'),
      ]);

      if (interventionsResponse.error) throw interventionsResponse.error;
      if (codesPannesResponse.error) throw codesPannesResponse.error;
      if (codesInterventionsResponse.error) throw codesInterventionsResponse.error;
      if (techniciensResponse.error) throw techniciensResponse.error;

      const terminalById = (terminauxData || []).reduce((accumulator, terminal) => {
        accumulator[String(terminal.id)] = terminal;
        return accumulator;
      }, {});

      const codePanneById = (codesPannesResponse.data || []).reduce((accumulator, codePanne) => {
        accumulator[String(codePanne.id)] = `${codePanne.code} - ${codePanne.libelle}`;
        return accumulator;
      }, {});

      const codeInterventionById = (codesInterventionsResponse.data || []).reduce((accumulator, codeIntervention) => {
        accumulator[String(codeIntervention.id)] = `${codeIntervention.code} - ${codeIntervention.libelle}`;
        return accumulator;
      }, {});

      const technicienById = (techniciensResponse.data || []).reduce((accumulator, technicien) => {
        accumulator[String(technicien.id)] = technicien;
        return accumulator;
      }, {});

      const normalizedInterventions = (interventionsResponse.data || []).map((intervention) => {
        const terminal = terminalById[String(intervention.terminal_id)] || null;
        const technicien = technicienById[String(intervention.technicien_id)] || null;

        return {
          ...intervention,
          terminalReference: terminal?.reference || `Terminal #${intervention.terminal_id}`,
          terminalType: terminal?.type_terminal || 'N/A',
          terminalPosition: terminal?.position || 'Position non définie',
          technicienLabel: technicien
            ? `${technicien.prenom} ${technicien.nom}${technicien.matricule ? ` (${technicien.matricule})` : ''}`
            : 'Non renseigné',
          codeLabel:
            intervention.type_intervention === 'curative'
              ? codePanneById[String(intervention.code_panne_id)] || 'N/A'
              : codeInterventionById[String(intervention.code_intervention_id)] || 'N/A',
        };
      });

      setInterventions(normalizedInterventions);
    } catch (error) {
      console.error('Erreur chargement maintenance chef:', error);
      toast({
        title: 'Erreur de chargement',
        description: "Impossible de charger l'historique maintenance de l'agence.",
        variant: 'destructive',
      });
      setTerminaux([]);
      setInterventions([]);
    } finally {
      setIsLoading(false);
    }
  }, [chefDetails?.codePDV, nomAgence, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const terminalMonitoringGroups = useMemo(
    () =>
      buildTerminalMonitoringGroups(terminaux, interventions, {
        [String(agenceRecord?.id || '')]: agenceRecord,
      }),
    [agenceRecord, interventions, terminaux]
  );

  const filteredTerminalMonitoringGroups = useMemo(() => {
    const normalizedSearch = normalizeMaintenanceText(searchTerm);

    return terminalMonitoringGroups
      .filter(
        (group) => filters.terminalId === ALL_FILTER_VALUE || String(group.terminalId) === String(filters.terminalId)
      )
      .filter((group) =>
        maintenanceFollowUpFilter === ALL_FILTER_VALUE
          ? true
          : maintenanceFollowUpFilter === 'a_jour'
            ? group.followUp.label === 'Maintenance à jour'
            : group.followUp.label === 'Faire maintenance préventive'
      )
      .filter((group) =>
        !normalizedSearch ||
        [
          group.terminalReference,
          group.terminalType,
          group.terminalPosition,
          group.followUp.label,
          group.followUp.detail,
          ...group.sousEnsembles.flatMap((row) => [
            row.sousEnsembleLabel,
            row.sousEnsembleReference,
            row.followUp.label,
            row.followUp.detail,
          ]),
        ].some((value) => normalizeMaintenanceText(value).includes(normalizedSearch))
      );
  }, [filters.terminalId, maintenanceFollowUpFilter, searchTerm, terminalMonitoringGroups]);

  const terminalOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Tous les terminaux' },
      ...terminaux.map((terminal) => ({
        value: String(terminal.id),
        label: `${terminal.reference} • ${terminal.type_terminal || 'Sans type'}`,
      })),
    ],
    [terminaux]
  );

  const sousEnsembleOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Tous les sous-ensembles' },
      ...Array.from(new Set(interventions.map((intervention) => intervention.sous_ensemble).filter(Boolean)))
        .sort((firstValue, secondValue) => firstValue.localeCompare(secondValue))
        .map((sousEnsemble) => ({ value: sousEnsemble, label: sousEnsemble })),
    ],
    [interventions]
  );

  const filteredInterventions = useMemo(() => {
    const searchValue = normalizeMaintenanceText(searchTerm);

    return interventions
      .filter((intervention) => filters.terminalId === ALL_FILTER_VALUE || String(intervention.terminal_id) === String(filters.terminalId))
      .filter((intervention) => filters.type === ALL_FILTER_VALUE || intervention.type_intervention === filters.type)
      .filter((intervention) => filters.statut === ALL_FILTER_VALUE || intervention.statut === filters.statut)
      .filter((intervention) => filters.sousEnsemble === ALL_FILTER_VALUE || intervention.sous_ensemble === filters.sousEnsemble)
      .filter((intervention) =>
        !searchValue ||
        [
          intervention.terminalReference,
          intervention.sous_ensemble,
          intervention.codeLabel,
          intervention.commentaire,
          intervention.technicienLabel,
          intervention.statut,
        ].some((value) => normalizeMaintenanceText(value).includes(searchValue))
      );
  }, [filters.sousEnsemble, filters.statut, filters.terminalId, filters.type, interventions, searchTerm]);

  useEffect(() => {
    const fallbackId = filteredInterventions[0]?.id || null;

    if (!selectedInterventionId && fallbackId) {
      setSelectedInterventionId(fallbackId);
      return;
    }

    if (
      selectedInterventionId &&
      !filteredInterventions.some((intervention) => String(intervention.id) === String(selectedInterventionId))
    ) {
      setSelectedInterventionId(fallbackId);
    }
  }, [filteredInterventions, selectedInterventionId]);

  const selectedIntervention =
    filteredInterventions.find((intervention) => String(intervention.id) === String(selectedInterventionId)) || null;

  const termineesCount = interventions.filter((intervention) => intervention.statut === 'Terminée').length;
  const maintenanceUpToDateCount = terminalMonitoringGroups.filter(
    (group) => group.followUp.label === 'Maintenance à jour'
  ).length;
  const preventiveRequiredCount = terminalMonitoringGroups.filter(
    (group) => group.followUp.label === 'Faire maintenance préventive'
  ).length;
  const scopedTerminalIds = useMemo(
    () => new Set(filteredTerminalMonitoringGroups.map((group) => String(group.terminalId))),
    [filteredTerminalMonitoringGroups]
  );
  const scopedTerminauxForCharts = useMemo(
    () => terminaux.filter((terminal) => scopedTerminalIds.has(String(terminal.id))),
    [scopedTerminalIds, terminaux]
  );
  const pendingPlanningRequestsCount = planningRequests.filter(
    (request) => request.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF
  ).length;

  const toggleTerminalExpansion = (terminalId) => {
    const terminalKey = String(terminalId);
    setExpandedTerminalIds((previousState) => ({
      ...previousState,
      [terminalKey]: !previousState[terminalKey],
    }));
  };

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

  const handleProcessPlanningRequest = async (request, approve) => {
    setIsLoading(true);

    const nextStatus = approve
      ? MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION
      : MAINTENANCE_REQUEST_STATUSES.REFUSED_CHEF;

    const payload = approve
      ? {
          statut: nextStatus,
          commentaire_chef:
            request.type_demande === 'indisponibilite'
              ? "Demande transmise à l'Exploitation après validation du chef d'agence."
              : `Changement de date transmis à l'Exploitation${request.date_souhaitee ? ` pour le ${formatDisplayDate(request.date_souhaitee)}` : '.'}`,
          traitee_par_chef: chefDetails?.prenom && chefDetails?.nom ? `${chefDetails.prenom} ${chefDetails.nom}` : chefInfo?.nomChef || "Chef d'agence",
          date_traitement_chef: new Date().toISOString(),
        }
      : {
          statut: nextStatus,
          commentaire_chef: "Demande refusée par le chef d'agence.",
          traitee_par_chef: chefDetails?.prenom && chefDetails?.nom ? `${chefDetails.prenom} ${chefDetails.nom}` : chefInfo?.nomChef || "Chef d'agence",
          date_traitement_chef: new Date().toISOString(),
        };

    const { error } = await supabase
      .from('planning_maintenance_modification_requests')
      .update(payload)
      .eq('id', request.id);

    if (error) {
      toast({
        title: 'Traitement impossible',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: approve ? 'Demande transmise' : 'Demande refusée',
        description: approve
          ? "La demande a été validée puis transmise à l'Exploitation."
          : "La demande a été refusée par le chef d'agence.",
        className: approve ? 'bg-green-500 text-white' : 'bg-slate-700 text-white',
      });
      loadData();
    }

    setIsLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <Wrench className="mr-3 h-8 w-8" />
            Maintenance Terminaux
          </CardTitle>
          <CardDescription>
            Suivez les terminaux de {agenceRecord?.nom || nomAgence}, leur état de maintenance et la planification des passages techniques.
          </CardDescription>
        </CardHeader>
      </Card>

      {(() => {
        const showConfig   = tabEnabled('maintenance-terminaux.configuration');
        const showSuivi    = tabEnabled('maintenance-terminaux.suivi');
        const showPlanning = tabEnabled('maintenance-terminaux.planning');
        const visibleCount = [showConfig, showSuivi, showPlanning].filter(Boolean).length;
        const gridCols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[visibleCount] || 'grid-cols-3';
        const validTabs = [showConfig && 'configuration', showSuivi && 'suivi', showPlanning && 'planning'].filter(Boolean);
        const safeTab = validTabs.includes(activeTab) ? activeTab : (validTabs[0] ?? activeTab);
        return (
      <Tabs value={safeTab} onValueChange={setActiveTab} className="space-y-6">
        {visibleCount > 1 && (
          <TabsList className={`grid w-full ${gridCols}`}>
            {showConfig   && <TabsTrigger value="configuration">Configuration des Terminaux</TabsTrigger>}
            {showSuivi    && <TabsTrigger value="suivi">Suivi des Terminaux</TabsTrigger>}
            {showPlanning && <TabsTrigger value="planning">Planification de Maintenance</TabsTrigger>}
          </TabsList>
        )}

        <TabsContent value="configuration">
          <ConfigurationTab
            canManage
            lockedAgenceId={agenceRecord?.id || null}
            lockedAgenceName={agenceRecord?.nom || nomAgence}
            showEquipmentManagement={false}
          />
        </TabsContent>

        <TabsContent value="suivi" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiStatCard
              icon={Activity}
              label="Terminaux de l’agence"
              value={terminaux.length}
              helper="Volume total de terminaux rattachés à votre agence."
              tone="primary"
            />
            <KpiStatCard
              icon={Wrench}
              label="Interventions enregistrées"
              value={interventions.length}
              helper="Historique des passages et opérations de maintenance."
              tone="blue"
            />
            <KpiStatCard
              icon={CalendarClock}
              label="Interventions terminées"
              value={termineesCount}
              helper="Interventions clôturées avec un statut terminé."
              tone="violet"
            />
            <KpiStatCard
              icon={CalendarClock}
              label="Terminaux à jour"
              value={maintenanceUpToDateCount}
              helper="Terminaux couverts par une maintenance récente."
              tone="emerald"
            />
            <KpiStatCard
              icon={Wrench}
              label="Terminaux à traiter"
              value={preventiveRequiredCount}
              helper="Terminaux nécessitant une action préventive ou corrective."
              tone="red"
            />
          </div>

          <MaintenanceAnalyticsSection
            title="Analyse des non-conformités maintenance"
            description="Répartition des terminaux et sous-ensembles à traiter sur votre agence, avec l’évolution des retards de maintenance."
            groups={filteredTerminalMonitoringGroups}
            terminaux={scopedTerminauxForCharts}
            interventions={interventions}
            agenciesById={{ [String(agenceRecord?.id || '')]: agenceRecord }}
            availableDimensions={['terminal', 'sous_ensemble']}
            showAdvancedCharts
          />

          <Card className="shadow-xl glassmorphism">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-primary">Suivi des terminaux et sous-ensembles</CardTitle>
                  <CardDescription>
                    Une maintenance preventive ou curative datant de moins d&apos;un mois place le terminal a jour sur le sous-ensemble concerné.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant={showMaintenanceMap ? 'default' : 'outline'}
                  onClick={() => setShowMaintenanceMap((previousValue) => !previousValue)}
                  className={showMaintenanceMap ? 'bg-gradient-to-r from-primary to-emerald-600 text-white' : ''}
                >
                  {showMaintenanceMap ? (
                    <List className="mr-2 h-4 w-4" />
                  ) : (
                    <MapPinned className="mr-2 h-4 w-4" />
                  )}
                  {showMaintenanceMap ? 'Masquer la carte' : 'Visualiser sur carte'}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Terminal</p>
                  <Select
                    value={filters.terminalId}
                    onValueChange={(value) => setFilters((previousState) => ({ ...previousState, terminalId: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les terminaux" />
                    </SelectTrigger>
                    <SelectContent>
                      {terminalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Suivi maintenance</p>
                  <Select value={maintenanceFollowUpFilter} onValueChange={setMaintenanceFollowUpFilter} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les suivis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>Tous les suivis</SelectItem>
                      <SelectItem value="a_jour">Maintenance à jour</SelectItem>
                      <SelectItem value="preventive">Faire maintenance préventive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Recherche</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Terminal, sous-ensemble, reference..."
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showMaintenanceMap && (
                <div className="mb-6">
                  <MaintenanceAgenciesMap
                    agencies={agenceRecord ? [agenceRecord] : []}
                    groups={filteredTerminalMonitoringGroups}
                  />
                </div>
              )}

              <Table>
                <TableCaption>
                  {filteredTerminalMonitoringGroups.length === 0
                    ? 'Aucun terminal ne correspond aux filtres.'
                    : `${filteredTerminalMonitoringGroups.length} terminal(aux) affiche(s).`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Derniere maintenance</TableHead>
                    <TableHead>Suivi maintenance</TableHead>
                    <TableHead className="text-right">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTerminalMonitoringGroups.map((group) => {
                    const isExpanded = Boolean(expandedTerminalIds[String(group.terminalId)]);

                    return (
                      <React.Fragment key={group.terminalId}>
                        <TableRow>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{group.terminalReference}</span>
                              <span className="text-xs text-muted-foreground">
                                {group.terminalType} • {group.terminalPosition}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatMaintenanceDateTime(group.latestIntervention?.date_intervention)}</TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Badge variant="outline" className={group.followUp.className}>
                                {group.followUp.label}
                              </Badge>
                              <p className="text-xs text-muted-foreground">{group.followUp.detail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleTerminalExpansion(group.terminalId)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="mr-2 h-4 w-4" />
                              ) : (
                                <ChevronDown className="mr-2 h-4 w-4" />
                              )}
                              {isExpanded ? 'Masquer' : 'Voir sous-ensembles'}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={4} className="p-0">
                              <div className="m-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-slate-900">
                                    Sous-ensembles du terminal {group.terminalReference}
                                  </p>
                                  <span className="text-xs text-muted-foreground">
                                    {group.sousEnsembles.length} sous-ensemble(s) suivi(s)
                                  </span>
                                </div>

                                {group.sousEnsembles.map((row) => {
                                  const seKey = `${group.terminalId}-${row.sousEnsembleReference}`;
                                  const sePrefix = (row.sousEnsembleReference || '').replace(/\d+$/, '').toUpperCase();
                                  const rowInterventions = interventions
                                    .filter((i) => {
                                      if (String(i.terminal_id) !== String(group.terminalId)) return false;
                                      if (i.statut === 'Annulée') return false;
                                      const iPrefix = (i.sous_ensemble || '').replace(/\d+$/, '').toUpperCase();
                                      return sePrefix && iPrefix && iPrefix === sePrefix;
                                    })
                                    .sort((a, b) => new Date(b.date_intervention || 0) - new Date(a.date_intervention || 0));

                                  const isGood = row.followUp.label === 'Maintenance à jour';
                                  const historyOpen = !!seHistoryOpen[seKey];
                                  const historyLimit = seHistoryLimit[seKey] ?? 3;
                                  const visibleInterventions = historyLimit === 0 ? rowInterventions : rowInterventions.slice(0, historyLimit);

                                  const toggleHistory = () =>
                                    setSeHistoryOpen((prev) => ({ ...prev, [seKey]: !prev[seKey] }));
                                  const setLimit = (val) =>
                                    setSeHistoryLimit((prev) => ({ ...prev, [seKey]: val }));

                                  return (
                                    <div
                                      key={seKey}
                                      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${isGood ? 'border-green-200' : 'border-red-200'}`}
                                    >
                                      {/* En-tête cliquable */}
                                      <button
                                        type="button"
                                        onClick={rowInterventions.length > 0 ? toggleHistory : undefined}
                                        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isGood ? 'bg-green-50' : 'bg-red-50'} ${rowInterventions.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                                      >
                                        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                                          <span className="font-semibold text-slate-800">{row.sousEnsembleLabel}</span>
                                          <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {row.sousEnsembleReference}
                                          </span>
                                          <span className={`text-xs ${isGood ? 'text-green-700' : 'text-red-700'}`}>
                                            {row.followUp.detail}
                                          </span>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                          <Badge variant="outline" className={`text-xs ${row.followUp.className}`}>
                                            {row.followUp.label}
                                          </Badge>
                                          {rowInterventions.length > 0 && (
                                            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${historyOpen ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-white/70 text-muted-foreground'}`}>
                                              {rowInterventions.length} interv.
                                              {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            </span>
                                          )}
                                        </div>
                                      </button>

                                      {/* Historique déroulant */}
                                      {historyOpen && rowInterventions.length > 0 && (
                                        <div className="border-t px-4 pb-3 pt-3">
                                          <div className="mb-3 flex items-center justify-between">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              Historique ({rowInterventions.length})
                                            </p>
                                            <div className="flex items-center gap-1">
                                              <span className="mr-1 text-[10px] text-muted-foreground">Afficher :</span>
                                              {[3, 5, 10].map((n) => (
                                                <button
                                                  key={n}
                                                  type="button"
                                                  onClick={() => setLimit(n)}
                                                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${historyLimit === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                                >
                                                  {n}
                                                </button>
                                              ))}
                                              <button
                                                type="button"
                                                onClick={() => setLimit(0)}
                                                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${historyLimit === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                              >
                                                Tout
                                              </button>
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            {visibleInterventions.map((i) => {
                                              const isCurative = i.type_intervention === 'curative';
                                              return (
                                                <div
                                                  key={i.id}
                                                  onClick={i.fiche_url ? () => openFiche(i.fiche_url) : undefined}
                                                  className={`space-y-1.5 rounded-lg border px-3 py-2 text-xs ${isCurative ? 'border-red-100 bg-red-50/40' : 'border-blue-100 bg-blue-50/40'} ${i.fiche_url ? 'cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5' : ''}`}
                                                >
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-slate-700">{formatMaintenanceDateTime(i.date_intervention)}</span>
                                                    <Badge variant="outline" className={`text-[10px] ${isCurative ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                                                      {getMaintenanceInterventionTypeLabel(i.type_intervention)}
                                                    </Badge>
                                                    <Badge variant="outline" className={`text-[10px] ${getMaintenanceInterventionStatusClass(i.statut)}`}>
                                                      {i.statut}
                                                    </Badge>
                                                    {i.technicienLabel && i.technicienLabel !== 'Non renseigné' && (
                                                      <span className="text-muted-foreground">{i.technicienLabel}</span>
                                                    )}
                                                    {i.fiche_url && (
                                                      <span className="ml-auto flex shrink-0 items-center gap-1 font-semibold text-primary">
                                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        Voir fiche
                                                      </span>
                                                    )}
                                                  </div>
                                                  {isCurative && (i.codeLabel !== 'N/A' || i.description_panne) && (
                                                    <div className="flex flex-wrap items-start gap-3 rounded border border-red-100 bg-red-50 px-2 py-1.5">
                                                      {i.codeLabel && i.codeLabel !== 'N/A' && (
                                                        <div className="shrink-0">
                                                          <span className="text-[10px] font-semibold uppercase text-red-400">Code panne</span>
                                                          <p className="font-mono font-bold text-red-800">{i.codeLabel}</p>
                                                        </div>
                                                      )}
                                                      {i.description_panne && (
                                                        <div className="min-w-0">
                                                          <span className="text-[10px] font-semibold uppercase text-red-400">Descriptif</span>
                                                          <p className="text-red-800">{i.description_panne}</p>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                  {i.commentaire && (
                                                    <p className="border-t pt-1 italic text-muted-foreground">{i.commentaire}</p>
                                                  )}
                                                </div>
                                              );
                                            })}

                                            {historyLimit > 0 && rowInterventions.length > historyLimit && (
                                              <p className="text-center text-[10px] text-muted-foreground">
                                                {rowInterventions.length - historyLimit} intervention(s) masquée(s) — cliquez sur «Tout» pour tout afficher
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {rowInterventions.length === 0 && (
                                        <p className="px-4 py-2.5 text-xs text-muted-foreground">Aucune intervention enregistrée.</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-xl glassmorphism">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-primary">Historique des maintenances</CardTitle>
                  <CardDescription>
                    Filtrez l’historique par terminal, sous-ensemble, type d’intervention ou statut.
                  </CardDescription>
                </div>
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Rechercher une intervention ou un terminal..."
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Terminal</p>
                  <Select
                    value={filters.terminalId}
                    onValueChange={(value) => setFilters((previousState) => ({ ...previousState, terminalId: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les terminaux" />
                    </SelectTrigger>
                    <SelectContent>
                      {terminalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Sous-ensemble</p>
                  <Select
                    value={filters.sousEnsemble}
                    onValueChange={(value) => setFilters((previousState) => ({ ...previousState, sousEnsemble: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les sous-ensembles" />
                    </SelectTrigger>
                    <SelectContent>
                      {sousEnsembleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Type</p>
                  <Select
                    value={filters.type}
                    onValueChange={(value) => setFilters((previousState) => ({ ...previousState, type: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>Tous les types</SelectItem>
                      <SelectItem value="curative">Curative</SelectItem>
                      <SelectItem value="preventive">Préventive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Statut</p>
                  <Select
                    value={filters.statut}
                    onValueChange={(value) => setFilters((previousState) => ({ ...previousState, statut: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>Tous les statuts</SelectItem>
                      <SelectItem value="Terminée">Terminée</SelectItem>
                      <SelectItem value="En cours">En cours</SelectItem>
                      <SelectItem value="En attente">En attente</SelectItem>
                      <SelectItem value="Annulée">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading && interventions.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Chargement de l’historique maintenance...</p>
              ) : (
                <Table>
                  <TableCaption>
                    {filteredInterventions.length === 0
                      ? 'Aucune intervention trouvée pour les filtres actuels.'
                      : `${filteredInterventions.length} intervention(s) affichée(s).`}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Terminal</TableHead>
                      <TableHead>Sous-ensemble</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Technicien</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInterventions.map((intervention, index) => (
                      <motion.tr
                        key={intervention.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                          String(selectedInterventionId) === String(intervention.id) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedInterventionId(intervention.id)}
                      >
                        <TableCell>{formatMaintenanceDateTime(intervention.date_intervention)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{intervention.terminalReference}</span>
                            <span className="text-xs text-muted-foreground">{intervention.terminalPosition}</span>
                          </div>
                        </TableCell>
                        <TableCell>{intervention.sous_ensemble || 'N/A'}</TableCell>
                        <TableCell>{getMaintenanceInterventionTypeLabel(intervention.type_intervention)}</TableCell>
                        <TableCell>{intervention.codeLabel}</TableCell>
                        <TableCell>{intervention.technicienLabel}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getMaintenanceInterventionStatusClass(intervention.statut)}>
                            {intervention.statut}
                          </Badge>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedIntervention && (
            <Card className="shadow-xl glassmorphism">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">
                  Détail de l’intervention {selectedIntervention.terminalReference}
                </CardTitle>
                <CardDescription>
                  {getMaintenanceInterventionTypeLabel(selectedIntervention.type_intervention)} • {selectedIntervention.sous_ensemble || 'Sans sous-ensemble'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date d’intervention</p>
                    <p className="mt-1 font-medium">{formatMaintenanceDateTime(selectedIntervention.date_intervention)}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Terminal</p>
                    <p className="mt-1 font-medium">{selectedIntervention.terminalReference}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Technicien</p>
                    <p className="mt-1 font-medium">{selectedIntervention.technicienLabel}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut</p>
                    <div className="mt-2">
                      <Badge variant="outline" className={getMaintenanceInterventionStatusClass(selectedIntervention.statut)}>
                        {selectedIntervention.statut}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Sous-ensemble</p>
                    <p className="mt-1 font-medium">{selectedIntervention.sous_ensemble || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Code d’intervention</p>
                    <p className="mt-1 font-medium">{selectedIntervention.codeLabel}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipement remplacé</p>
                    <p className="mt-1 font-medium">{selectedIntervention.equipement_remplace ? 'Oui' : 'Non'}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Référence de remplacement</p>
                    <p className="mt-1 font-medium">{selectedIntervention.reference_remplacement || 'Aucune'}</p>
                  </div>
                </div>

                <div className="rounded-xl border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Commentaire technique</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {selectedIntervention.commentaire || 'Aucun commentaire renseigné.'}
                  </p>
                </div>

                <div className="rounded-xl border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clôture</p>
                  <p className="mt-1 font-medium">{formatMaintenanceDateTime(selectedIntervention.date_fin)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="planning">
          <div className="space-y-6">
            <MaintenancePlanningSection
              title={`Planification de Maintenance${agenceRecord?.nom ? ` - ${agenceRecord.nom}` : ''}`}
              description="Planifiez les passages maintenance de votre agence, affectez les techniciens par matin et après-midi, puis suivez automatiquement les maintenances réellement effectuées."
              canManage
              lockedAgenceName={agenceRecord?.nom || nomAgence}
              lockedRegion={agenceRecord?.region || ''}
              emptyTitle="Aucune maintenance planifiée pour cette agence."
            />

            {isPlanningRequestTableMissing ? (
              <Card className="border-amber-200 bg-amber-50 shadow-sm">
                <CardContent className="p-4 text-sm text-amber-800">
                  La table
                  {' '}
                  <code>planning_maintenance_modification_requests</code>
                  {' '}
                  n&apos;existe pas encore dans Supabase.
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xl glassmorphism">
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-2xl text-primary">Demandes de modification des techniciens</CardTitle>
                      <CardDescription>
                        Validez d’abord les demandes de vos techniciens avant leur transmission à l’Exploitation.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      En attente chef : {pendingPlanningRequestsCount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableCaption>
                      {planningRequests.length === 0
                        ? 'Aucune demande de modification maintenance pour cette agence.'
                        : `${planningRequests.length} demande(s) affichée(s).`}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Technicien</TableHead>
                        <TableHead>Date planifiée</TableHead>
                        <TableHead>Créneau</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date souhaitée</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Suivi</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planningRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.technicien_nom || request.technicien_matricule}</TableCell>
                          <TableCell>{formatDisplayDate(request.date_planification)}</TableCell>
                          <TableCell>{request.creneau === 'apres_midi' ? 'Après-midi' : 'Matin'}</TableCell>
                          <TableCell>{getMaintenancePlanningRequestTypeLabel(request.type_demande)}</TableCell>
                          <TableCell>{formatDisplayDate(request.date_souhaitee)}</TableCell>
                          <TableCell>
                            <Badge className={getMaintenancePlanningRequestStatusBadgeClass(request.statut)}>
                              {request.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[260px] whitespace-normal text-sm text-muted-foreground">
                            {request.commentaire_chef || request.commentaire_exploitation || request.motif || 'Aucun commentaire'}
                            <div className="mt-1 text-xs">
                              {request.date_traitement_chef ? `Chef : ${formatDisplayDateTime(request.date_traitement_chef)}` : ''}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {request.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleProcessPlanningRequest(request, true)} disabled={isLoading}>
                                  Valider
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleProcessPlanningRequest(request, false)} disabled={isLoading}>
                                  Refuser
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {request.traitee_par_chef || request.traitee_par_exploitation || 'Traitée'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
        );
      })()}

      {/* Visionneuse fiche PDF */}
      <Dialog open={ficheDialog.open} onOpenChange={(open) => !open && setFicheDialog({ open: false, html: '', loading: false })}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Fiche de maintenance</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {ficheDialog.loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement…</div>
            ) : (
              <iframe
                srcDoc={ficheDialog.html}
                sandbox="allow-same-origin"
                className="h-full w-full border-0"
                title="Fiche de maintenance"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MaintenanceTerminauxPage;
