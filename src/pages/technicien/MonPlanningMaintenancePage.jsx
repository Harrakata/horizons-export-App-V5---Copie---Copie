import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePageState } from '@/hooks/usePageState';
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
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  HelpCircle,
  Package,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import PiecesSousEnsemblesTab from '@/pages/maintenance/PiecesSousEnsemblesTab';
import StockDefectueuxTab from '@/pages/maintenance/StockDefectueuxTab';
import ReparationTerminauxTab from '@/pages/maintenance/ReparationTerminauxTab';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { supabase } from '@/lib/supabaseClient';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/guichetiereSpace';
import { APP_SPACE_TAB_SETTINGS_KEY, isAppSpaceUserTabAllowed, normalizeAppSpaceTabFunctionalities } from '@/lib/exploitationProfiles';
import {
  getMaintenancePlanningShiftLabel,
  getMaintenanceShiftFromDateTime,
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

const SOUS_ENSEMBLE_LABELS_TECH = {
  imprimante: 'Imprimante',
  lecteur: 'Lecteur',
  ecran: 'Écran',
  afficheur: 'Afficheur client',
  buc: 'BUC',
  carrosserie: 'Carrosserie',
};

const STATUT_CONFIG_TECH = {
  defectueux: { label: 'Défectueux', cls: 'bg-red-100 text-red-800' },
  assigne: { label: 'Assigné', cls: 'bg-blue-100 text-blue-800' },
  a_tester: { label: 'À tester', cls: 'bg-yellow-100 text-yellow-800' },
  repare: { label: 'Réparé', cls: 'bg-green-100 text-green-800' },
};

const MonPlanningMaintenancePage = ({ technicien, view, hideTitle = false }) => {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = usePageState('planning-maintenance', 'viewMode', 'month');

  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}'));
    } catch { return normalizeAppSpaceTabFunctionalities({}); }
  });
  useEffect(() => {
    const handler = (e) => setSpaceTabFunctionalities(normalizeAppSpaceTabFunctionalities(e.detail || {}));
    window.addEventListener('app-space-tabs-updated', handler);
    return () => window.removeEventListener('app-space-tabs-updated', handler);
  }, []);
  const tabEnabled = (key) =>
    spaceTabFunctionalities?.['espace-technicien']?.[key] !== false
    && isAppSpaceUserTabAllowed(technicien?.appSpaceProfile, key);
  const [planningEntries, setPlanningEntries] = useState([]);
  const [performedInterventions, setPerformedInterventions] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [ficheDialog, setFicheDialog] = useState({ open: false, html: '', loading: false });
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestTableMissing, setIsRequestTableMissing] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedPlanningEntry, setSelectedPlanningEntry] = useState(null);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);
  const [assignedDefectueux, setAssignedDefectueux] = useState([]);
  const [expandedDefectueuxId, setExpandedDefectueuxId] = useState(null);
  const [defectueuxPieces, setDefectueuxPieces] = useState([]);
  const [defectueuxPannes, setDefectueuxPannes] = useState([]);
  const [defectueuxProcedures, setDefectueuxProcedures] = useState([]);

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

    // Charger les sous-ensembles défectueux assignés à ce technicien
    if (technicien?.id) {
      const { data: defData } = await supabase
        .from('stock_defectueux')
        .select('*, agence:agences(nom)')
        .eq('technicien_id', String(technicien.id))
        .neq('statut', 'repare')
        .order('date_entree', { ascending: false });
      setAssignedDefectueux(defData || []);
    }

    // Interventions effectuées par le technicien ce mois (statut Validée / Refusée)
    try {
      // On récupère toutes les interventions du technicien puis on filtre par mois
      // côté client sur une DATE EFFECTIVE (date_fin, sinon date_intervention, sinon created_at),
      // car certaines interventions n'ont pas de date_fin → elles seraient sinon invisibles.
      const { data: ivData } = await supabase
        .from('interventions_maintenance')
        .select('id, terminal_id, sous_ensemble, type_intervention, description_panne, commentaire, date_intervention, date_fin, created_at, fiche_url, geo_refused, geo_verified, geo_distance_m, geo_justification')
        .eq('technicien_id', String(technicien.id))
        .order('date_fin', { ascending: false })
        .limit(1000);
      const effectiveDate = (i) => i.date_fin || i.date_intervention || i.created_at || null;
      const monthStartTime = monthStart.getTime();
      const monthEndTime = monthEnd.getTime() + 24 * 60 * 60 * 1000; // inclut tout le dernier jour
      const ivs = (ivData || []).filter((i) => {
        const d = effectiveDate(i);
        if (!d) return false;
        const t = new Date(d).getTime();
        return Number.isFinite(t) && t >= monthStartTime && t < monthEndTime;
      });
      const termMap = {};
      const agMap = {};
      const termIds = [...new Set(ivs.map((i) => i.terminal_id).filter(Boolean))];
      if (termIds.length) {
        const { data: termData } = await supabase.from('terminaux').select('id, reference, agence_id').in('id', termIds);
        (termData || []).forEach((t) => { termMap[t.id] = t; });
        const agIds = [...new Set((termData || []).map((t) => t.agence_id).filter(Boolean))];
        if (agIds.length) {
          const { data: agData } = await supabase.from('agences').select('id, nom').in('id', agIds);
          (agData || []).forEach((a) => { agMap[a.id] = a.nom; });
        }
      }
      setPerformedInterventions(ivs.map((i) => {
        const term = termMap[i.terminal_id];
        return {
          ...i,
          terminalRef: term?.reference || '—',
          agenceNom: (term && agMap[term.agence_id]) || 'Agence',
          effectiveDate: effectiveDate(i),
        };
      }));
    } catch {
      setPerformedInterventions([]);
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

  // Interventions réalisées regroupées par jour PUIS par agence (clé = date locale)
  const performedByDate = useMemo(() => {
    const byDate = {};
    performedInterventions.forEach((iv) => {
      const d = iv.effectiveDate || iv.date_fin;
      if (!d) return;
      const dateKey = format(new Date(d), 'yyyy-MM-dd');
      const agKey = iv.agenceNom || 'Agence';
      if (!byDate[dateKey]) byDate[dateKey] = {};
      if (!byDate[dateKey][agKey]) byDate[dateKey][agKey] = { agenceNom: agKey, dateKey, interventions: [] };
      byDate[dateKey][agKey].interventions.push(iv);
    });
    return Object.fromEntries(
      Object.entries(byDate).map(([k, byAg]) => [k, Object.values(byAg).sort((a, b) => a.agenceNom.localeCompare(b.agenceNom, 'fr'))])
    );
  }, [performedInterventions]);

  // Ouvre la fiche de validation en la rendant comme HTML, quel que soit le
  // type MIME avec lequel elle a été stockée (anciennes fiches servies en texte brut).
  const openFiche = useCallback(async (url) => {
    if (!url) return;
    setFicheDialog({ open: true, html: '', loading: true });
    try {
      const res = await fetch(url);
      const html = await res.text();
      setFicheDialog({ open: true, html, loading: false });
    } catch {
      setFicheDialog({ open: false, html: '', loading: false });
      window.open(url, '_blank', 'noreferrer');
    }
  }, []);

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
        title: "Erreur d’envoi",
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

  const toggleDefectueux = async (item) => {
    if (expandedDefectueuxId === item.id) {
      setExpandedDefectueuxId(null);
      return;
    }
    setExpandedDefectueuxId(item.id);
    setDefectueuxPieces([]);
    setDefectueuxPannes([]);
    setDefectueuxProcedures([]);
    if (item.modele_id) {
      const { data: mpData } = await supabase
        .from('modeles_pieces')
        .select('*, piece:pieces_sous_ensembles(id, nom, reference, description_aide)')
        .eq('modele_id', item.modele_id);
      setDefectueuxPieces(mpData || []);
      if (mpData && mpData.length > 0) {
        const pieceIds = mpData.map(mp => mp.piece?.id).filter(Boolean);
        const [pnRes, prRes] = await Promise.all([
          supabase.from('pieces_pannes').select('*, piece_id').in('piece_id', pieceIds),
          supabase.from('pieces_procedures').select('*, piece_id').in('piece_id', pieceIds).order('ordre'),
        ]);
        if (!pnRes.error) setDefectueuxPannes(pnRes.data || []);
        if (!prRes.error) setDefectueuxProcedures(prRes.data || []);
      }
    }
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
      {!hideTitle && (
        <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader>
            <CardTitle className="flex items-center text-3xl font-bold text-primary">
              {view === 'reparation' ? (
                <><Wrench className="mr-3 h-8 w-8" />Réparation</>
              ) : (
                <><CalendarDays className="mr-3 h-8 w-8" />Mon Planning de Maintenance</>
              )}
            </CardTitle>
            <CardDescription>
              {view === 'reparation'
                ? 'Gérez les réparations et consultez le catalogue de pièces.'
                : 'Consultez vos affectations maintenance et gérez votre planning.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {(() => {
        const showPlanning   = tabEnabled('planning.mon-planning');
        const showReparation = tabEnabled('planning.reparation');
        const visibleMain    = [showPlanning, showReparation].filter(Boolean).length;
        const gridMain       = visibleMain === 1 ? 'grid-cols-1' : 'grid-cols-2';
        const showAtelier    = tabEnabled('planning.reparation.atelier');
        const showStock      = tabEnabled('planning.reparation.stock-defectueux');
        const showPieces     = tabEnabled('planning.reparation.pieces-detachees');
        const visibleSub     = [showAtelier, showStock, showPieces].filter(Boolean).length;
        const gridSub        = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[visibleSub] || 'grid-cols-3';
        const defaultMain    = showPlanning ? 'planning' : showReparation ? 'reparation' : 'planning';
        const defaultSub     = showAtelier ? 'atelier' : showStock ? 'stock_defectueux' : showPieces ? 'pieces' : 'atelier';
        return (
      <Tabs value={view || defaultMain} className="space-y-6">
        {!view && visibleMain > 0 && (
          <TabsList className={`grid w-full ${gridMain}`}>
            {showPlanning && (
              <TabsTrigger value="planning" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Mon Planning
              </TabsTrigger>
            )}
            {showReparation && (
              <TabsTrigger value="reparation" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Réparation
              </TabsTrigger>
            )}
          </TabsList>
        )}

        <TabsContent value="planning" className="space-y-6">

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

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
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

      {/* Sous-ensembles défectueux assignés */}
      {assignedDefectueux.length > 0 && (
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <Package className="h-5 w-5" />
              Mes sous-ensembles à réparer
              <Badge className="bg-blue-100 text-blue-800 ml-2">{assignedDefectueux.length}</Badge>
            </CardTitle>
            <CardDescription>Sous-ensembles défectueux qui vous sont assignés pour réparation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignedDefectueux.map(item => {
              const isExpanded = expandedDefectueuxId === item.id;
              const cfg = STATUT_CONFIG_TECH[item.statut] || { label: item.statut, cls: 'bg-gray-100 text-gray-800' };
              return (
                <div key={item.id} className="rounded-lg border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    onClick={() => toggleDefectueux(item)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium font-mono text-sm">{item.reference_sous_ensemble}</span>
                      <Badge variant="outline">{SOUS_ENSEMBLE_LABELS_TECH[item.type_sous_ensemble] || item.type_sous_ensemble}</Badge>
                      <Badge className={cfg.cls}>{cfg.label}</Badge>
                      {item.agence?.nom && <span className="text-xs text-muted-foreground">• {item.agence.nom}</span>}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4 space-y-4">
                      {item.commentaire && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          <AlertTriangle className="inline h-4 w-4 mr-1" /> {item.commentaire}
                        </div>
                      )}
                      {defectueuxPieces.length === 0 && (
                        <p className="text-sm text-muted-foreground">Aucun modèle de pièces associé à ce sous-ensemble.</p>
                      )}
                      {defectueuxPieces.map(mp => {
                        const pPannes = defectueuxPannes.filter(p => p.piece_id === mp.piece?.id);
                        const pProcs = defectueuxProcedures.filter(p => p.piece_id === mp.piece?.id);
                        return (
                          <div key={mp.id} className="rounded-md border bg-background p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <HelpCircle className="h-4 w-4 text-primary" />
                              <span className="font-medium">{mp.piece?.nom}</span>
                              <span className="text-xs text-muted-foreground font-mono">({mp.piece?.reference})</span>
                            </div>
                            {mp.piece?.description_aide && (
                              <p className="text-sm text-muted-foreground bg-muted/40 rounded px-2 py-1">{mp.piece.description_aide}</p>
                            )}
                            {pPannes.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Types de pannes
                                </p>
                                {pPannes.map(p => (
                                  <p key={p.id} className="text-xs rounded border border-amber-200 bg-amber-50 px-2 py-1 mb-1">{p.description}</p>
                                ))}
                              </div>
                            )}
                            {pProcs.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-primary mb-1">Procédure de réparation</p>
                                {pProcs.map((p, i) => (
                                  <div key={p.id} className="text-xs border rounded p-2 mb-1 space-y-1">
                                    <span className="font-medium">Étape {i + 1} :</span> {p.description}
                                    {p.image_url && <img src={p.image_url} alt={`étape ${i + 1}`} className="max-h-32 rounded object-contain mt-1" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative px-3 pb-0 pt-3 sm:px-6 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary sm:text-xl">
            <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
            Calendrier de maintenance
          </CardTitle>
          <CardDescription className="hidden sm:block">
            Naviguez par mois ou par semaine. Cliquez sur une intervention planifiée pour envoyer une demande de modification.
          </CardDescription>
        </CardHeader>
        {/* Barre de contrôle unifiée */}
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Button
              variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => setCurrentMonth((prev) => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1))}
              disabled={isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[84px] text-center text-xs font-semibold capitalize text-foreground whitespace-nowrap sm:min-w-[120px] sm:text-sm">
              {format(currentMonth, viewMode === 'month' ? 'MMMM yyyy' : "'Sem.' dd MMM", { locale: fr })}
            </span>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => setCurrentMonth((prev) => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))}
              disabled={isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="sm" className="h-7 px-2 text-[0.7rem] sm:px-2.5 sm:text-xs"
              onClick={() => setCurrentMonth(new Date())}
              disabled={isLoading}
            >
              Auj.
            </Button>
            {/* Sélecteur de date masqué sur mobile (redondant avec les flèches) */}
            <input
              type="date"
              disabled={isLoading}
              value={format(currentMonth, 'yyyy-MM-dd')}
              onChange={(e) => { if (e.target.value) setCurrentMonth(parseISO(e.target.value)); }}
              className="hidden h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:block"
              title="Aller à une date"
            />
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            <Button size="sm" variant={viewMode === 'month' ? 'default' : 'ghost'} className="h-7 px-2.5 text-xs sm:px-3" onClick={() => setViewMode('month')} disabled={isLoading}>Mois</Button>
            <Button size="sm" variant={viewMode === 'week' ? 'default' : 'ghost'} className="h-7 px-2.5 text-xs sm:px-3" onClick={() => setViewMode('week')} disabled={isLoading}>Semaine</Button>
          </div>
        </div>
        <CardContent className="relative p-2 md:p-4">
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
                  <div key={i} className="py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                    {dayName}
                  </div>
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
                  const requestCount = dayPlanning.reduce((count, entry) => {
                    const linkedRequest = requestByPlanningId[String(entry.id)];
                    return linkedRequest ? count + 1 : count;
                  }, 0);

                  return (
                    <div
                      key={dateStr}
                      className={`group flex min-h-[90px] flex-col
                        ${viewMode === 'month' && dayIdx === 0 ? colStartClasses : ''}
                        ${!isCurrentMonthDay ? 'bg-muted/10' : isWeekend ? 'bg-slate-50/40' : 'bg-card'}
                      `}
                    >
                      {/* Header compact */}
                      <div className={`flex items-center justify-between px-1.5 py-1 ${isToday ? 'bg-primary text-white' : isWeekend && isCurrentMonthDay ? 'bg-muted/20' : ''}`}>
                        <time dateTime={dateStr} className={`text-xs font-bold ${isToday ? 'text-white' : !isCurrentMonthDay ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </time>
                        {requestCount > 0 && (
                          <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${isToday ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                            {requestCount}
                          </span>
                        )}
                      </div>
                      {/* Corps compact */}
                      <div className="flex-1 space-y-0.5 px-1.5 py-1">
                        <AnimatePresence>
                          {dayPlanning.map((entry) => {
                            const linkedRequest = requestByPlanningId[String(entry.id)];
                            const isPast = isPastPlanningDate(entry.date_planification);
                            const isPending =
                              linkedRequest?.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_CHEF ||
                              linkedRequest?.statut === MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION;

                            return (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70"
                                onClick={() => !isPending && !isPast && openRequestDialog(entry)}
                              >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] font-bold text-white
                                  ${isPast ? 'bg-muted-foreground/40' : isToday ? 'bg-white/90 !text-primary' : 'bg-primary'}
                                `}>
                                  <Wrench className="h-2.5 w-2.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate text-[0.6rem] font-medium leading-tight ${!isCurrentMonthDay ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                                    {entry.agence_nom || 'Agence'}
                                  </p>
                                  <p className="text-[0.55rem] leading-tight text-muted-foreground/70">
                                    {getMaintenancePlanningShiftLabel(entry.creneau)}
                                  </p>
                                </div>
                                {linkedRequest && <span className="ml-auto shrink-0 text-[0.5rem] text-amber-600">!</span>}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        {/* Interventions réalisées ce jour, regroupées par agence */}
                        {(performedByDate[dateStr] || []).map((grp) => {
                          const realizedCount = grp.interventions.filter((i) => i.geo_refused !== true).length;
                          const refusedCount = grp.interventions.length - realizedCount;
                          const hasRealized = realizedCount > 0;
                          return (
                            <div
                              key={`grp-${grp.agenceNom}`}
                              className="flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70"
                              onClick={() => setSelectedGroup(grp)}
                            >
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${hasRealized ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-[0.6rem] font-medium leading-tight ${!isCurrentMonthDay ? 'text-muted-foreground/40' : 'text-foreground'}`}>{grp.agenceNom}</p>
                                <p className="truncate text-[0.55rem] font-semibold leading-tight text-emerald-600">
                                  {realizedCount} réalisée(s)
                                  {refusedCount ? <span className="text-red-600"> · {refusedCount} refusée(s)</span> : null}
                                </p>
                              </div>
                            </div>
                          );
                        })}
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
          <CardTitle className="text-2xl text-primary">Mes interventions effectuées</CardTitle>
          <CardDescription>Interventions réalisées ce mois et leur statut de contrôle (présence sur site).</CardDescription>
        </CardHeader>
        <CardContent>
          {performedInterventions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune intervention effectuée ce mois.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Sous-ensemble</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performedInterventions.map((iv) => (
                    <TableRow key={iv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedGroup({ agenceNom: iv.agenceNom, dateKey: (iv.effectiveDate || iv.date_fin) ? format(new Date(iv.effectiveDate || iv.date_fin), 'yyyy-MM-dd') : '', interventions: [iv] })}>
                      <TableCell className="whitespace-nowrap">{(iv.effectiveDate || iv.date_fin) ? format(new Date(iv.effectiveDate || iv.date_fin), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell className="font-medium">{iv.terminalRef}</TableCell>
                      <TableCell>{iv.sous_ensemble || '—'}</TableCell>
                      <TableCell>{iv.type_intervention === 'curative' ? 'Curative' : 'Préventive'}</TableCell>
                      <TableCell>
                        {iv.geo_refused === true ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Refusée</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Validée</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

      <Dialog open={!!selectedGroup} onOpenChange={(o) => { if (!o) setSelectedGroup(null); }}>
        <DialogContent className="sm:max-w-lg glassmorphism max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">Interventions réalisées</DialogTitle>
            <DialogDescription>
              {selectedGroup
                ? `${selectedGroup.agenceNom} • ${selectedGroup.dateKey ? format(new Date(selectedGroup.dateKey), 'dd/MM/yyyy') : ''} • ${selectedGroup.interventions.length} intervention(s)`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(selectedGroup?.interventions || []).map((iv) => {
              const isCurative = iv.type_intervention === 'curative';
              const dt = iv.effectiveDate || iv.date_fin;
              const creneauLabel = getMaintenancePlanningShiftLabel(getMaintenanceShiftFromDateTime(dt));
              return (
                <div key={iv.id} className={`space-y-2 rounded-xl border p-4 shadow-sm ${isCurative ? 'border-red-100 bg-red-50/40' : 'border-blue-100 bg-blue-50/40'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{iv.terminalRef}</p>
                    <span className="text-sm text-muted-foreground">{dt ? format(new Date(dt), 'dd/MM/yyyy HH:mm') : '—'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={isCurative ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}>
                      {isCurative ? 'Curative' : 'Préventive'}
                    </Badge>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{creneauLabel}</Badge>
                    {iv.geo_refused ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Refusée (hors zone)</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Validée</Badge>
                    )}
                    {iv.sous_ensemble && (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">{iv.sous_ensemble}</Badge>
                    )}
                  </div>
                  {iv.description_panne && <p className="text-sm text-muted-foreground">{iv.description_panne}</p>}
                  {iv.commentaire && <p className="border-t pt-2 text-sm italic text-slate-700">{iv.commentaire}</p>}
                  {iv.geo_refused && (Number.isFinite(Number(iv.geo_distance_m)) || iv.geo_justification) && (
                    <p className="text-xs text-red-700">Hors zone{Number.isFinite(Number(iv.geo_distance_m)) ? ` · ${iv.geo_distance_m} m de l'agence` : ''}{iv.geo_justification ? ` — ${iv.geo_justification}` : ''}</p>
                  )}
                  {iv.fiche_url && (
                    <div className="border-t pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openFiche(iv.fiche_url)} className="gap-2">
                        <FileText className="h-4 w-4" /> Voir la fiche d&apos;intervention
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedGroup(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ficheDialog.open} onOpenChange={(open) => !open && setFicheDialog({ open: false, html: '', loading: false })}>
        <DialogContent className="flex h-[90vh] w-full max-w-4xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Fiche d&apos;intervention
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {ficheDialog.loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement de la fiche...</div>
            ) : (
              <iframe
                srcDoc={ficheDialog.html}
                className="h-full w-full border-0"
                title="Fiche d'intervention"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="reparation">
          <Tabs defaultValue={defaultSub} className="space-y-4">
            {visibleSub > 0 && (
              <TabsList className={`grid w-full ${gridSub}`}>
                {showAtelier && <TabsTrigger value="atelier">Atelier</TabsTrigger>}
                {showStock   && <TabsTrigger value="stock_defectueux">Stock Défectueux</TabsTrigger>}
                {showPieces  && <TabsTrigger value="pieces">Pièces détachées</TabsTrigger>}
              </TabsList>
            )}
            {showAtelier && (
              <TabsContent value="atelier">
                <ReparationTerminauxTab canManage={true} />
              </TabsContent>
            )}
            {showStock && (
              <TabsContent value="stock_defectueux">
                <StockDefectueuxTab canManage={false} technicienId={technicien?.id} />
              </TabsContent>
            )}
            {showPieces && (
              <TabsContent value="pieces">
                <PiecesSousEnsemblesTab canManage={false} />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>
      </Tabs>
        );
      })()}
    </motion.div>
  );
};

export default MonPlanningMaintenancePage;
