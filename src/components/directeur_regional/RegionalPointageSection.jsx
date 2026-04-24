import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Clock3, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { fetchRegions, normalizeRegionText, resolveRegionName } from '@/lib/regions';

const ALL_FILTER_VALUE = '__all__';

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatPointageDateTime = (value) => {
  if (!value) return 'N/A';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 'N/A' : parsedDate.toLocaleString('fr-FR');
};

const getPointageStatusMeta = (count, expectedCount) => {
  if (expectedCount === 0) {
    return {
      label: 'Aucun planning',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (count === 0) {
    return {
      label: 'En attente',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  if (count < expectedCount) {
    return {
      label: 'En cours',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    };
  }

  return {
    label: 'Complet',
    className: 'border-green-200 bg-green-50 text-green-700',
  };
};

const RegionalPointageSection = ({ regionName = '', allowAllRegions = false }) => {
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
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [{ data: regionsData, error: regionsError }, { data: agencesData, error: agencesError }] = await Promise.all([
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region').order('nom', { ascending: true }),
    ]);

    if (regionsError) {
      toast({ title: 'Erreur chargement régions', description: regionsError.message, variant: 'destructive' });
    }

    if (agencesError) {
      toast({ title: 'Erreur chargement agences', description: agencesError.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const nextRegions = regionsData || [];
    const effectiveRegionName = resolveRegionName(nextRegions, regionName) || regionName || '';
    const regionalAgences = !effectiveRegionName && allowAllRegions
      ? agencesData || []
      : (agencesData || []).filter(
          (agence) => normalizeRegionText(agence.region) === normalizeRegionText(effectiveRegionName)
        );

    setRegions(nextRegions);
    setAgences(regionalAgences);

    if ((!effectiveRegionName && !allowAllRegions) || regionalAgences.length === 0) {
      setPlanningEntries([]);
      setPointages([]);
      setGuichetieresById({});
      setIsLoading(false);
      return;
    }

    const agenceNames = regionalAgences.map((agence) => agence.nom);

    const [
      { data: planningData, error: planningError },
      { data: pointagesData, error: pointagesError },
      { data: settingsData, error: settingsError },
    ] = await Promise.all([
      supabase
        .from('planning')
        .select('id, date, agenceNom, guichetiereId, remplacante_de_id, est_remplacante')
        .eq('date', selectedDate)
        .in('agenceNom', agenceNames),
      supabase
        .from('pointages')
        .select('*')
        .eq('date', selectedDate)
        .in('agence', agenceNames),
      supabase.from('app_settings').select('value').eq('key', 'general').single(),
    ]);

    if (planningError) {
      toast({ title: 'Erreur chargement planning pointage', description: planningError.message, variant: 'destructive' });
      setPlanningEntries([]);
    } else {
      setPlanningEntries(planningData || []);
    }

    if (pointagesError) {
      toast({ title: 'Erreur chargement pointages', description: pointagesError.message, variant: 'destructive' });
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
      toast({ title: 'Erreur chargement guichetières', description: guichetieresError.message, variant: 'destructive' });
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

  const effectiveRegionName = useMemo(
    () => resolveRegionName(regions, regionName) || regionName || '',
    [regionName, regions]
  );

  const pointageRows = useMemo(
    () =>
      agences
        .map((agence) => {
          const agencyPlanning = planningEntries.filter(
            (entry) => normalizeText(entry.agenceNom) === normalizeText(agence.nom)
          );
          const uniqueGuichetieres = Array.from(
            new Map(
              agencyPlanning.map((entry) => {
                const guichetiere = guichetieresById[String(entry.guichetiereId)] || null;
                const key = String(entry.guichetiereId || guichetiere?.matricule || entry.id);
                return [
                  key,
                  {
                    ...entry,
                    guichetiere,
                  },
                ];
              })
            ).values()
          );

          const agencyPointages = pointages.filter(
            (pointage) => normalizeText(pointage.agence) === normalizeText(agence.nom)
          );
          const expectedCount = uniqueGuichetieres.length * creneauxCount;
          const completionRate = expectedCount === 0 ? 0 : Math.min(100, Math.round((agencyPointages.length / expectedCount) * 100));
          const latestPointage = [...agencyPointages].sort(
            (firstPointage, secondPointage) =>
              new Date(secondPointage.time || 0).getTime() - new Date(firstPointage.time || 0).getTime()
          )[0] || null;

          return {
            agenceId: String(agence.id),
            agenceNom: agence.nom,
            codePDV: agence.codePDV || 'N/A',
            plannedGuichetieres: uniqueGuichetieres,
            plannedCount: uniqueGuichetieres.length,
            pointagesCount: agencyPointages.length,
            expectedCount,
            completionRate,
            latestPointage,
            pointages: agencyPointages,
            statusMeta: getPointageStatusMeta(agencyPointages.length, expectedCount),
            searchBlob: normalizeText(
              [
                agence.nom,
                agence.codePDV,
                ...uniqueGuichetieres.map((entry) =>
                  [entry.guichetiere?.matricule, entry.guichetiere?.prenom, entry.guichetiere?.nom].join(' ')
                ),
              ].join(' ')
            ),
          };
        })
        .filter((row) =>
          selectedAgenceId === ALL_FILTER_VALUE ? true : String(row.agenceId) === String(selectedAgenceId)
        )
        .filter((row) => !searchTerm || row.searchBlob.includes(normalizeText(searchTerm))),
    [agences, creneauxCount, guichetieresById, planningEntries, pointages, searchTerm, selectedAgenceId]
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

    return {
      agenciesCount: pointageRows.length,
      plannedGuichetieres,
      totalPointages,
      totalExpected,
      globalRate,
    };
  }, [pointageRows]);

  if (!effectiveRegionName && !allowAllRegions) {
    return (
      <Card className="shadow-xl glassmorphism">
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
      <Card className="shadow-xl glassmorphism">
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Agences suivies</p>
              <p className="text-2xl font-bold">{stats.agenciesCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <ClipboardCheck className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Guichetières planifiées</p>
              <p className="text-2xl font-bold">{stats.plannedGuichetieres}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <Clock3 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Pointages enregistrés</p>
              <p className="text-2xl font-bold">{stats.totalPointages}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <ClipboardCheck className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">Taux global</p>
              <p className="text-2xl font-bold">{stats.globalRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      <span className="text-xs text-muted-foreground">Code PDV: {row.codePDV}</span>
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
                        (pointage) => normalizeText(pointage.guichetiereMatricule) === normalizeText(guichetiere?.matricule)
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
