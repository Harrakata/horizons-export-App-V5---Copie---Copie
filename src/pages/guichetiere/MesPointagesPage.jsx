import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, CalendarCheck2, Clock3, FileText } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { formatDisplayDate, formatDisplayDateTime, isSupabaseAuthError } from '@/lib/guichetiereSpace';

const MesPointagesPage = () => {
  const { guichetiereInfo, guichetiereDetails } = useOutletContext();
  const { toast } = useToast();
  const [planningEntries, setPlanningEntries] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [creneauxCount, setCreneauxCount] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const currentMonthStart = useMemo(() => startOfMonth(new Date()), []);
  const currentMonthEnd = useMemo(() => endOfMonth(new Date()), []);
  const todayDate = format(new Date(), 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    if (!guichetiereInfo?.matricule || !guichetiereInfo?.id) return;

    setIsLoading(true);

    const [
      { data: planningData, error: planningError },
      { data: pointagesData, error: pointagesError },
      { data: settingsData, error: settingsError },
    ] = await Promise.all([
      supabase
        .from('planning')
        .select('id, date, agenceNom')
        .eq('guichetiereId', guichetiereInfo.id)
        .gte('date', format(currentMonthStart, 'yyyy-MM-dd'))
        .lte('date', format(currentMonthEnd, 'yyyy-MM-dd')),
      supabase
        .from('pointages')
        .select('*')
        .eq('guichetiereMatricule', guichetiereInfo.matricule)
        .order('date', { ascending: false })
        .order('time', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'general').single(),
    ]);

    if (planningError) {
      if (!isSupabaseAuthError(planningError)) {
        toast({
          title: 'Erreur chargement planning',
          description: planningError.message,
          variant: 'destructive',
        });
      }
      setPlanningEntries([]);
    } else {
      setPlanningEntries(planningData || []);
    }

    if (pointagesError) {
      if (!isSupabaseAuthError(pointagesError)) {
        toast({
          title: 'Erreur chargement pointages',
          description: pointagesError.message,
          variant: 'destructive',
        });
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

    setIsLoading(false);
  }, [currentMonthEnd, currentMonthStart, guichetiereInfo?.id, guichetiereInfo?.matricule, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentMonthPlanningCount = planningEntries.length;
  const currentMonthPointages = pointages.filter((pointage) => {
    const pointageDate = new Date(pointage.date);
    return pointageDate >= currentMonthStart && pointageDate <= currentMonthEnd;
  });
  const expectedCurrentMonthPointages = currentMonthPlanningCount * creneauxCount;
  const completionRate =
    expectedCurrentMonthPointages === 0
      ? 0
      : Math.min(100, Math.round((currentMonthPointages.length / expectedCurrentMonthPointages) * 100));
  const todayPointages = pointages.filter((pointage) => pointage.date === todayDate).length;
  const latestPointage = pointages[0] || null;
  const filteredPointages = useMemo(
    () =>
      pointages.filter((pointage) => {
        if (dateFrom && pointage.date < dateFrom) return false;
        if (dateTo && pointage.date > dateTo) return false;
        return true;
      }),
    [dateFrom, dateTo, pointages]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <FileText className="mr-3 h-8 w-8" />
            Mes Pointages
          </CardTitle>
          <CardDescription>
            Statistiques personnelles de pointage pour {guichetiereInfo?.nomComplet} à {guichetiereInfo?.nomAgence}.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiStatCard
          icon={CalendarCheck2}
          label="Jours planifiés ce mois"
          value={currentMonthPlanningCount}
          helper="Nombre de journées programmées sur le mois en cours."
          tone="primary"
        />
        <KpiStatCard
          icon={Clock3}
          label="Pointages aujourd’hui"
          value={todayPointages}
          helper="Pointages effectivement enregistrés sur la journée."
          tone="amber"
        />
        <KpiStatCard
          icon={BarChart3}
          label="Taux de complétude"
          value={`${completionRate}%`}
          helper="Part des pointages réalisés par rapport aux créneaux attendus."
          tone="blue"
        />
        <KpiStatCard
          icon={FileText}
          label="Dernier pointage"
          value={latestPointage && !Number.isNaN(new Date(latestPointage.time).getTime()) ? format(new Date(latestPointage.time), 'dd/MM  HH:mm') : 'Aucun'}
          helper="Dernière trace de pointage enregistrée."
          tone="emerald"
        />
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Historique de mes pointages</CardTitle>
          <CardDescription>
            Retrouvez vos derniers pointages et leur créneau associé.
          </CardDescription>
          <div className="grid gap-4 pt-2 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de début</label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de fin</label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {isLoading
                ? 'Chargement des pointages...'
                : filteredPointages.length === 0
                ? 'Aucun pointage enregistré.'
                : `${filteredPointages.length} pointage(s) trouvé(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Créneau</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPointages.map((pointage) => (
                <TableRow key={pointage.id}>
                  <TableCell>{formatDisplayDate(pointage.date)}</TableCell>
                  <TableCell>{formatDisplayDateTime(pointage.time)}</TableCell>
                  <TableCell>{pointage.agence || guichetiereInfo?.nomAgence}</TableCell>
                  <TableCell>{pointage.type || 'Présence'}</TableCell>
                  <TableCell>
                    <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                      Créneau {(pointage.creneauIndex ?? 0) + 1}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MesPointagesPage;
