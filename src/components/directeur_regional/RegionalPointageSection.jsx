import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ClipboardCheck, Clock3, PieChart, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import StatsChartCard from '@/components/analytics/StatsChartCard';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { ANALYTICS_GRANULARITY_OPTIONS } from '@/lib/analytics';
import {
  buildPointageAgencyRows,
  buildPointageDistributionData,
  buildPointageTrendData,
  formatPointageDateTime,
  getPointageStatusMeta,
  normalizePointageText,
} from '@/lib/pointageMonitoring';
import { supabase } from '@/lib/supabaseClient';
import { isSupabaseAuthError } from '@/lib/guichetiereSpace';
import { fetchRegions, normalizeRegionText, resolveRegionName } from '@/lib/regions';

const ALL_FILTER_VALUE = '__all__';

const RegionalPointageSection = ({ regionName = '', allowAllRegions = false, hideHeader = false }) => {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [planningEntries, setPlanningEntries] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [guichetieresById, setGuichetieresById] = useState({});
  const [creneauxCount, setCreneauxCount] = useState(2);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAgenceId, setSelectedAgenceId] = useState(ALL_FILTER_VALUE);
  const [selectedDetailAgence, setSelectedDetailAgence] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [distributionDimension, setDistributionDimension] = useState(allowAllRegions ? 'region' : 'agence');
  const [trendGranularity, setTrendGranularity] = useState('week');
  const [isLoading, setIsLoading] = useState(false);

  const effectiveRegionName = useMemo(
    () => resolveRegionName(regions, regionName) || regionName || '',
    [regionName, regions]
  );

  useEffect(() => {
    setDistributionDimension(allowAllRegions ? 'region' : 'agence');
  }, [allowAllRegions]);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [{ data: regionsData, error: regionsError }, { data: agencesData, error: agencesError }] = await Promise.all([
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region').eq('is_current', true).order('nom', { ascending: true }),
    ]);

    if (regionsError && !isSupabaseAuthError(regionsError)) {
      toast({ title: 'Erreur chargement régions', description: regionsError.message, variant: 'destructive' });
    }

    if (agencesError) {
      if (!isSupabaseAuthError(agencesError)) {
        toast({ title: 'Erreur chargement agences', description: agencesError.message, variant: 'destructive' });
      }
      setIsLoading(false);
      return;
    }

    const nextRegions = regionsData || [];
    const nextEffectiveRegionName = resolveRegionName(nextRegions, regionName) || regionName || '';
    const regionalAgences = !nextEffectiveRegionName && allowAllRegions
      ? agencesData || []
      : (agencesData || []).filter(
          (agence) => normalizeRegionText(agence.region) === normalizeRegionText(nextEffectiveRegionName)
        );

    setRegions(nextRegions);
    setAgences(regionalAgences);

    if ((!nextEffectiveRegionName && !allowAllRegions) || regionalAgences.length === 0) {
      setPlanningEntries([]);
      setPointages([]);
      setGuichetieresById({});
      setIsLoading(false);
      return;
    }

    const agenceNames = regionalAgences.map((agence) => agence.nom);
    const selectedDateReference = new Date(`${selectedDate}T00:00:00`);
    const safeSelectedDate = Number.isNaN(selectedDateReference.getTime()) ? new Date() : selectedDateReference;
    const historyStartDate = new Date(safeSelectedDate);
    historyStartDate.setMonth(historyStartDate.getMonth() - 11);
    const historyStart = historyStartDate.toISOString().slice(0, 10);
    const historyEnd = selectedDate;

    const [
      { data: planningData, error: planningError },
      { data: pointagesData, error: pointagesError },
      { data: settingsData, error: settingsError },
    ] = await Promise.all([
      supabase
        .from('planning')
        .select('id, date, agenceNom, guichetiereId, remplacante_de_id, est_remplacante')
        .gte('date', historyStart)
        .lte('date', historyEnd)
        .in('agenceNom', agenceNames),
      supabase
        .from('pointages')
        .select('*')
        .gte('date', historyStart)
        .lte('date', historyEnd)
        .in('agence', agenceNames)
        .not('geo_refused', 'is', true),
      supabase.from('app_settings').select('value').eq('key', 'general').single(),
    ]);

    if (planningError) {
      if (!isSupabaseAuthError(planningError)) {
        toast({ title: 'Erreur chargement planning pointage', description: planningError.message, variant: 'destructive' });
      }
      setPlanningEntries([]);
    } else {
      setPlanningEntries(planningData || []);
    }

    if (pointagesError) {
      if (!isSupabaseAuthError(pointagesError)) {
        toast({ title: 'Erreur chargement pointages', description: pointagesError.message, variant: 'destructive' });
      }
      setPointages([]);
    } else {
      setPointages(pointagesData || []);
    }

    if (!settingsError && settingsData?.value?.creneauxPointage?.length) {
      setCreneauxCount(settingsData.value.creneauxPointage.length);
    } else {
      setCreneauxCount(2);
    }

    const guichetiereIds = Array.from(
      new Set((planningData || []).map((entry) => entry.guichetiereId).filter(Boolean))
    );

    if (guichetiereIds.length === 0) {
      setGuichetieresById({});
      setIsLoading(false);
      return;
    }

    const { data: guichetieresData, error: guichetieresError } = await supabase
      .from('guichetieres')
      .select('id, matricule, nom, prenom')
      .in('id', guichetiereIds);

    if (guichetieresError) {
      if (!isSupabaseAuthError(guichetieresError)) {
        toast({ title: 'Erreur chargement guichetières', description: guichetieresError.message, variant: 'destructive' });
      }
      setGuichetieresById({});
    } else {
      setGuichetieresById(
        (guichetieresData || []).reduce((accumulator, guichetiere) => {
          accumulator[String(guichetiere.id)] = guichetiere;
          return accumulator;
        }, {})
      );
    }

    setIsLoading(false);
  }, [allowAllRegions, regionName, selectedDate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedDatePlanningEntries = useMemo(
    () => planningEntries.filter((entry) => entry.date === selectedDate),
    [planningEntries, selectedDate]
  );

  const selectedDatePointages = useMemo(
    () => pointages.filter((pointage) => pointage.date === selectedDate),
    [pointages, selectedDate]
  );

  const pointageRows = useMemo(
    () =>
      buildPointageAgencyRows({
        agences,
        planningEntries: selectedDatePlanningEntries,
        pointages: selectedDatePointages,
        guichetieresById,
        creneauxCount,
      })
        .filter((row) =>
          selectedAgenceId === ALL_FILTER_VALUE ? true : String(row.agenceId) === String(selectedAgenceId)
        )
        .filter((row) => !searchTerm || row.searchBlob.includes(normalizePointageText(searchTerm))),
    [agences, creneauxCount, guichetieresById, searchTerm, selectedAgenceId, selectedDatePlanningEntries, selectedDatePointages]
  );

  useEffect(() => {
    const fallbackAgenceId = pointageRows[0]?.agenceId || null;

    if (!selectedDetailAgence && fallbackAgenceId) {
      setSelectedDetailAgence(fallbackAgenceId);
      return;
    }

    if (
      selectedDetailAgence &&
      !pointageRows.some((row) => String(row.agenceId) === String(selectedDetailAgence))
    ) {
      setSelectedDetailAgence(fallbackAgenceId);
    }
  }, [pointageRows, selectedDetailAgence]);

  const selectedAgenceRow =
    pointageRows.find((row) => String(row.agenceId) === String(selectedDetailAgence)) || null;

  const stats = useMemo(() => {
    const plannedGuichetieres = pointageRows.reduce((total, row) => total + row.plannedCount, 0);
    const totalPointages = pointageRows.reduce((total, row) => total + row.pointagesCount, 0);
    const totalExpected = pointageRows.reduce((total, row) => total + row.expectedCount, 0);
    const globalRate = totalExpected === 0 ? 0 : Math.min(100, Math.round((totalPointages / totalExpected) * 100));
    const totalNonConformities = pointageRows.reduce((total, row) => total + row.nonConformityCount, 0);

    return {
      agenciesCount: pointageRows.length,
      plannedGuichetieres,
      totalPointages,
      totalExpected,
      globalRate,
      totalNonConformities,
    };
  }, [pointageRows]);

  const selectedAgenceName = useMemo(
    () => agences.find((agence) => String(agence.id) === String(selectedAgenceId))?.nom || null,
    [agences, selectedAgenceId]
  );

  const scopedPlanningHistory = useMemo(
    () =>
      selectedAgenceName
        ? planningEntries.filter((entry) => normalizePointageText(entry.agenceNom) === normalizePointageText(selectedAgenceName))
        : planningEntries,
    [planningEntries, selectedAgenceName]
  );

  const scopedPointagesHistory = useMemo(
    () =>
      selectedAgenceName
        ? pointages.filter((pointage) => normalizePointageText(pointage.agence) === normalizePointageText(selectedAgenceName))
        : pointages,
    [pointages, selectedAgenceName]
  );

  const distributionOptions = allowAllRegions
    ? [
        { value: 'region', label: 'Région' },
        { value: 'agence', label: 'Agence' },
      ]
    : [{ value: 'agence', label: 'Agence' }];

  const distributionData = useMemo(
    () =>
      buildPointageDistributionData(
        pointageRows,
        distributionDimension === 'region'
          ? (row) => row.regionNom || 'Région non renseignée'
          : (row) => row.agenceNom || 'Agence non renseignée'
      ),
    [distributionDimension, pointageRows]
  );

  const trendData = useMemo(
    () =>
      buildPointageTrendData({
        planningEntries: scopedPlanningHistory,
        pointages: scopedPointagesHistory,
        creneauxCount,
        granularity: trendGranularity,
        referenceDate: new Date(`${selectedDate}T00:00:00`),
      }),
    [creneauxCount, pointages, scopedPlanningHistory, scopedPointagesHistory, selectedDate, trendGranularity]
  );

  const complianceData = useMemo(
    () => [
      {
        label: 'Pointages enregistrés',
        value: stats.totalPointages,
      },
      {
        label: 'Pointages manquants',
        value: Math.max(stats.totalExpected - stats.totalPointages, 0),
      },
    ],
    [stats.totalExpected, stats.totalPointages]
  );

  const rankingData = useMemo(() => distributionData.slice(0, 8), [distributionData]);

  if (!effectiveRegionName && !allowAllRegions) {
    return (
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Suivi Pointage</CardTitle>
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
      {!hideHeader && (
        <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader>
            <CardTitle className="flex items-center text-3xl font-bold text-primary">
              <ClipboardCheck className="mr-3 h-8 w-8" />
              Suivi Pointage
            </CardTitle>
            <CardDescription>
              Suivez le planning et les pointages enregistrés pour {scopeLabel}.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <KpiStatCard
          icon={<Users />}
          label="Agences suivies"
          value={stats.agenciesCount}
          helper="Agences visibles dans le périmètre et les filtres courants."
          tone="primary"
        />
        <KpiStatCard
          icon={<ClipboardCheck />}
          label="Guichetières planifiées"
          value={stats.plannedGuichetieres}
          helper="Effectif attendu selon le planning du jour."
          tone="emerald"
        />
        <KpiStatCard
          icon={<Clock3 />}
          label="Pointages enregistrés"
          value={stats.totalPointages}
          helper="Pointages réellement remontés sur la date affichée."
          tone="blue"
        />
        <KpiStatCard
          icon={<ClipboardCheck />}
          label="Non-conformités"
          value={stats.totalNonConformities}
          helper="Écarts entre pointages attendus et saisis."
          tone="amber"
        />
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-2xl text-primary">Analyse des non-conformités</CardTitle>
            <CardDescription>
              Répartition des écarts de pointage et évolution des non-conformités sur la période observée.
            </CardDescription>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Répartition par</p>
              <Select value={distributionDimension} onValueChange={setDistributionDimension}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une vue" />
                </SelectTrigger>
                <SelectContent>
                  {distributionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Granularité de la courbe</p>
              <Select value={trendGranularity} onValueChange={setTrendGranularity}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une granularité" />
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
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <StatsChartCard
            type="pie"
            title="Camembert des non-conformités"
            description="Volume des pointages manquants sur la date affichée."
            data={distributionData}
          />
          <StatsChartCard
            type="line"
            title="Évolution des non-conformités"
            description="Écart entre pointages attendus et pointages saisis sur la période."
            data={trendData}
          />
          <StatsChartCard
            type="bar"
            title="Classement des zones les plus exposées"
            description="Les agences ou régions qui concentrent le plus de non-conformités."
            data={rankingData}
          />
          <StatsChartCard
            type="progress"
            title="Couverture globale des pointages"
            description="Répartition entre pointages effectivement remontés et pointages encore manquants."
            data={complianceData}
          />
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Date</p>
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Agence</p>
              <Select value={selectedAgenceId} onValueChange={setSelectedAgenceId} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les agences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Toutes les agences</SelectItem>
                  {agences.map((agence) => (
                    <SelectItem key={agence.id} value={String(agence.id)}>
                      {agence.nom}
                    </SelectItem>
                  ))}
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
                  placeholder="Agence, code PDV, guichetière..."
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
              {pointageRows.length === 0
                ? 'Aucune donnée de pointage trouvée pour les filtres actuels.'
                : `${pointageRows.length} agence(s) affichée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Agence</TableHead>
                <TableHead>Guichetières planifiées</TableHead>
                <TableHead>Pointages</TableHead>
                <TableHead>Attendus</TableHead>
                <TableHead>Taux</TableHead>
                <TableHead>Dernier pointage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pointageRows.map((row) => (
                <TableRow
                  key={row.agenceId}
                  className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                    String(selectedDetailAgence) === String(row.agenceId) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedDetailAgence(row.agenceId)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{row.agenceNom}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.regionNom} • Code PDV: {row.codePDV}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{row.plannedCount}</TableCell>
                  <TableCell>{row.pointagesCount}</TableCell>
                  <TableCell>{row.expectedCount}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant="outline" className={row.statusMeta.className}>
                        {row.statusMeta.label}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{row.completionRate}%</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatPointageDateTime(row.latestPointage?.time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedAgenceRow && (
        <Card className="shadow-xl glassmorphism">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">
              Détail du pointage - {selectedAgenceRow.agenceNom}
            </CardTitle>
            <CardDescription>
              Planning du {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('fr-FR')} • {selectedAgenceRow.plannedCount} guichetière(s) • {creneauxCount} créneau(x)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Guichetières planifiées</p>
                <p className="mt-1 text-lg font-semibold">{selectedAgenceRow.plannedCount}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pointages enregistrés</p>
                <p className="mt-1 text-lg font-semibold">{selectedAgenceRow.pointagesCount}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pointages attendus</p>
                <p className="mt-1 text-lg font-semibold">{selectedAgenceRow.expectedCount}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dernier pointage</p>
                <p className="mt-1 font-medium">{formatPointageDateTime(selectedAgenceRow.latestPointage?.time)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Guichetière</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matricule</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pointages</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Suivi</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dernier pointage</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAgenceRow.plannedGuichetieres.length === 0 ? (
                    <tr className="border-t bg-white">
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        Aucune guichetière planifiée sur cette date.
                      </td>
                    </tr>
                  ) : (
                    selectedAgenceRow.plannedGuichetieres.map((entry) => {
                      const guichetiere = entry.guichetiere;
                      const guichetierePointages = selectedAgenceRow.pointages.filter(
                        (pointage) => normalizePointageText(pointage.guichetiereMatricule) === normalizePointageText(guichetiere?.matricule)
                      );
                      const statusMeta = getPointageStatusMeta(guichetierePointages.length, creneauxCount);
                      const latestPointage = [...guichetierePointages].sort(
                        (firstPointage, secondPointage) =>
                          new Date(secondPointage.time || 0).getTime() - new Date(firstPointage.time || 0).getTime()
                      )[0] || null;

                      return (
                        <tr key={entry.id} className="border-t bg-white">
                          <td className="px-4 py-3 font-medium">
                            {guichetiere ? `${guichetiere.prenom} ${guichetiere.nom}` : 'Guichetière introuvable'}
                          </td>
                          <td className="px-4 py-3">{guichetiere?.matricule || 'N/A'}</td>
                          <td className="px-4 py-3">{guichetierePointages.length}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={statusMeta.className}>
                              {statusMeta.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{formatPointageDateTime(latestPointage?.time)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default RegionalPointageSection;
