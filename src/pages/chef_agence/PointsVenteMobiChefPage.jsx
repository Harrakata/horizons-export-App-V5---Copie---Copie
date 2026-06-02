import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePageState } from '@/hooks/usePageState';
import { motion } from 'framer-motion';
import {
  Building,
  Building2,
  CalendarDays,
  Edit,
  History,
  MapPin,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  User,
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
import {
  REQUEST_STATUS,
  formatDisplayDateTime,
  getRequestStatusBadgeClass,
  isMissingSupabaseTableError,
  isSupabaseAuthError,
} from '@/lib/guichetiereSpace';
import { buildRegionOptions, fetchRegions } from '@/lib/regions';

const defaultRequestForm = {
  requested_region: '',
  requested_agence_nom: '',
  requested_terminal_reference: '',
  commentaire: '',
};

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatDisplayDate = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('fr-FR');
};

const formatOptionalDate = (value) => (value ? formatDisplayDate(value) : 'N/A');

const getStatusBadgeClass = (status) =>
  status === 'Actif'
    ? 'border-green-200 bg-green-50 text-green-700'
    : 'border-slate-200 bg-slate-100 text-slate-700';

const getPointRequestScope = (pointVente) =>
  [
    pointVente?.pointVenteUid,
    pointVente?.codePointVente,
    pointVente?.agenceNom,
    pointVente?.terminalReference,
  ]
    .filter(Boolean)
    .join(' - ');

const PointsVenteMobiChefPage = () => {
  const { nomAgence, chefDetails } = useOutletContext();
  const { toast } = useToast();
  const [pointsVente, setPointsVente] = useState([]);
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [terminaux, setTerminaux] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isRequestTableMissing, setIsRequestTableMissing] = useState(false);
  const [terminalSuivi, setTerminalSuivi] = useState(null);
  const [terminalSuiviMap, setTerminalSuiviMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [viewRefreshedAt, setViewRefreshedAt] = useState(null);
  const [activeSearchTerm, setActiveSearchTerm] = usePageState('chef-points-vente-mobi', 'activeSearchTerm', '');
  const [pageSize, setPageSize] = usePageState('chef-points-vente-mobi', 'pageSize', '10');
  const [selectedActivePointUid, setSelectedActivePointUid] = useState('');
  const [historyDialogUid, setHistoryDialogUid] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPointVente, setSelectedPointVente] = useState(null);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);

  const loadData = useCallback(async () => {
    if (!nomAgence) return;

    setIsLoading(true);

    const [
      pointsVenteResponse,
      regionsResponse,
      agencesResponse,
      terminauxResponse,
      requestsResponse,
    ] = await Promise.all([
      supabase.from('points_vente_mobi').select('*').order('created_at', { ascending: false }),
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region').eq('is_current', true).order('nom', { ascending: true }),
      supabase.from('terminaux_mobi').select('id, reference, modele, statut').order('reference', { ascending: true }),
      supabase.from('points_vente_mobi_change_requests').select('*').order('created_at', { ascending: false }),
    ]);

    if (pointsVenteResponse.error) {
      toast({
        title: 'Erreur de chargement',
        description: "Impossible de charger les points de vente mobi de l'agence.",
        variant: 'destructive',
      });
      setPointsVente([]);
    } else {
      setPointsVente(pointsVenteResponse.data || []);
      setLastLoadedAt(new Date());
    }

    if (regionsResponse.error) {
      toast({ title: 'Erreur chargement régions', description: regionsResponse.error.message, variant: 'destructive' });
      setRegions([]);
    } else {
      setRegions(regionsResponse.data || []);
    }

    if (agencesResponse.error) {
      toast({ title: 'Erreur chargement agences', description: agencesResponse.error.message, variant: 'destructive' });
      setAgences([]);
    } else {
      setAgences(agencesResponse.data || []);
    }

    if (terminauxResponse.error) {
      toast({ title: 'Erreur chargement terminaux mobi', description: terminauxResponse.error.message, variant: 'destructive' });
      setTerminaux([]);
    } else {
      setTerminaux(terminauxResponse.data || []);
    }

    if (requestsResponse.error) {
      if (isMissingSupabaseTableError(requestsResponse.error, 'points_vente_mobi_change_requests')) {
        setIsRequestTableMissing(true);
      } else if (!isSupabaseAuthError(requestsResponse.error)) {
        toast({
          title: 'Erreur chargement demandes',
          description: requestsResponse.error.message,
          variant: 'destructive',
        });
      }
      setRequests([]);
    } else {
      setIsRequestTableMissing(false);
      setRequests(requestsResponse.data || []);
    }

    setIsLoading(false);
  }, [nomAgence, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    supabase
      .rpc('get_suivi_refresh_info')
      .then(({ data }) => {
        if (data?.last_refresh) setViewRefreshedAt(new Date(data.last_refresh));
      })
      .catch(() => {});
  }, []);

  const agencePoints = useMemo(
    () =>
      pointsVente.filter((pointVente) => {
        const matchesAgencyName = normalizeText(pointVente.agenceNom) === normalizeText(nomAgence);
        const matchesAgencyCode =
          chefDetails?.codePDV &&
          normalizeText(pointVente.agenceCodePDV) === normalizeText(chefDetails.codePDV);

        return matchesAgencyName || matchesAgencyCode;
      }),
    [chefDetails?.codePDV, nomAgence, pointsVente]
  );

  const activePoints = useMemo(
    () =>
      agencePoints
        .filter((pointVente) => pointVente.statut === 'Actif')
        .sort((firstPoint, secondPoint) =>
          String(firstPoint.codePointVente || '').localeCompare(String(secondPoint.codePointVente || ''))
        ),
    [agencePoints]
  );

  const agenceRequests = useMemo(() => {
    const pointUids = new Set(agencePoints.map((pointVente) => pointVente.pointVenteUid).filter(Boolean));

    return requests.filter(
      (request) =>
        pointUids.has(request.point_vente_uid) ||
        normalizeText(request.current_agence_nom) === normalizeText(nomAgence)
    );
  }, [agencePoints, nomAgence, requests]);

  useEffect(() => {
    if (activePoints.length === 0) {
      if (selectedActivePointUid) setSelectedActivePointUid('');
      return;
    }

    const fallbackUid = activePoints[0].pointVenteUid;
    const selectedStillExists = activePoints.some(
      (pointVente) => pointVente.pointVenteUid === selectedActivePointUid
    );

    if (!selectedActivePointUid || !selectedStillExists) {
      setSelectedActivePointUid(fallbackUid);
    }
  }, [activePoints, selectedActivePointUid]);

  useEffect(() => {
    const terminalReferences = [...new Set(activePoints.map((pointVente) => pointVente.terminalReference).filter(Boolean))];

    if (terminalReferences.length === 0) {
      setTerminalSuiviMap({});
      return;
    }

    supabase
      .from('vue_suivi_trm_mobi_v2')
      .select('id_trm_mobi, derniere_utilisation, dernier_prepose, hors_service, age_d_utilisation')
      .in('id_trm_mobi', terminalReferences)
      .then(({ data }) => {
        const suiviByTerminal = {};
        (data || []).forEach((row) => {
          suiviByTerminal[row.id_trm_mobi] = row;
        });
        setTerminalSuiviMap(suiviByTerminal);
      })
      .catch(() => setTerminalSuiviMap({}));
  }, [activePoints]);

  const filteredActivePoints = useMemo(() => {
    const searchValue = normalizeText(activeSearchTerm);

    return activePoints.filter((pointVente) => {
      const suivi = terminalSuiviMap[pointVente.terminalReference];

      return (
        !searchValue ||
        [
          pointVente.codePointVente,
          pointVente.region,
          pointVente.agenceNom,
          pointVente.terminalReference,
          pointVente.guichetiereNom,
          pointVente.guichetiereMatricule,
          suivi?.dernier_prepose ? formatDisplayDate(suivi.dernier_prepose) : null,
        ].some((value) => normalizeText(value).includes(searchValue))
      );
    });
  }, [activePoints, activeSearchTerm, terminalSuiviMap]);

  const displayedActivePoints = useMemo(
    () => (pageSize === 'all' ? filteredActivePoints : filteredActivePoints.slice(0, Number(pageSize))),
    [filteredActivePoints, pageSize]
  );

  const selectedActivePoint =
    activePoints.find((pointVente) => pointVente.pointVenteUid === selectedActivePointUid) || null;

  useEffect(() => {
    if (!selectedActivePoint?.terminalReference) {
      setTerminalSuivi(null);
      return;
    }

    supabase
      .from('vue_suivi_trm_mobi_v2')
      .select('id_trm_mobi, age_d_utilisation, premiere_utilisation, derniere_utilisation, dernier_prepose, hors_service')
      .eq('id_trm_mobi', selectedActivePoint.terminalReference)
      .maybeSingle()
      .then(({ data }) => setTerminalSuivi(data || null))
      .catch(() => setTerminalSuivi(null));
  }, [selectedActivePoint?.terminalReference]);

  const regionOptions = buildRegionOptions(regions);

  const agenceOptions = useMemo(
    () =>
      agences
        .filter(
          (agence) =>
            !requestForm.requested_region ||
            normalizeText(agence.region) === normalizeText(requestForm.requested_region)
        )
        .map((agence) => ({
          value: agence.nom,
          label: `${agence.nom}${agence.codePDV ? ` - ${agence.codePDV}` : ''}`,
        })),
    [agences, requestForm.requested_region]
  );

  const terminalOptions = useMemo(
    () =>
      terminaux
        .filter(
          (terminal) =>
            terminal.statut === 'Actif' ||
            normalizeText(terminal.reference) === normalizeText(selectedPointVente?.terminalReference)
        )
        .map((terminal) => ({
          value: terminal.reference,
          label: `${terminal.reference}${terminal.modele ? ` - ${terminal.modele}` : ''}`,
        })),
    [selectedPointVente?.terminalReference, terminaux]
  );

  const openEditDialog = (pointVente) => {
    setSelectedPointVente(pointVente);
    setRequestForm({
      requested_region: pointVente.region || '',
      requested_agence_nom: pointVente.agenceNom || '',
      requested_terminal_reference: pointVente.terminalReference || '',
      commentaire: '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPointVente) return;

    if (isRequestTableMissing) {
      toast({
        title: 'Table Supabase manquante',
        description:
          "La table 'points_vente_mobi_change_requests' n'existe pas encore dans Supabase.",
        variant: 'destructive',
      });
      return;
    }

    const hasNoChange =
      normalizeText(requestForm.requested_region) === normalizeText(selectedPointVente.region) &&
      normalizeText(requestForm.requested_agence_nom) === normalizeText(selectedPointVente.agenceNom) &&
      normalizeText(requestForm.requested_terminal_reference) === normalizeText(selectedPointVente.terminalReference);

    if (hasNoChange) {
      toast({
        title: 'Aucune modification',
        description: 'Veuillez modifier au moins une information avant d’envoyer la demande.',
      });
      return;
    }

    const hasPendingRequest = requests.some(
      (request) =>
        request.point_vente_uid === selectedPointVente.pointVenteUid &&
        request.statut === REQUEST_STATUS.PENDING
    );

    if (hasPendingRequest) {
      toast({
        title: 'Demande déjà en attente',
        description: 'Une demande de modification est déjà en cours pour ce point de vente.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const chefName =
      [chefDetails?.prenom, chefDetails?.nom].filter(Boolean).join(' ').trim() ||
      "Chef d'agence";
    const userComment = requestForm.commentaire?.trim();

    const payload = {
      point_vente_uid: selectedPointVente.pointVenteUid,
      code_point_vente: selectedPointVente.codePointVente,
      guichetiere_matricule: selectedPointVente.guichetiereMatricule,
      guichetiere_nom: selectedPointVente.guichetiereNom,
      current_region: selectedPointVente.region,
      current_agence_nom: selectedPointVente.agenceNom,
      current_terminal_reference: selectedPointVente.terminalReference,
      requested_region: requestForm.requested_region,
      requested_agence_nom: requestForm.requested_agence_nom,
      requested_terminal_reference: requestForm.requested_terminal_reference,
      commentaire: [userComment, `Demande saisie par ${chefName}.`].filter(Boolean).join('\n'),
      statut: REQUEST_STATUS.PENDING,
    };

    const { error } = await supabase.from('points_vente_mobi_change_requests').insert(payload);

    if (error) {
      if (isMissingSupabaseTableError(error, 'points_vente_mobi_change_requests')) {
        setIsRequestTableMissing(true);
        toast({
          title: 'Table Supabase manquante',
          description:
            "La table 'points_vente_mobi_change_requests' n'existe pas encore dans Supabase.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erreur d’envoi',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Demande envoyée',
        description: `La modification du point de vente ${selectedPointVente.codePointVente} a été transmise à l’exploitation.`,
        className: 'bg-green-500 text-white',
      });
      setIsEditDialogOpen(false);
      setSelectedPointVente(null);
      setRequestForm(defaultRequestForm);
      loadData();
    }

    setIsLoading(false);
  };

  const handleSyncSuivi = async () => {
    setIsSyncing(true);

    await loadData();
    setIsSyncing(false);

    toast({
      title: 'Affichage rechargé',
      description: 'Les points de vente mobi de votre agence ont été actualisés.',
      className: 'bg-green-500 text-white',
    });

    supabase
      .rpc('refresh_suivi_trm')
      .then(({ data, error }) => {
        if (!error && data?.ok) {
          const refreshedAt = new Date(data.refreshed_at || Date.now());
          setViewRefreshedAt(refreshedAt);
          loadData();
        }
      })
      .catch(() => {});
  };

  const pendingRequestsCount = agenceRequests.filter((request) => request.statut === REQUEST_STATUS.PENDING).length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <MapPin className="mr-3 h-8 w-8" />
            Point de Vente Mobi
          </CardTitle>
          <CardDescription>
            Points de vente mobi rattachés à {nomAgence}, avec l’historique complet de leurs changements.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiStatCard
          icon={MapPin}
          label="Points actifs"
          value={activePoints.length}
          helper="Affectations actives rattachées à votre agence."
          tone="primary"
        />
        <KpiStatCard
          icon={History}
          label="Versions historiques"
          value={agencePoints.length}
          helper="Historique complet des évolutions du parc de points de vente."
          tone="blue"
        />
        <KpiStatCard
          icon={Building2}
          label="Inactifs"
          value={agencePoints.filter((pointVente) => pointVente.statut === 'Inactif').length}
          helper="Versions clôturées ou anciennes sur votre agence."
          tone="emerald"
        />
        <KpiStatCard
          icon={Send}
          label="Demandes en attente"
          value={pendingRequestsCount}
          helper="Modifications de point de vente en attente de validation."
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <Card className="relative overflow-hidden border border-primary/20 bg-white/90 shadow-xl backdrop-blur lg:order-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader className="relative space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg text-primary">Points de Vente Actifs</CardTitle>
                <CardDescription>{filteredActivePoints.length} point(s) actif(s)</CardDescription>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncSuivi}
                  disabled={isSyncing}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Actualisation...' : 'Actualiser'}
                </Button>

                <div className="flex flex-col items-end gap-0.5">
                  {viewRefreshedAt && (() => {
                    const diffH = Math.round((Date.now() - viewRefreshedAt.getTime()) / 3600000);
                    const isStale = diffH >= 6;

                    return (
                      <span className={`text-[10px] ${isStale ? 'font-medium text-amber-600' : 'text-muted-foreground'}`}>
                        Vue : {diffH === 0 ? '< 1h' : `${diffH}h`}
                      </span>
                    );
                  })()}
                  {lastLoadedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      Affiché : {lastLoadedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={activeSearchTerm}
                onChange={(event) => setActiveSearchTerm(event.target.value)}
                placeholder="Rechercher..."
                className="pl-9"
                disabled={isLoading}
              />
            </div>
          </CardHeader>

          <CardContent className="relative p-0">
            {isLoading && filteredActivePoints.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
            ) : filteredActivePoints.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun point de vente actif.</p>
            ) : (
              <div className="max-h-[620px] divide-y overflow-y-auto">
                {filteredActivePoints.map((pointVente, index) => {
                  const isSelected = pointVente.pointVenteUid === selectedActivePointUid;
                  const suivi = terminalSuiviMap[pointVente.terminalReference];

                  return (
                    <motion.div
                      key={pointVente.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => setSelectedActivePointUid(pointVente.pointVenteUid)}
                      className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40 ${
                        isSelected ? 'border-l-2 border-primary bg-primary/5' : 'border-l-2 border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {pointVente.codePointVente || 'N/A'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{pointVente.agenceNom || 'N/A'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Smartphone className="h-3 w-3 shrink-0" />
                            {pointVente.terminalReference || '-'}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            {formatOptionalDate(suivi?.dernier_prepose)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setHistoryDialogUid(pointVente.pointVenteUid);
                        }}
                        title="Voir l'historique"
                        className="ml-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-primary/20 bg-white/90 shadow-xl backdrop-blur lg:order-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl text-primary">Détail du Point de Vente</CardTitle>
                <CardDescription>
                  {selectedActivePoint
                    ? 'Informations complètes et actions disponibles.'
                    : 'Sélectionnez un point dans la liste pour voir ses détails.'}
                </CardDescription>
              </div>
              {selectedActivePoint && (
                <Badge variant="outline" className={getStatusBadgeClass(selectedActivePoint.statut)}>
                  {selectedActivePoint.statut}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="relative space-y-4 pt-0">
            {selectedActivePoint ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-primary">
                      {selectedActivePoint.codePointVente || 'N/A'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {selectedActivePoint.agenceNom || 'N/A'}
                      </span>
                      <span>.</span>
                      <span className="flex items-center gap-1">
                        <Route className="h-3 w-3" />
                        {selectedActivePoint.region || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Affectation
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { icon: Smartphone, label: 'Terminal', value: selectedActivePoint.terminalReference || 'N/A' },
                      { icon: User, label: 'Guichetière', value: selectedActivePoint.guichetiereNom || 'N/A' },
                      { icon: ShieldCheck, label: 'Matricule', value: selectedActivePoint.guichetiereMatricule || 'N/A' },
                      {
                        icon: CalendarDays,
                        label: 'Début validité',
                        value: formatDisplayDate(selectedActivePoint.dateDebutValidite),
                      },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="truncate text-xs font-semibold">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Données Terminal
                  </p>
                  {terminalSuivi ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        {
                          label: 'Dern. utilisation',
                          value: formatDisplayDate(terminalSuivi.derniere_utilisation),
                          border: 'border-l-blue-400',
                          text: 'text-blue-700',
                        },
                        {
                          label: 'Dern. proposé',
                          value: formatDisplayDate(terminalSuivi.dernier_prepose),
                          border: 'border-l-violet-400',
                          text: 'text-violet-700',
                        },
                        {
                          label: 'Hors service',
                          value: terminalSuivi.hors_service != null ? `${terminalSuivi.hors_service} j` : 'N/A',
                          border: 'border-l-amber-400',
                          text: 'text-amber-700',
                        },
                        {
                          label: 'Age utilisation',
                          value: terminalSuivi.age_d_utilisation != null ? `${terminalSuivi.age_d_utilisation} j` : 'N/A',
                          border: 'border-l-emerald-400',
                          text: 'text-emerald-700',
                        },
                      ].map(({ label, value, border, text }) => (
                        <div key={label} className={`rounded-md border border-l-4 bg-muted/20 px-3 py-2 ${border}`}>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className={`text-xs font-bold ${text}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      {selectedActivePoint.terminalReference ? 'Aucune donnée de suivi.' : 'Terminal non renseigné.'}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-blue-500 hover:text-blue-700"
                    onClick={() => openEditDialog(selectedActivePoint)}
                    disabled={isLoading}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Modifier
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setHistoryDialogUid(selectedActivePoint.pointVenteUid)}
                    disabled={isLoading}
                  >
                    <History className="h-3.5 w-3.5" />
                    Historique
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
                <MapPin className="h-10 w-10 opacity-25" />
                <p className="text-sm">Sélectionnez un point de vente dans la liste.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Points de vente actifs de l’agence</CardTitle>
              <CardDescription>
                Vue tabulaire conservée : sélection, modification, historique et pagination.
              </CardDescription>
            </div>

            <div className="flex w-full items-center gap-2 md:max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={activeSearchTerm}
                  onChange={(event) => setActiveSearchTerm(event.target.value)}
                  placeholder="Rechercher un point actif..."
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue placeholder="Afficher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 lignes</SelectItem>
                  <SelectItem value="10">10 lignes</SelectItem>
                  <SelectItem value="20">20 lignes</SelectItem>
                  <SelectItem value="50">50 lignes</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && agencePoints.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Chargement des points de vente mobi...</p>
          ) : (
            <Table>
              <TableCaption>
                {filteredActivePoints.length === 0
                  ? 'Aucun point de vente mobi actif pour cette agence.'
                  : `${displayedActivePoints.length} / ${filteredActivePoints.length} point(s) de vente mobi actif(s) affiché(s).`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point de vente</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Terminal Mobi</TableHead>
                  <TableHead>Guichetière</TableHead>
                  <TableHead>Début validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedActivePoints.map((pointVente, index) => (
                  <motion.tr
                    key={pointVente.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                      pointVente.pointVenteUid === selectedActivePointUid ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedActivePointUid(pointVente.pointVenteUid)}
                  >
                    <TableCell className="font-medium">{pointVente.codePointVente}</TableCell>
                    <TableCell>{pointVente.region || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.terminalReference || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.terminalModele || 'Sans modèle'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.guichetiereNom || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.guichetiereMatricule || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDisplayDate(pointVente.dateDebutValidite)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(pointVente.statut)}>
                        {pointVente.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditDialog(pointVente);
                          }}
                          title="Modifier le point de vente"
                          className="rounded-md p-1.5 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setHistoryDialogUid(pointVente.pointVenteUid);
                          }}
                          title="Voir l'historique"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Demandes de modification des points de vente</CardTitle>
              <CardDescription>
                Suivi des demandes envoyées à l’exploitation pour les points de vente de votre agence.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              En attente : {pendingRequestsCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isRequestTableMissing ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              La table points_vente_mobi_change_requests n’existe pas encore dans Supabase.
            </p>
          ) : (
            <Table>
              <TableCaption>
                {agenceRequests.length === 0
                  ? 'Aucune demande de modification pour cette agence.'
                  : `${agenceRequests.length} demande(s) enregistrée(s).`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point de vente</TableHead>
                  <TableHead>Modification demandée</TableHead>
                  <TableHead>Commentaire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Traitement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agenceRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{request.code_point_vente}</span>
                        <span className="text-xs text-muted-foreground">{request.current_agence_nom}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] whitespace-normal text-sm">
                      <p><span className="font-medium">Région:</span> {request.requested_region || 'Sans changement'}</p>
                      <p><span className="font-medium">Agence:</span> {request.requested_agence_nom || 'Sans changement'}</p>
                      <p><span className="font-medium">Terminal:</span> {request.requested_terminal_reference || 'Sans changement'}</p>
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-pre-wrap text-sm text-muted-foreground">
                      {request.commentaire || 'Aucun commentaire'}
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
          )}
        </CardContent>
      </Card>

      {(() => {
        const dialogPdv = historyDialogUid
          ? agencePoints.find((pointVente) => pointVente.pointVenteUid === historyDialogUid)
          : null;
        const dialogHistory = historyDialogUid
          ? agencePoints
              .filter((pointVente) => pointVente.pointVenteUid === historyDialogUid)
              .sort((firstPoint, secondPoint) => {
                const secondDate = secondPoint.dateDebutValidite || secondPoint.created_at || '';
                const firstDate = firstPoint.dateDebutValidite || firstPoint.created_at || '';
                return secondDate.localeCompare(firstDate);
              })
          : [];

        return (
          <Dialog
            open={!!historyDialogUid}
            onOpenChange={(open) => {
              if (!open) setHistoryDialogUid(null);
            }}
          >
            <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <History className="h-5 w-5" />
                  Historique - {dialogPdv?.codePointVente ?? ''}
                </DialogTitle>
                <DialogDescription>
                  {dialogPdv
                    ? `${dialogPdv.terminalReference || 'Sans terminal'} - ${dialogPdv.guichetiereNom || 'Sans guichetière'}`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Point de vente</TableHead>
                    <TableHead>Terminal Mobi</TableHead>
                    <TableHead>Guichetière</TableHead>
                    <TableHead>Début validité</TableHead>
                    <TableHead>Fin validité</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Aucun historique pour ce point de vente.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dialogHistory.map((pointVente) => (
                      <TableRow key={pointVente.id}>
                        <TableCell className="font-medium">{pointVente.codePointVente}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{pointVente.terminalReference || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{pointVente.terminalModele || ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{pointVente.guichetiereNom || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">
                              {pointVente.guichetiereMatricule || ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDisplayDate(pointVente.dateDebutValidite)}</TableCell>
                        <TableCell>{formatDisplayDate(pointVente.dateFinValidite)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadgeClass(pointVente.statut)}>
                            {pointVente.statut}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TableCaption className="mt-0 pb-1 text-xs">
                {dialogHistory.length} version(s) pour ce point de vente.
              </TableCaption>
            </DialogContent>
          </Dialog>
        );
      })()}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-xl glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-primary">Modifier le point de vente</DialogTitle>
            <DialogDescription>
              {selectedPointVente
                ? `${getPointRequestScope(selectedPointVente)}`
                : 'Demande de modification'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Région souhaitée</Label>
              <Select
                value={requestForm.requested_region}
                onValueChange={(value) =>
                  setRequestForm((previousState) => ({
                    ...previousState,
                    requested_region: value,
                    requested_agence_nom: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une région" />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agence souhaitée</Label>
              <Select
                value={requestForm.requested_agence_nom}
                onValueChange={(value) =>
                  setRequestForm((previousState) => ({
                    ...previousState,
                    requested_agence_nom: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une agence" />
                </SelectTrigger>
                <SelectContent>
                  {agenceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Terminal mobi souhaité</Label>
              <Select
                value={requestForm.requested_terminal_reference}
                onValueChange={(value) =>
                  setRequestForm((previousState) => ({
                    ...previousState,
                    requested_terminal_reference: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un terminal" />
                </SelectTrigger>
                <SelectContent>
                  {terminalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="commentaire-point-vente-chef">Commentaire</Label>
              <Textarea
                id="commentaire-point-vente-chef"
                rows={4}
                value={requestForm.commentaire}
                onChange={(event) =>
                  setRequestForm((previousState) => ({
                    ...previousState,
                    commentaire: event.target.value,
                  }))
                }
                placeholder="Précisez la raison de cette modification..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isLoading}>
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

export default PointsVenteMobiChefPage;
