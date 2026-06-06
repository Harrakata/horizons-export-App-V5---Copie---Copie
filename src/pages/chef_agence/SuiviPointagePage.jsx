import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePageState } from '@/hooks/usePageState';
import { motion } from 'framer-motion';
import { BarChart3, ClipboardCheck, Clock3, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import StatsChartCard from '@/components/analytics/StatsChartCard';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { ANALYTICS_GRANULARITY_OPTIONS } from '@/lib/analytics';
import {
  buildPointageDistributionData,
  buildPointageGuichetiereRows,
  buildPointageTrendData,
  formatPointageDateTime,
  normalizePointageText,
} from '@/lib/pointageMonitoring';
import { supabase } from '@/lib/supabaseClient';
import { isSupabaseAuthError } from '@/lib/guichetiereSpace';

const normalizeAgencyName = (value) => String(value || '').trim();

const buildAgencyNameScope = async ({ nomAgence, codePDV }) => {
  const names = new Set([normalizeAgencyName(nomAgence)].filter(Boolean));
  const cleanCode = String(codePDV || '').trim();

  if (cleanCode) {
    const { data } = await supabase
      .from('agences')
      .select('nom')
      .eq('codePDV', cleanCode);

    (data || []).forEach((agence) => {
      const name = normalizeAgencyName(agence.nom);
      if (name) names.add(name);
    });
  }

  return Array.from(names);
};

const SuiviPointagePage = () => {
  const { nomAgence, chefDetails } = useOutletContext();
  const { toast } = useToast();
  const [guichetieresById, setGuichetieresById] = useState({});
  const [planningEntries, setPlanningEntries] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [creneauxCount, setCreneauxCount] = useState(2);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDetailGuichetiereId, setSelectedDetailGuichetiereId] = useState(null);
  const [searchTerm, setSearchTerm] = usePageState('chef-suivi-pointage', 'searchTerm', '');
  const [trendGranularity, setTrendGranularity] = usePageState('chef-suivi-pointage', 'trendGranularity', 'week');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!nomAgence) return;

    setIsLoading(true);

    const selectedDateReference = new Date(`${selectedDate}T00:00:00`);
    const safeSelectedDate = Number.isNaN(selectedDateReference.getTime()) ? new Date() : selectedDateReference;
    const historyStartDate = new Date(safeSelectedDate);
    historyStartDate.setMonth(historyStartDate.getMonth() - 11);
    const historyStart = historyStartDate.toISOString().slice(0, 10);
    const agencyNames = await buildAgencyNameScope({
      nomAgence,
      codePDV: chefDetails?.codePDV,
    });

    // SCD Type 2 : source de vérité = guichetiere_agence_history.
    // 1) On récupère d'abord les codes_prepose actuellement affectés à cette agence.
    const today = new Date().toISOString().slice(0, 10);
    let historyQuery = supabase
      .from('guichetiere_agence_history')
      .select('code_prepose, valid_from, valid_to')
      .or(`valid_to.is.null,valid_to.gte.${today}`);

    historyQuery = agencyNames.length > 1
      ? historyQuery.in('agence_assignee', agencyNames)
      : historyQuery.eq('agence_assignee', agencyNames[0] || nomAgence);

    const { data: histRows, error: histError } = await historyQuery;

    if (histError && !isSupabaseAuthError(histError)) {
      toast({ title: 'Erreur chargement guichetières', description: histError.message, variant: 'destructive' });
    }

    const codesMap = {};
    (histRows || []).forEach((h) => {
      const prev = codesMap[h.code_prepose];
      if (!prev) { codesMap[h.code_prepose] = h; return; }
      const isCurrent = (x) => x.valid_to == null;
      if (isCurrent(h) && !isCurrent(prev)) codesMap[h.code_prepose] = h;
      else if (isCurrent(h) === isCurrent(prev) && (h.valid_from || '') > (prev.valid_from || '')) {
        codesMap[h.code_prepose] = h;
      }
    });
    const currentCodes = Object.keys(codesMap);

    const [
      { data: planningData, error: planningError },
      { data: pointagesData, error: pointagesError },
      { data: settingsData, error: settingsError },
      { data: guichetieresData, error: guichetieresError },
    ] = await Promise.all([
      (() => {
        let query = supabase
          .from('planning')
          .select('id, date, agenceNom, guichetiereId')
          .gte('date', historyStart)
          .lte('date', selectedDate);
        return agencyNames.length > 1
          ? query.in('agenceNom', agencyNames)
          : query.eq('agenceNom', agencyNames[0] || nomAgence);
      })(),
      (() => {
        let query = supabase
          .from('pointages')
          .select('*')
          .gte('date', historyStart)
          .lte('date', selectedDate)
          .order('date', { ascending: false })
          .order('time', { ascending: false });
        return agencyNames.length > 1
          ? query.in('agence', agencyNames)
          : query.eq('agence', agencyNames[0] || nomAgence);
      })(),
      supabase.from('app_settings').select('value').eq('key', 'general').single(),
      // 2) Fetch les guichetières par leur code_prepose (sources de vérité depuis history).
      //    Si aucune affectation courante n'est trouvée, on retombe sur la requête legacy
      //    pour garder un comportement en cas de table d'historique vide.
      currentCodes.length > 0
        ? supabase
            .from('guichetieres')
            .select('id, matricule, nom, prenom, codePrepose')
            .in('codePrepose', currentCodes)
            .eq('is_current', true)
        : supabase
            .from('guichetieres')
            .select('id, matricule, nom, prenom, codePrepose')
            .in('agenceAssigne', agencyNames.length ? agencyNames : [nomAgence])
            .eq('is_current', true),
    ]);

    if (planningError) {
      if (!isSupabaseAuthError(planningError)) {
        toast({ title: 'Erreur chargement planning', description: planningError.message, variant: 'destructive' });
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
  }, [chefDetails?.codePDV, nomAgence, selectedDate, toast]);

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

  const guichetiereRows = useMemo(
    () =>
      buildPointageGuichetiereRows({
        planningEntries: selectedDatePlanningEntries,
        pointages: selectedDatePointages,
        guichetieresById,
        creneauxCount,
      }).filter((row) => !searchTerm || row.searchBlob.includes(normalizePointageText(searchTerm))),
    [creneauxCount, guichetieresById, searchTerm, selectedDatePlanningEntries, selectedDatePointages]
  );

  useEffect(() => {
    const fallbackId = guichetiereRows[0]?.id || null;

    if (!selectedDetailGuichetiereId && fallbackId) {
      setSelectedDetailGuichetiereId(fallbackId);
      return;
    }

    if (
      selectedDetailGuichetiereId &&
      !guichetiereRows.some((row) => String(row.id) === String(selectedDetailGuichetiereId))
    ) {
      setSelectedDetailGuichetiereId(fallbackId);
    }
  }, [guichetiereRows, selectedDetailGuichetiereId]);

  const selectedGuichetiereRow =
    guichetiereRows.find((row) => String(row.id) === String(selectedDetailGuichetiereId)) || null;

  const stats = useMemo(() => {
    const totalPointages = guichetiereRows.reduce((total, row) => total + row.pointagesCount, 0);
    const totalExpected = guichetiereRows.reduce((total, row) => total + row.expectedCount, 0);
    const totalNonConformities = guichetiereRows.reduce((total, row) => total + row.nonConformityCount, 0);
    const completionRate = totalExpected === 0 ? 0 : Math.min(100, Math.round((totalPointages / totalExpected) * 100));

    return {
      guichetiereCount: guichetiereRows.length,
      totalPointages,
      totalExpected,
      totalNonConformities,
      completionRate,
    };
  }, [guichetiereRows]);

  const distributionData = useMemo(
    () => buildPointageDistributionData(guichetiereRows, (row) => row.nomComplet || row.matricule),
    [guichetiereRows]
  );

  const rankingData = useMemo(() => distributionData.slice(0, 8), [distributionData]);

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

  const trendData = useMemo(
    () =>
      buildPointageTrendData({
        planningEntries,
        pointages,
        creneauxCount,
        granularity: trendGranularity,
        referenceDate: new Date(`${selectedDate}T00:00:00`),
      }),
    [creneauxCount, planningEntries, pointages, selectedDate, trendGranularity]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <ClipboardCheck className="mr-3 h-8 w-8" />
            Suivi Pointage
          </CardTitle>
          <CardDescription>
            Suivez les pointages des guichetières de {nomAgence} et les écarts de conformité sur la période.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiStatCard
          icon={<Users />}
          label="Guichetières suivies"
          value={stats.guichetiereCount}
          helper="Guichetières planifiées sur la date affichée."
          tone="primary"
        />
        <KpiStatCard
          icon={<Clock3 />}
          label="Pointages enregistrés"
          value={stats.totalPointages}
          helper="Pointages saisis sur les créneaux attendus."
          tone="blue"
        />
        <KpiStatCard
          icon={<BarChart3 />}
          label="Non-conformités"
          value={stats.totalNonConformities}
          helper="Créneaux manquants ou incomplets sur votre agence."
          tone="amber"
        />
        <KpiStatCard
          icon={<ClipboardCheck />}
          label="Taux global"
          value={`${stats.completionRate}%`}
          helper="Taux de couverture du pointage du jour."
          tone="emerald"
        />
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-2xl text-primary">Analyse des non-conformités</CardTitle>
            <CardDescription>
              Répartition des écarts par guichetière et évolution des non-conformités sur la période observée.
            </CardDescription>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Date de suivi</p>
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
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
            description="Pointages manquants par guichetière sur la date sélectionnée."
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
            title="Classement des guichetières les plus exposées"
            description="Guichetières ayant le plus grand volume de pointages manquants sur la date affichée."
            data={rankingData}
          />
          <StatsChartCard
            type="progress"
            title="Couverture globale des pointages"
            description="Répartition entre pointages remontés et pointages encore manquants sur votre agence."
            data={complianceData}
          />
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Recherche</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Nom, prénom ou matricule..."
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
              {guichetiereRows.length === 0
                ? 'Aucune donnée de pointage trouvée pour la date ou les filtres actuels.'
                : `${guichetiereRows.length} guichetière(s) affichée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Guichetière</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Pointages</TableHead>
                <TableHead>Attendus</TableHead>
                <TableHead>Suivi</TableHead>
                <TableHead>Dernier pointage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guichetiereRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                    String(selectedDetailGuichetiereId) === String(row.id) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedDetailGuichetiereId(row.id)}
                >
                  <TableCell className="font-medium">{row.nomComplet}</TableCell>
                  <TableCell>{row.matricule}</TableCell>
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

      {selectedGuichetiereRow && (
        <Card className="shadow-xl glassmorphism">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">
              Détail du pointage - {selectedGuichetiereRow.nomComplet}
            </CardTitle>
            <CardDescription>
              {selectedGuichetiereRow.matricule} • Suivi du {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('fr-FR')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pointages</p>
                <p className="mt-1 text-lg font-semibold">{selectedGuichetiereRow.pointagesCount}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Attendus</p>
                <p className="mt-1 text-lg font-semibold">{selectedGuichetiereRow.expectedCount}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Non-conformités</p>
                <p className="mt-1 text-lg font-semibold">{selectedGuichetiereRow.nonConformityCount}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dernier pointage</p>
                <p className="mt-1 font-medium">{formatPointageDateTime(selectedGuichetiereRow.latestPointage?.time)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Heure</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Créneau</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGuichetiereRow.pointages.length === 0 ? (
                    <tr className="border-t bg-white">
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        Aucun pointage enregistré sur cette date.
                      </td>
                    </tr>
                  ) : (
                    selectedGuichetiereRow.pointages.map((pointage) => (
                      <tr key={pointage.id} className="border-t bg-white">
                        <td className="px-4 py-3">{formatPointageDateTime(pointage.time)}</td>
                        <td className="px-4 py-3">{pointage.type || 'Présence'}</td>
                        <td className="px-4 py-3">Créneau {(pointage.creneauIndex ?? 0) + 1}</td>
                      </tr>
                    ))
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

export default SuiviPointagePage;
