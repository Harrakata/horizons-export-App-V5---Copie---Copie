import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, ChevronDown, ChevronUp, List, MapPinned, Search, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import MaintenancePlanningSection from '@/components/maintenance/MaintenancePlanningSection';
import MaintenanceAnalyticsSection from '@/components/maintenance/MaintenanceAnalyticsSection';
import MaintenanceAgenciesMap from '@/components/maintenance/MaintenanceAgenciesMap';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { supabase } from '@/lib/supabaseClient';
import {
  buildTerminalMonitoringGroups,
  formatMaintenanceDateTime,
  getMaintenanceInterventionStatusClass,
  getMaintenanceInterventionTypeLabel,
  normalizeMaintenanceText,
} from '@/lib/maintenanceMonitoring';
import { fetchRegions, normalizeRegionText, resolveRegionName } from '@/lib/regions';

const ALL_FILTER_VALUE = '__all__';

const RegionalMaintenanceSection = ({ regionName = '', allowAllRegions = false, viewerLabel = 'directeur régional' }) => {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [terminaux, setTerminaux] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [codesPannes, setCodesPannes] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTerminalIds, setExpandedTerminalIds] = useState({});
  const [seHistoryOpen, setSeHistoryOpen] = useState({});
  const [seHistoryLimit, setSeHistoryLimit] = useState({});
  const [ficheDialog, setFicheDialog] = useState({ open: false, html: '', loading: false });
  const [showMaintenanceMap, setShowMaintenanceMap] = useState(false);
  const [filters, setFilters] = useState({
    agenceId: ALL_FILTER_VALUE,
    terminalId: ALL_FILTER_VALUE,
    suivi: ALL_FILTER_VALUE,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [
      { data: regionsData, error: regionsError },
      { data: agencesData, error: agencesError },
      { data: terminauxData, error: terminauxError },
      { data: interventionsData, error: interventionsError },
      { data: codesPannesData, error: codesPannesError },
      { data: techniciensData, error: techniciensError },
    ] = await Promise.all([
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region, adresse').eq('is_current', true).order('nom', { ascending: true }),
      supabase
        .from('terminaux')
        .select('id, agence_id, reference, type_terminal, position, statut, adresse_ip, imprimante_reference, lecteur_reference, ecran_reference')
        .order('reference', { ascending: true }),
      supabase
        .from('interventions_maintenance')
        .select('id, terminal_id, type_intervention, sous_ensemble, commentaire, description_panne, statut, date_intervention, date_fin, fiche_url, code_panne_id, technicien_id')
        .order('date_intervention', { ascending: false }),
      supabase.from('codes_pannes').select('id, code, libelle'),
      supabase.from('techniciens').select('id, nom, prenom, matricule'),
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

    if (!codesPannesError) setCodesPannes(codesPannesData || []);
    if (!techniciensError) setTechniciens(techniciensData || []);

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const effectiveRegionName = useMemo(
    () => resolveRegionName(regions, regionName) || regionName || '',
    [regionName, regions]
  );

  const regionalAgences = useMemo(() => {
    if (!effectiveRegionName && allowAllRegions) {
      return agences;
    }

    return agences.filter(
      (agence) => normalizeRegionText(agence.region) === normalizeRegionText(effectiveRegionName)
    );
  }, [agences, allowAllRegions, effectiveRegionName]);

  const regionalAgencyIds = useMemo(
    () => regionalAgences.map((agence) => String(agence.id)),
    [regionalAgences]
  );

  const maintenanceMapAgences = useMemo(
    () =>
      regionalAgences.filter((agence) =>
        filters.agenceId === ALL_FILTER_VALUE
          ? true
          : String(agence.id) === String(filters.agenceId)
      ),
    [filters.agenceId, regionalAgences]
  );

  const regionalTerminaux = useMemo(
    () => terminaux.filter((terminal) => regionalAgencyIds.includes(String(terminal.agence_id))),
    [regionalAgencyIds, terminaux]
  );

  const regionalTerminalIds = useMemo(
    () => regionalTerminaux.map((terminal) => String(terminal.id)),
    [regionalTerminaux]
  );

  const regionalInterventions = useMemo(
    () => interventions.filter((intervention) => regionalTerminalIds.includes(String(intervention.terminal_id))),
    [interventions, regionalTerminalIds]
  );

  const agencesById = useMemo(
    () =>
      regionalAgences.reduce((accumulator, agence) => {
        accumulator[String(agence.id)] = agence;
        return accumulator;
      }, {}),
    [regionalAgences]
  );

  const maintenanceGroups = useMemo(
    () => buildTerminalMonitoringGroups(regionalTerminaux, regionalInterventions, agencesById),
    [agencesById, regionalInterventions, regionalTerminaux]
  );

  const terminalOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Tous les terminaux' },
      ...regionalTerminaux
        .filter(
          (terminal) =>
            filters.agenceId === ALL_FILTER_VALUE || String(terminal.agence_id) === String(filters.agenceId)
        )
        .map((terminal) => ({
          value: String(terminal.id),
          label: `${terminal.reference} • ${terminal.type_terminal || 'Sans type'}`,
        })),
    ],
    [filters.agenceId, regionalTerminaux]
  );

  const filteredMaintenanceGroups = useMemo(() => {
    const normalizedSearch = normalizeMaintenanceText(searchTerm);

    return maintenanceGroups
      .filter((group) =>
        filters.agenceId === ALL_FILTER_VALUE
          ? true
          : String(group.agenceId) === String(filters.agenceId)
      )
      .filter((group) =>
        filters.terminalId === ALL_FILTER_VALUE
          ? true
          : String(group.terminalId) === String(filters.terminalId)
      )
      .filter((group) =>
        filters.suivi === ALL_FILTER_VALUE
          ? true
          : filters.suivi === 'a_jour'
            ? group.followUp.label === 'Maintenance à jour'
            : group.followUp.label === 'Faire maintenance préventive'
      )
      .filter(
        (group) =>
          !normalizedSearch ||
          [
            group.agenceNom,
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
  }, [filters.agenceId, filters.suivi, filters.terminalId, maintenanceGroups, searchTerm]);

  const upToDateCount = filteredMaintenanceGroups.filter(
    (group) => group.followUp.label === 'Maintenance à jour'
  ).length;
  const preventiveRequiredCount = filteredMaintenanceGroups.filter(
    (group) => group.followUp.label === 'Faire maintenance préventive'
  ).length;
  const scopedTerminalIds = useMemo(
    () => new Set(filteredMaintenanceGroups.map((group) => String(group.terminalId))),
    [filteredMaintenanceGroups]
  );
  const scopedRegionalTerminaux = useMemo(
    () => regionalTerminaux.filter((terminal) => scopedTerminalIds.has(String(terminal.id))),
    [regionalTerminaux, scopedTerminalIds]
  );

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

  if (!effectiveRegionName && !allowAllRegions) {
    return (
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Maintenance des Terminaux</CardTitle>
          <CardDescription>
            Cette vue est disponible pour un directeur régional disposant d’une région assignée.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const scopeLabel = effectiveRegionName
    ? `les agences de la région ${effectiveRegionName}`
    : 'toutes les agences';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <Wrench className="mr-3 h-8 w-8" />
            Maintenance des Terminaux
          </CardTitle>
          <CardDescription>
            Consultez le planning et le suivi des maintenances pour {scopeLabel}.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="suivi" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suivi">Suivi des Terminaux</TabsTrigger>
          <TabsTrigger value="planning">Planification de Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="suivi" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiStatCard
              icon={<Wrench />}
              label="Terminaux suivis"
              value={filteredMaintenanceGroups.length}
              helper="Périmètre courant après application des filtres."
              tone="primary"
            />
            <KpiStatCard
              icon={<CalendarClock />}
              label="Maintenance à jour"
              value={upToDateCount}
              helper="Terminaux conformes sur le dernier mois."
              tone="emerald"
            />
            <KpiStatCard
              icon={<CalendarClock />}
              label="Préventives à planifier"
              value={preventiveRequiredCount}
              helper="Terminaux qui nécessitent une action préventive."
              tone="red"
            />
          </div>

          <MaintenanceAnalyticsSection
            title="Analyse des non-conformités maintenance"
            description="Répartition des terminaux à traiter et évolution des retards de maintenance sur la période."
            groups={filteredMaintenanceGroups}
            terminaux={scopedRegionalTerminaux}
            interventions={regionalInterventions}
            agenciesById={agencesById}
            availableDimensions={allowAllRegions ? ['region', 'agence', 'terminal', 'sous_ensemble'] : ['agence', 'terminal', 'sous_ensemble']}
            showAdvancedCharts
          />

          <Card className="shadow-xl glassmorphism">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-primary">Suivi des terminaux</CardTitle>
                  <CardDescription>
                    Filtrez les terminaux, puis visualisez les agences et leur état sur la carte.
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

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Agence</p>
                  <Select
                    value={filters.agenceId}
                    onValueChange={(value) =>
                      setFilters((previousState) => ({
                        ...previousState,
                        agenceId: value,
                        terminalId: ALL_FILTER_VALUE,
                      }))
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les agences" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>Toutes les agences</SelectItem>
                      {regionalAgences.map((agence) => (
                        <SelectItem key={agence.id} value={String(agence.id)}>
                          {agence.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                  <Select
                    value={filters.suivi}
                    onValueChange={(value) => setFilters((previousState) => ({ ...previousState, suivi: value }))}
                    disabled={isLoading}
                  >
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
                      placeholder="Terminal, agence, sous-ensemble..."
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
                    agencies={maintenanceMapAgences}
                    groups={filteredMaintenanceGroups}
                  />
                </div>
              )}

              <Table>
                <TableCaption>
                  {filteredMaintenanceGroups.length === 0
                    ? 'Aucun terminal ne correspond aux filtres.'
                    : `${filteredMaintenanceGroups.length} terminal(aux) affiché(s).`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agence</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Dernière maintenance</TableHead>
                    <TableHead>Suivi maintenance</TableHead>
                    <TableHead className="text-right">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaintenanceGroups.map((group) => {
                    const isExpanded = Boolean(expandedTerminalIds[String(group.terminalId)]);

                    return (
                      <React.Fragment key={group.terminalId}>
                        <TableRow>
                          <TableCell>{group.agenceNom || 'N/A'}</TableCell>
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
                            <TableCell colSpan={5} className="p-0">
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
                                  const rowInterventions = regionalInterventions
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
                                              const codePanne = i.code_panne_id ? codesPannes.find(c => String(c.id) === String(i.code_panne_id)) : null;
                                              const tech = i.technicien_id ? techniciens.find(t => String(t.id) === String(i.technicien_id)) : null;
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
                                                    {tech && (
                                                      <span className="text-muted-foreground">{tech.prenom} {tech.nom}{tech.matricule ? ` · ${tech.matricule}` : ''}</span>
                                                    )}
                                                    {i.fiche_url && (
                                                      <span className="ml-auto flex shrink-0 items-center gap-1 font-semibold text-primary">
                                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        Voir fiche
                                                      </span>
                                                    )}
                                                  </div>
                                                  {isCurative && (codePanne || i.description_panne) && (
                                                    <div className="flex flex-wrap items-start gap-3 rounded border border-red-100 bg-red-50 px-2 py-1.5">
                                                      {codePanne && (
                                                        <div className="shrink-0">
                                                          <span className="text-[10px] font-semibold uppercase text-red-400">Code panne</span>
                                                          <p className="font-mono font-bold text-red-800">{codePanne.code} — {codePanne.libelle}</p>
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
        </TabsContent>

        <TabsContent value="planning">
          <MaintenancePlanningSection
            title={
              effectiveRegionName
                ? `Planification de Maintenance - ${effectiveRegionName}`
                : 'Planification de Maintenance - Toutes les régions'
            }
            description={
              effectiveRegionName
                ? 'Consultez le planning maintenance des agences de votre région, ainsi que le suivi automatique des créneaux effectués ou non.'
                : 'Consultez le planning maintenance de toutes les agences, ainsi que le suivi automatique des créneaux effectués ou non.'
            }
            canManage={false}
            lockedRegion={effectiveRegionName || null}
            readOnlyMessage={`Le planning est affiché en consultation pour le ${viewerLabel}. Les affectations sont créées depuis l’Exploitation ou par le chef d’agence.`}
            emptyTitle={effectiveRegionName ? 'Aucune maintenance planifiée pour cette région.' : 'Aucune maintenance planifiée.'}
          />
        </TabsContent>
      </Tabs>

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

export default RegionalMaintenanceSection;
