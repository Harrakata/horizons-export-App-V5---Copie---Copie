import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, ChevronDown, ChevronUp, Search, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import MaintenancePlanningSection from '@/components/maintenance/MaintenancePlanningSection';
import MaintenanceAnalyticsSection from '@/components/maintenance/MaintenanceAnalyticsSection';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { supabase } from '@/lib/supabaseClient';
import {
  buildTerminalMonitoringGroups,
  formatMaintenanceDateTime,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTerminalIds, setExpandedTerminalIds] = useState({});
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
    ] = await Promise.all([
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region').order('nom', { ascending: true }),
      supabase
        .from('terminaux')
        .select('id, agence_id, reference, type_terminal, position, statut, adresse_ip, imprimante_reference, lecteur_reference, ecran_reference')
        .order('reference', { ascending: true }),
      supabase
        .from('interventions_maintenance')
        .select('id, terminal_id, type_intervention, sous_ensemble, commentaire, statut, date_intervention, date_fin')
        .order('date_intervention', { ascending: false }),
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
                              <div className="m-4 rounded-xl border bg-background/80 p-4 shadow-sm">
                                <div className="mb-4 flex flex-col gap-1">
                                  <p className="font-semibold text-slate-900">
                                    Sous-ensembles du terminal {group.terminalReference}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {group.sousEnsembles.length} sous-ensemble(s) suivi(s).
                                  </p>
                                </div>

                                <div className="overflow-hidden rounded-lg border">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted/40">
                                      <tr>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                          Sous-ensemble
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                          Référence
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                          Dernière maintenance
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                          Type récente
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                          Suivi maintenance
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.sousEnsembles.map((row) => (
                                        <tr
                                          key={`${group.terminalId}-${row.sousEnsembleReference}`}
                                          className="border-t bg-white"
                                        >
                                          <td className="px-4 py-3 font-medium">{row.sousEnsembleLabel}</td>
                                          <td className="px-4 py-3">{row.sousEnsembleReference}</td>
                                          <td className="px-4 py-3">
                                            {formatMaintenanceDateTime(row.latestIntervention?.date_intervention)}
                                          </td>
                                          <td className="px-4 py-3">
                                            {row.latestIntervention
                                              ? getMaintenanceInterventionTypeLabel(row.latestIntervention.type_intervention)
                                              : 'Aucune'}
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="space-y-2">
                                              <Badge variant="outline" className={row.followUp.className}>
                                                {row.followUp.label}
                                              </Badge>
                                              <p className="text-xs text-muted-foreground">{row.followUp.detail}</p>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
    </motion.div>
  );
};

export default RegionalMaintenanceSection;
