import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsChartCard from '@/components/analytics/StatsChartCard';
import { aggregateCountsByLabel, ANALYTICS_GRANULARITY_OPTIONS, buildAnalyticsBuckets } from '@/lib/analytics';
import {
  buildTerminalMonitoringGroups,
  getMaintenanceFollowUp,
  getTerminalSousEnsembles,
  normalizeMaintenanceText,
} from '@/lib/maintenanceMonitoring';

const ALL_DIMENSIONS = {
  terminal: 'Terminal',
  agence: 'Agence',
  region: 'Région',
  sous_ensemble: 'Sous-ensemble',
};

const MaintenanceAnalyticsSection = ({
  title = 'Analyse des non-conformités maintenance',
  description = 'Visualisez la répartition des terminaux à traiter et leur évolution dans le temps.',
  groups = [],
  terminaux = [],
  interventions = [],
  agenciesById = {},
  availableDimensions = ['terminal', 'agence'],
  referenceDate = new Date(),
  showAdvancedCharts = false,
  kpiSlot = null,
}) => {
  const [distributionDimension, setDistributionDimension] = useState(availableDimensions[0] || 'terminal');
  const [trendGranularity, setTrendGranularity] = useState('week');

  const nonCompliantGroups = useMemo(
    () => groups.filter((group) => group.followUp.label !== 'Maintenance à jour'),
    [groups]
  );

  const distributionData = useMemo(() => {
    if (distributionDimension === 'region') {
      return aggregateCountsByLabel(nonCompliantGroups, (group) => group.regionNom || 'Région non renseignée');
    }

    if (distributionDimension === 'agence') {
      return aggregateCountsByLabel(nonCompliantGroups, (group) => group.agenceNom || 'Agence non renseignée');
    }

    if (distributionDimension === 'sous_ensemble') {
      return aggregateCountsByLabel(
        nonCompliantGroups.flatMap((group) =>
          group.sousEnsembles.filter((row) => row.followUp.label !== 'Maintenance à jour')
        ),
        (row) => `${row.sousEnsembleLabel} • ${row.sousEnsembleReference}`
      );
    }

    return aggregateCountsByLabel(nonCompliantGroups, (group) => group.terminalReference || 'Terminal non renseigné');
  }, [distributionDimension, nonCompliantGroups]);

  const scopedTerminals = useMemo(() => {
    const allowedIds = new Set(groups.map((group) => String(group.terminalId)));
    return terminaux.filter((terminal) => allowedIds.has(String(terminal.id)));
  }, [groups, terminaux]);

  const scopedTerminalIds = useMemo(
    () => new Set(scopedTerminals.map((terminal) => String(terminal.id))),
    [scopedTerminals]
  );

  const scopedInterventions = useMemo(
    () => interventions.filter((intervention) => scopedTerminalIds.has(String(intervention.terminal_id))),
    [interventions, scopedTerminalIds]
  );

  const trendData = useMemo(() => {
    const buckets = buildAnalyticsBuckets(trendGranularity, referenceDate);

    return buckets.map((bucket) => {
      const groupsAtBucket = buildTerminalMonitoringGroups(
        scopedTerminals,
        scopedInterventions.filter((intervention) => {
          const interventionDate = new Date(intervention.date_intervention || 0);
          return !Number.isNaN(interventionDate.getTime()) && interventionDate <= bucket.end;
        }),
        agenciesById,
        bucket.end
      );

      const overdueCount = groupsAtBucket.filter((group) => group.followUp.label !== 'Maintenance à jour').length;

      return {
        label: bucket.label,
        value: overdueCount,
      };
    });
  }, [agenciesById, referenceDate, scopedInterventions, scopedTerminals, trendGranularity]);

  const complianceData = useMemo(
    () => [
      {
        label: 'Terminaux à jour',
        value: Math.max(groups.length - nonCompliantGroups.length, 0),
      },
      {
        label: 'Terminaux à traiter',
        value: nonCompliantGroups.length,
      },
    ],
    [groups.length, nonCompliantGroups.length]
  );

  const rankingData = useMemo(() => distributionData.slice(0, 8), [distributionData]);

  return (
    <Card className="shadow-xl glassmorphism">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-primary truncate">
            <Activity className="h-5 w-5 shrink-0" />
            <span className="truncate">{title}</span>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={distributionDimension} onValueChange={setDistributionDimension}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Répartition" />
              </SelectTrigger>
              <SelectContent>
                {availableDimensions.map((dimension) => (
                  <SelectItem key={dimension} value={dimension}>
                    {ALL_DIMENSIONS[dimension] || dimension}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={trendGranularity} onValueChange={setTrendGranularity}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_GRANULARITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
        {kpiSlot && <div className="mt-2">{kpiSlot}</div>}
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 xl:grid-cols-2">
        <StatsChartCard
          type="pie"
          title="Répartition actuelle"
          description="Nombre de terminaux ou sous-ensembles actuellement non conformes."
          data={distributionData}
        />
        <StatsChartCard
          type="line"
          title="Évolution des non-conformités"
          description="Volume des terminaux en retard de maintenance sur la période."
          data={trendData}
        />
        {showAdvancedCharts ? (
          <StatsChartCard
            type="bar"
            title="Classement des non-conformités"
            description="Les zones les plus exposées selon la répartition sélectionnée."
            data={rankingData}
          />
        ) : null}
        {showAdvancedCharts ? (
          <StatsChartCard
            type="progress"
            title="Répartition conformité / à traiter"
            description="Part des terminaux actuellement conformes par rapport à ceux qui nécessitent une action."
            data={complianceData}
          />
        ) : null}
      </CardContent>
    </Card>
  );
};

export default MaintenanceAnalyticsSection;
