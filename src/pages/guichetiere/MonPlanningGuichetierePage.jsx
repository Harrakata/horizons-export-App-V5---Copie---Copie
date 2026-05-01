import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import {
  PLANNING_REQUEST_TYPES,
  REQUEST_STATUS,
  formatDisplayDate,
  formatDisplayDateTime,
  getPlanningRequestTypeLabel,
  getRequestStatusBadgeClass,
  isMissingSupabaseTableError,
  normalizeText,
} from '@/lib/guichetiereSpace';

const defaultRequestForm = {
  type_demande: PLANNING_REQUEST_TYPES.UNAVAILABILITY,
  date_souhaitee: '',
  motif: '',
};

const MonPlanningGuichetierePage = () => {
  const { guichetiereInfo, guichetiereDetails, nomAgence } = useOutletContext();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [planningEntries, setPlanningEntries] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedPlanningEntry, setSelectedPlanningEntry] = useState(null);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const todayDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const days = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthEnd, monthStart]
  );

  const colStartClasses = useMemo(() => {
    const firstDayOfWeek = getDay(monthStart);
    const adjustedFirstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const classes = [
      'col-start-1',
      'col-start-2',
      'col-start-3',
      'col-start-4',
      'col-start-5',
      'col-start-6',
      'col-start-7',
    ];
    return classes[adjustedFirstDayOfWeek];
  }, [monthStart]);

  const loadPlanning = useCallback(async () => {
    if (!guichetiereInfo?.id) return;

    setIsLoading(true);

    const [{ data: planningData, error: planningError }, { data: requestsData, error: requestsError }] =
      await Promise.all([
        supabase
          .from('planning')
          .select('id, date, agenceNom, guichetiereId, chefAgenceId')
          .eq('guichetiereId', guichetiereInfo.id)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'))
          .order('date', { ascending: true }),
        supabase
          .from('planning_modification_requests')
          .select('*')
          .eq('guichetiere_matricule', guichetiereInfo.matricule)
          .order('created_at', { ascending: false }),
      ]);

    if (planningError) {
      toast({
        title: 'Erreur de chargement',
        description: planningError.message,
        variant: 'destructive',
      });
      setPlanningEntries([]);
    } else {
      setPlanningEntries(planningData || []);
    }

    if (requestsError) {
      if (!isMissingSupabaseTableError(requestsError, 'planning_modification_requests')) {
        toast({
          title: 'Erreur de chargement des demandes',
          description: requestsError.message,
          variant: 'destructive',
        });
      }
      setRequests([]);
    } else {
      setRequests(requestsData || []);
    }

    setIsLoading(false);
  }, [guichetiereInfo?.id, guichetiereInfo?.matricule, monthEnd, monthStart, toast]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  const planningByDate = useMemo(
    () =>
      planningEntries.reduce((accumulator, entry) => {
        if (!accumulator[entry.date]) {
          accumulator[entry.date] = [];
        }
        accumulator[entry.date].push(entry);
        return accumulator;
      }, {}),
    [planningEntries]
  );

  const requestByPlanningId = useMemo(
    () =>
      requests.reduce((accumulator, request) => {
        if (!accumulator[String(request.planning_id)]) {
          accumulator[String(request.planning_id)] = request;
        }
        return accumulator;
      }, {}),
    [requests]
  );

  const monthPlanningCount = planningEntries.length;
  const pendingRequestsCount = requests.filter((request) => request.statut === REQUEST_STATUS.PENDING).length;
  const isPastPlanningDate = useCallback(
    (dateValue) => Boolean(dateValue) && String(dateValue) < todayDate,
    [todayDate]
  );

  const openRequestDialog = (planningEntry) => {
    if (isPastPlanningDate(planningEntry?.date)) {
      toast({
        title: 'Modification impossible',
        description: 'Vous ne pouvez pas demander une modification sur une date de planning déjà dépassée.',
        variant: 'destructive',
      });
      return;
    }

    const currentRequest = requestByPlanningId[String(planningEntry.id)];
    if (currentRequest?.statut === REQUEST_STATUS.PENDING) {
      toast({
        title: 'Demande déjà envoyée',
        description: 'Une demande en attente existe déjà pour cette journée de planning.',
      });
      return;
    }

    setSelectedPlanningEntry(planningEntry);
    setRequestForm({
      type_demande: PLANNING_REQUEST_TYPES.UNAVAILABILITY,
      date_souhaitee: '',
      motif: '',
    });
    setIsRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPlanningEntry || !guichetiereInfo) return;

    if (isPastPlanningDate(selectedPlanningEntry.date)) {
      toast({
        title: 'Date dépassée',
        description: 'Cette date de planning est dépassée et ne peut plus être modifiée.',
        variant: 'destructive',
      });
      return;
    }

    if (
      requestForm.type_demande === PLANNING_REQUEST_TYPES.DATE_CHANGE &&
      !requestForm.date_souhaitee
    ) {
      toast({
        title: 'Date requise',
        description: 'Veuillez renseigner la date souhaitée pour le changement.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const payload = {
      planning_id: String(selectedPlanningEntry.id),
      guichetiere_id: String(guichetiereInfo.id),
      guichetiere_matricule: guichetiereInfo.matricule,
      guichetiere_nom: guichetiereInfo.nomComplet,
      agence_nom: selectedPlanningEntry.agenceNom || nomAgence || guichetiereInfo.nomAgence,
      chef_agence_id: selectedPlanningEntry.chefAgenceId ? String(selectedPlanningEntry.chefAgenceId) : null,
      date_planning: selectedPlanningEntry.date,
      type_demande: requestForm.type_demande,
      date_souhaitee:
        requestForm.type_demande === PLANNING_REQUEST_TYPES.DATE_CHANGE
          ? requestForm.date_souhaitee
          : null,
      motif: requestForm.motif?.trim() || null,
      statut: REQUEST_STATUS.PENDING,
    };

    const { error } = await supabase.from('planning_modification_requests').insert(payload);

    if (error) {
      if (isMissingSupabaseTableError(error, 'planning_modification_requests')) {
        toast({
          title: 'Table Supabase manquante',
          description:
            "La table 'planning_modification_requests' n'existe pas encore dans Supabase. Exécutez d'abord le SQL de création puis rechargez la page.",
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Erreur d’envoi',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Demande envoyée',
        description: 'Votre demande de modification a bien été transmise au chef d’agence.',
        className: 'bg-green-500 text-white',
      });
      setIsRequestDialogOpen(false);
      setSelectedPlanningEntry(null);
      setRequestForm(defaultRequestForm);
      loadPlanning();
    }

    setIsLoading(false);
  };

  const sortedRequests = useMemo(
    () =>
      [...requests].sort(
        (firstRequest, secondRequest) =>
          new Date(secondRequest.created_at || 0).getTime() -
          new Date(firstRequest.created_at || 0).getTime()
      ),
    [requests]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <CalendarDays className="mr-3 h-8 w-8" />
            Mon Planning
          </CardTitle>
          <CardDescription>
            Consultez votre planning mensuel et envoyez vos demandes d’indisponibilité ou de changement
            de date à votre chef d’agence.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiStatCard
          icon={CalendarDays}
          label="Jours planifiés"
          value={monthPlanningCount}
          helper="Journées de travail prévues sur la période affichée."
          tone="primary"
        />
        <KpiStatCard
          icon={AlertTriangle}
          label="Demandes en attente"
          value={pendingRequestsCount}
          helper="Demandes de modification encore à valider par le chef."
          tone="amber"
        />
        <KpiStatCard
          icon={Edit3}
          label="Historique des demandes"
          value={requests.length}
          helper="Nombre total de demandes envoyées depuis votre espace."
          tone="blue"
        />
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Calendrier</CardTitle>
              <CardDescription>{guichetiereInfo?.nomAgence}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[180px] text-center text-lg font-semibold">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border-l border-t border-border bg-border">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((dayName) => (
              <div
                key={dayName}
                className="border-b border-r bg-card py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {dayName}
              </div>
            ))}
            {days.map((day, index) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayPlanning = planningByDate[dateStr] || [];
              const isCurrentMonthDay = isSameMonth(day, currentMonth);
              const requestCount = dayPlanning.reduce((count, entry) => {
                const linkedRequest = requestByPlanningId[String(entry.id)];
                return linkedRequest ? count + 1 : count;
              }, 0);

              return (
                <div
                  key={dateStr}
                  className={`relative min-h-[130px] border-b border-r bg-card p-2 ${
                    index === 0 ? colStartClasses : ''
                  } ${!isCurrentMonthDay ? 'bg-muted/20 text-muted-foreground/50' : ''} ${
                    isSameDay(day, new Date()) ? 'ring-2 ring-primary z-10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <time dateTime={dateStr} className="text-sm font-semibold">
                      {format(day, 'd')}
                    </time>
                    {requestCount > 0 ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">{requestCount}</Badge>
                    ) : null}
                  </div>

                  <AnimatePresence>
                    {dayPlanning.map((entry) => {
                      const linkedRequest = requestByPlanningId[String(entry.id)];

                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          className="mt-2 rounded-md bg-primary/10 p-2 text-xs text-black dark:text-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold">{entry.agenceNom || nomAgence}</p>
                              {linkedRequest ? (
                                <Badge className={`mt-1 ${getRequestStatusBadgeClass(linkedRequest.statut)}`}>
                                  {linkedRequest.statut}
                                </Badge>
                              ) : null}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700"
                              onClick={() => openRequestDialog(entry)}
                              disabled={
                                linkedRequest?.statut === REQUEST_STATUS.PENDING ||
                                isPastPlanningDate(entry.date) ||
                                isLoading
                              }
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Mes demandes de modification</CardTitle>
          <CardDescription>Suivez le traitement de vos demandes par votre chef d’agence.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {sortedRequests.length === 0
                ? 'Aucune demande de modification envoyée.'
                : `${sortedRequests.length} demande(s) enregistrée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date planifiée</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date souhaitée</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Traitement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{formatDisplayDate(request.date_planning)}</TableCell>
                  <TableCell>{getPlanningRequestTypeLabel(request.type_demande)}</TableCell>
                  <TableCell>{formatDisplayDate(request.date_souhaitee)}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal">
                    {request.motif || 'Aucun motif précisé'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getRequestStatusBadgeClass(request.statut)}>{request.statut}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal text-xs text-muted-foreground">
                    {request.commentaire_traitement || 'En attente de traitement'}
                    <div>{formatDisplayDateTime(request.date_traitement)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-lg glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-primary">Demander une modification</DialogTitle>
            <DialogDescription>
              {selectedPlanningEntry
                ? `Planning du ${format(parseISO(selectedPlanningEntry.date), 'eeee dd MMMM yyyy', { locale: fr })}`
                : 'Demande de modification'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type de demande</Label>
              <Select
                value={requestForm.type_demande}
                onValueChange={(value) =>
                  setRequestForm((prev) => ({
                    ...prev,
                    type_demande: value,
                    date_souhaitee:
                      value === PLANNING_REQUEST_TYPES.UNAVAILABILITY ? '' : prev.date_souhaitee,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PLANNING_REQUEST_TYPES.UNAVAILABILITY}>Indisponibilité</SelectItem>
                  <SelectItem value={PLANNING_REQUEST_TYPES.DATE_CHANGE}>Changement de date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {requestForm.type_demande === PLANNING_REQUEST_TYPES.DATE_CHANGE ? (
              <div className="space-y-2">
                <Label htmlFor="date-souhaitee-planning">Nouvelle date souhaitée</Label>
                <Input
                  id="date-souhaitee-planning"
                  type="date"
                  value={requestForm.date_souhaitee}
                  min={todayDate}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, date_souhaitee: event.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="motif-planning">Motif</Label>
              <Textarea
                id="motif-planning"
                value={requestForm.motif}
                onChange={(event) =>
                  setRequestForm((prev) => ({ ...prev, motif: event.target.value }))
                }
                placeholder="Expliquez votre demande de modification..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleSubmitRequest} disabled={isLoading}>
              {isLoading ? 'Envoi...' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MonPlanningGuichetierePage;
