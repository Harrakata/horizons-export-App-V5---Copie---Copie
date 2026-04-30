import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { supabase } from '@/lib/supabaseClient';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/guichetiereSpace';
import {
  getMaintenancePlanningShiftLabel,
} from '@/lib/maintenancePlanning';
import {
  isMissingMaintenancePlanningRequestTableError,
  MAINTENANCE_REQUEST_STATUSES,
  MAINTENANCE_REQUEST_TYPES,
  getMaintenancePlanningRequestStatusBadgeClass,
  getMaintenancePlanningRequestTypeLabel,
} from '@/lib/maintenancePlanningRequests';

const defaultRequestForm = {
  type_demande: MAINTENANCE_REQUEST_TYPES.UNAVAILABILITY,
  date_souhaitee: '',
  motif: '',
};

const MonPlanningMaintenancePage = ({ technicien }) => {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [planningEntries, setPlanningEntries] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestTableMissing, setIsRequestTableMissing] = useState(false);
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
    if (!technicien?.id) return;

    setIsLoading(true);

    const [{ data: planningData, error: planningError }, { data: requestsData, error: requestsError }] =
      await Promise.all([
        supabase
          .from('planning_maintenance')
          .select('*')
          .eq('technicien_id', String(technicien.id))
          .neq('statut', 'annulee')
          .gte('date_planification', format(monthStart, 'yyyy-MM-dd'))
          .lte('date_planification', format(monthEnd, 'yyyy-MM-dd'))
          .order('date_planification', { ascending: true })
          .order('creneau', { ascending: true }),
        supabase
          .from('planning_maintenance_modification_requests')
          .select('*')
          .eq('technicien_matricule', technicien.matricule)
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
      if (!isMissingMaintenancePlanningRequestTableError(requestsError)) {
        toast({
          title: 'Erreur de chargement des demandes',
          description: requestsError.message,
          variant: 'destructive',
        });
      }
      setIsRequestTableMissing(isMissingMaintenancePlanningRequestTableError(requestsError));
      setRequests([]);
    } else {
      setIsRequestTableMissing(false);
      setRequests(requestsData || []);
    }

    setIsLoading(false);
  }, [monthEnd, monthStart, technicien?.id, technicien?.matricule, toast]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  const planningByDate = useMemo(
    () =>
      planningEntries.reduce((accumulator, entry) => {
        if (!accumulator[entry.date_planification]) {
          accumulator[entry.date_planification] = [];
        }
        accumulator[entry.date_planification].push(entry);
        return accumulator;
      }, {}),
    [planningEntries]
  );

  const requestByPlanningId = useMemo(
    () =>
      requests.reduce((accumulator, request) => {
        if (!accumulator[String(request.planning_maintenance_id)]) {
          accumulator[String(request.planning_maintenance_id)] = request;
        }
        return accumulator;
      }, {}),
    [requests]
  );

  const monthPlanningCount = planningEntries.filter((entry) => entry.statut !== 'annulee').length;
  const pendingRequestsCount = requests.filter(
    (request) =>
      request.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF ||
      request.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION
  ).length;
  const isPastPlanningDate = useCallback(
    (dateValue) => Boolean(dateValue) && String(dateValue) < todayDate,
    [todayDate]
  );

  const openRequestDialog = (planningEntry) => {
    if (isPastPlanningDate(planningEntry?.date_planification)) {
      toast({
        title: 'Modification impossible',
        description: 'Vous ne pouvez pas demander une modification sur une maintenance déjà passée.',
        variant: 'destructive',
      });
      return;
    }

    const currentRequest = requestByPlanningId[String(planningEntry.id)];
    if (
      currentRequest?.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF ||
      currentRequest?.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION
    ) {
      toast({
        title: 'Demande déjà envoyée',
        description: 'Une demande en attente existe déjà pour cette planification.',
      });
      return;
    }

    setSelectedPlanningEntry(planningEntry);
    setRequestForm(defaultRequestForm);
    setIsRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPlanningEntry || !technicien) return;

    if (isPastPlanningDate(selectedPlanningEntry.date_planification)) {
      toast({
        title: 'Date dépassée',
        description: 'Cette maintenance est déjà passée et ne peut plus être modifiée.',
        variant: 'destructive',
      });
      return;
    }

    if (
      requestForm.type_demande === MAINTENANCE_REQUEST_TYPES.DATE_CHANGE &&
      !requestForm.date_souhaitee
    ) {
      toast({
        title: 'Date requise',
        description: 'Veuillez renseigner la nouvelle date souhaitée.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const payload = {
      planning_maintenance_id: String(selectedPlanningEntry.id),
      technicien_id: String(technicien.id),
      technicien_matricule: technicien.matricule,
      technicien_nom: [technicien.prenom, technicien.nom].filter(Boolean).join(' ').trim(),
      agence_id: selectedPlanningEntry.agence_id ? String(selectedPlanningEntry.agence_id) : null,
      agence_nom: selectedPlanningEntry.agence_nom,
      region: selectedPlanningEntry.region || null,
      date_planification: selectedPlanningEntry.date_planification,
      creneau: selectedPlanningEntry.creneau,
      type_demande: requestForm.type_demande,
      date_souhaitee:
        requestForm.type_demande === MAINTENANCE_REQUEST_TYPES.DATE_CHANGE
          ? requestForm.date_souhaitee
          : null,
      motif: requestForm.motif?.trim() || null,
      statut: MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF,
    };

    const { error } = await supabase.from('planning_maintenance_modification_requests').insert(payload);

    if (error) {
      if (isMissingMaintenancePlanningRequestTableError(error)) {
        toast({
          title: 'Table Supabase manquante',
          description:
            "La table 'planning_maintenance_modification_requests' n'existe pas encore dans Supabase. Exécutez d'abord le SQL de création puis rechargez la page.",
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
        description:
          "Votre demande de modification a bien été transmise au chef d'agence puis à l'Exploitation pour validation.",
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
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <CalendarDays className="mr-3 h-8 w-8" />
            Mon planning de Maintenance
          </CardTitle>
          <CardDescription>
            Consultez vos affectations maintenance et envoyez vos demandes de modification pour validation
            par le chef d&apos;agence puis l&apos;Exploitation.
          </CardDescription>
        </CardHeader>
      </Card>

      {isRequestTableMissing && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">
              Les demandes de modification nécessitent la table Supabase
              {' '}
              <code>planning_maintenance_modification_requests</code>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiStatCard
          icon={Wrench}
          label="Maintenances planifiées"
          value={monthPlanningCount}
          helper="Interventions maintenance prévues sur la période affichée."
          tone="primary"
        />
        <KpiStatCard
          icon={AlertTriangle}
          label="Demandes en attente"
          value={pendingRequestsCount}
          helper="Demandes de modification encore en cours de validation."
          tone="amber"
        />
        <KpiStatCard
          icon={Edit3}
          label="Historique des demandes"
          value={requests.length}
          helper="Nombre total de demandes de modification enregistrées."
          tone="blue"
        />
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Calendrier</CardTitle>
              <CardDescription>{technicien?.matricule || 'Technicien connecté'}</CardDescription>
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
                    isSameDay(day, new Date()) ? 'z-10 ring-2 ring-primary' : ''
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
                              <p className="font-semibold">{entry.agence_nom || 'Agence'}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {getMaintenancePlanningShiftLabel(entry.creneau)}
                              </p>
                              {linkedRequest ? (
                                <Badge className={`mt-1 ${getMaintenancePlanningRequestStatusBadgeClass(linkedRequest.statut)}`}>
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
                                linkedRequest?.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF ||
                                linkedRequest?.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION ||
                                isPastPlanningDate(entry.date_planification) ||
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
          <CardDescription>
            Suivez le traitement de vos demandes par le chef d’agence puis l’Exploitation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {sortedRequests.length === 0
                ? 'Aucune demande de modification envoyée.'
                : `${sortedRequests.length} demande(s) affichée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date planifiée</TableHead>
                <TableHead>Créneau</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date souhaitée</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière mise à jour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{formatDisplayDate(request.date_planification)}</TableCell>
                  <TableCell>{getMaintenancePlanningShiftLabel(request.creneau)}</TableCell>
                  <TableCell>{request.agence_nom || 'N/A'}</TableCell>
                  <TableCell>{getMaintenancePlanningRequestTypeLabel(request.type_demande)}</TableCell>
                  <TableCell>{formatDisplayDate(request.date_souhaitee)}</TableCell>
                  <TableCell>
                    <Badge className={getMaintenancePlanningRequestStatusBadgeClass(request.statut)}>
                      {request.statut}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDisplayDateTime(request.updated_at || request.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-xl glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-2xl text-primary">Demander une modification</DialogTitle>
            <DialogDescription>
              Planning du {selectedPlanningEntry ? formatDisplayDate(selectedPlanningEntry.date_planification) : 'N/A'}
              {selectedPlanningEntry ? ` • ${getMaintenancePlanningShiftLabel(selectedPlanningEntry.creneau)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type de demande</Label>
              <Select
                value={requestForm.type_demande}
                onValueChange={(value) =>
                  setRequestForm((previousState) => ({
                    ...previousState,
                    type_demande: value,
                    date_souhaitee:
                      value === MAINTENANCE_REQUEST_TYPES.DATE_CHANGE
                        ? previousState.date_souhaitee
                        : '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type de demande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAINTENANCE_REQUEST_TYPES.UNAVAILABILITY}>Indisponibilité</SelectItem>
                  <SelectItem value={MAINTENANCE_REQUEST_TYPES.DATE_CHANGE}>Changement de date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {requestForm.type_demande === MAINTENANCE_REQUEST_TYPES.DATE_CHANGE && (
              <div className="space-y-2">
                <Label>Nouvelle date souhaitée</Label>
                <Input
                  type="date"
                  value={requestForm.date_souhaitee}
                  min={todayDate}
                  onChange={(event) =>
                    setRequestForm((previousState) => ({
                      ...previousState,
                      date_souhaitee: event.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Motif</Label>
              <Textarea
                rows={4}
                value={requestForm.motif}
                onChange={(event) =>
                  setRequestForm((previousState) => ({
                    ...previousState,
                    motif: event.target.value,
                  }))
                }
                placeholder="Décrivez le motif de votre demande."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSubmitRequest} disabled={isLoading}>
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MonPlanningMaintenancePage;
