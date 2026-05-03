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
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
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
  const [viewMode, setViewMode] = useState('month');
  const [planningEntries, setPlanningEntries] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedPlanningEntry, setSelectedPlanningEntry] = useState(null);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const todayDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const days = useMemo(() => {
    const start = viewMode === 'month' ? monthStart : startOfWeek(currentMonth, { weekStartsOn: 1 });
    const end = viewMode === 'month' ? monthEnd : endOfWeek(currentMonth, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth, viewMode, monthStart, monthEnd]);

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

      <Card className="shadow-sm">
        {/* Barre de contrôle unifiée */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((prev) => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1))} disabled={isLoading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-semibold text-foreground whitespace-nowrap">
              {format(currentMonth, viewMode === 'month' ? 'MMMM yyyy' : "'Sem.' dd MMM", { locale: fr })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((prev) => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))} disabled={isLoading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setCurrentMonth(new Date())} disabled={isLoading}>
              Aujourd'hui
            </Button>
            <input
              type="date"
              disabled={isLoading}
              value={format(currentMonth, 'yyyy-MM-dd')}
              onChange={(e) => { if (e.target.value) setCurrentMonth(parseISO(e.target.value)); }}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              title="Aller à une date"
            />
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            <Button size="sm" variant={viewMode === 'month' ? 'default' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setViewMode('month')} disabled={isLoading}>Mois</Button>
            <Button size="sm" variant={viewMode === 'week' ? 'default' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setViewMode('week')} disabled={isLoading}>Semaine</Button>
          </div>
        </div>
        <CardContent className="p-2 md:p-4">
          {isLoading && planningEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement du planning...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border shadow-sm">
              {/* En-tête jours */}
              <div className="grid grid-cols-7 bg-muted/60">
                {(viewMode === 'week'
                  ? days.map((d) => format(d, 'EEE', { locale: fr }))
                  : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
                ).map((dayName, i) => (
                  <div key={i} className="py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{dayName}</div>
                ))}
              </div>
              {/* Grille unifiée mois + semaine */}
              <div className="grid grid-cols-7 divide-x divide-y divide-border">
                {days.map((day, dayIdx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayPlanning = planningByDate[dateStr] || [];
                  const isCurrentMonthDay = viewMode === 'month' ? isSameMonth(day, currentMonth) : true;
                  const isToday = isSameDay(day, new Date());
                  const isWeekend = [0, 6].includes(getDay(day));

                  return (
                    <div
                      key={dateStr}
                      className={`group flex min-h-[90px] flex-col
                        ${viewMode === 'month' && dayIdx === 0 ? colStartClasses : ''}
                        ${!isCurrentMonthDay ? 'bg-muted/10' : isWeekend ? 'bg-slate-50/40' : 'bg-card'}
                      `}
                    >
                      {/* Header compact */}
                      <div className={`flex items-center px-1.5 py-1 ${isToday ? 'bg-primary text-white' : !isCurrentMonthDay ? '' : isWeekend ? 'bg-muted/20' : ''}`}>
                        <time dateTime={dateStr} className={`text-xs font-bold ${isToday ? 'text-white' : !isCurrentMonthDay ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </time>
                      </div>
                      {/* Corps compact */}
                      <div className="flex-1 space-y-0.5 px-1.5 py-1">
                        <AnimatePresence>
                          {dayPlanning.map((entry) => {
                            const linkedRequest = requestByPlanningId[String(entry.id)];
                            const isPast = isPastPlanningDate(entry.date);
                            return (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={`flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70 ${isPast ? 'opacity-50' : ''}`}
                                onClick={() => openRequestDialog(entry)}
                              >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] font-bold text-white
                                  ${linkedRequest?.statut === REQUEST_STATUS.PENDING ? 'bg-amber-400' : isToday ? 'bg-white/90 !text-primary' : 'bg-primary'}
                                `}>
                                  {linkedRequest?.statut === REQUEST_STATUS.PENDING ? '!' : '✓'}
                                </span>
                                <span className={`truncate text-[0.6rem] font-medium leading-tight ${!isCurrentMonthDay ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                                  {entry.agenceNom || nomAgence}
                                </span>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
