import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, CalendarCheck2, Clock3, FileText } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/guichetiereSpace';

const MesPointagesPage = () => {
  const { guichetiereInfo, guichetiereDetails } = useOutletContext();
  const { toast } = useToast();
  const [planningEntries, setPlanningEntries] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [creneauxCount, setCreneauxCount] = useState(2);
  const [isLoading, setIsLoading] = useState(false);

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
      toast({
        title: 'Erreur chargement planning',
        description: planningError.message,
        variant: 'destructive',
      });
      setPlanningEntries([]);
    } else {
      setPlanningEntries(planningData || []);
    }

    if (pointagesError) {
      toast({
        title: 'Erreur chargement pointages',
        description: pointagesError.message,
        variant: 'destructive',
      });
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Card className="shadow-xl glassmorphism">
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
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CalendarCheck2 className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Jours planifiés ce mois</p>
              <p className="text-2xl font-bold">{currentMonthPlanningCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Clock3 className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">Pointages aujourd’hui</p>
              <p className="text-2xl font-bold">{todayPointages}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Taux de complétude</p>
              <p className="text-2xl font-bold">{completionRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <FileText className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Dernier pointage</p>
              <p className="text-sm font-semibold">{latestPointage ? formatDisplayDateTime(latestPointage.time) : 'Aucun'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Historique de mes pointages</CardTitle>
          <CardDescription>
            Retrouvez vos derniers pointages et leur créneau associé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {isLoading
                ? 'Chargement des pointages...'
                : pointages.length === 0
                ? 'Aucun pointage enregistré.'
                : `${pointages.length} pointage(s) trouvé(s).`}
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
              {pointages.map((pointage) => (
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
