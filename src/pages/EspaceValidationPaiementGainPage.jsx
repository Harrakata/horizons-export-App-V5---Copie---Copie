import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import RegionalMaintenanceSection from '@/components/directeur_regional/RegionalMaintenanceSection';
import RegionalPointageSection from '@/components/directeur_regional/RegionalPointageSection';
import { supabase } from '@/lib/supabaseClient';
import {
  canValidatorHandleRequest,
  DEMANDE_STATUSES,
  formatCurrency,
  formatDisplayDate,
  formatDisplayDateTime,
  getEffectiveDemandeStatus,
  getEffectiveWorkflowStage,
  getStatusBadgeClass,
  getWorkflowStageLabel,
  isValidatorAssignedToDemande,
  VALIDATOR_FUNCTIONS,
  WORKFLOW_STAGES,
} from '@/lib/paiementGainUtils';
import { buildFullName, recordPaiementGainEvent } from '@/lib/paiementGainService';
import {
  APP_SPACE_TAB_SETTINGS_KEY,
  buildDefaultAppSpaceTabFunctionalities,
  getFirstEnabledAppSpaceTab,
  isAppSpaceTabEnabled,
  normalizeAppSpaceTabFunctionalities,
} from '@/lib/exploitationProfiles';

const SPACE_CONFIGS = {
  regional: {
    storageKey: 'pmuValidationGainAuth',
    spaceTitle: 'Espace Directeur régional',
    loginDescription: 'Connectez-vous avec le profil directeur régional créé dans l’espace Exploitation.',
    expectedFunction: VALIDATOR_FUNCTIONS.REGIONAL,
    fallbackInitials: 'DR',
  },
  general: {
    storageKey: 'pmuDirecteurGeneralAuth',
    spaceTitle: 'Espace Directeur général',
    loginDescription: 'Connectez-vous avec le profil directeur général créé dans l’espace Exploitation.',
    expectedFunction: VALIDATOR_FUNCTIONS.GENERAL,
    fallbackInitials: 'DG',
  },
};

const getStoredValidatorForSpace = (storageKey, expectedFunction) => {
  try {
    const storedAuth = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (storedAuth?.userData?.fonction === expectedFunction) {
      return storedAuth.userData;
    }
  } catch (error) {
    console.error('Impossible de lire la session validateur :', error);
  }

  return null;
};

const LoginPage = ({ onLogin, spaceConfig }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Erreur',
        description: 'Veuillez renseigner l’email et le mot de passe.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from('validateurs_paiement_gain')
      .select('*')
      .eq('email', email)
      .eq('motDePasse', password)
      .eq('fonction', spaceConfig.expectedFunction)
      .eq('statut', 'Actif')
      .single();

    if (error || !data) {
      toast({
        title: 'Connexion impossible',
        description: 'Identifiants invalides ou profil inactif.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    onLogin(data);
    toast({
      title: 'Connexion réussie',
      description: `Bienvenue ${data.prenom} ${data.nom}.`,
      className: 'bg-green-500 text-white',
    });
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[calc(100vh-220px)] items-center justify-center"
    >
      <Card className="w-full max-w-md shadow-2xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary">
            <ShieldCheck className="mr-2 inline-block h-8 w-8 text-primary" />
            {spaceConfig.spaceTitle}
          </CardTitle>
          <CardDescription className="text-center">{spaceConfig.loginDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="validation-email">Email</Label>
              <Input
                id="validation-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@exemple.com"
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validation-password">Mot de passe</Label>
              <Input
                id="validation-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mot de passe"
                disabled={isLoading}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-emerald-600 text-white hover:from-primary/90 hover:to-emerald-600/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EspaceValidationPaiementGainPage = ({ spaceMode = 'regional' }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const spaceConfig = SPACE_CONFIGS[spaceMode] || SPACE_CONFIGS.regional;
  const [validator, setValidator] = useState(() =>
    getStoredValidatorForSpace(spaceConfig.storageKey, spaceConfig.expectedFunction)
  );
  const [activeSection, setActiveSection] = useState('paiement');
  const [demandes, setDemandes] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedDemandeId, setSelectedDemandeId] = useState(null);
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(
        JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceTabFunctionalities();
    }
  });
  const currentSpaceKey =
    spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.GENERAL
      ? 'espace-directeur-general'
      : 'espace-directeur-regional';

  useEffect(() => {
    const storedValidator = getStoredValidatorForSpace(
      spaceConfig.storageKey,
      spaceConfig.expectedFunction
    );

    setValidator(storedValidator);
    setDemandes([]);
    setEvents([]);
    setSelectedDemandeId(null);
    setActionComment('');
    setActiveSection('paiement');
  }, [spaceConfig.expectedFunction, spaceConfig.storageKey]);

  const loadData = useCallback(async () => {
    if (!validator?.id) return;

    setIsLoading(true);

    const [{ data: demandesData, error: demandesError }, { data: eventsData, error: eventsError }] = await Promise.all([
      supabase.from('demandes_paiement_gain').select('*').order('updated_at', { ascending: false }),
      supabase.from('paiement_gain_workflow_events').select('*').order('created_at', { ascending: false }),
    ]);

    if (demandesError) {
      toast({
        title: 'Erreur chargement demandes',
        description: demandesError.message,
        variant: 'destructive',
      });
    } else {
      setDemandes(demandesData || []);
    }

    if (eventsError) {
      toast({
        title: 'Erreur chargement historique',
        description: eventsError.message,
        variant: 'destructive',
      });
    } else {
      setEvents(eventsData || []);
    }

    setIsLoading(false);
  }, [toast, validator?.id]);

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, 15000);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  useEffect(() => {
    const handleSpaceTabsUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceTabFunctionalities(event.detail);
      setSpaceTabFunctionalities(normalizedSettings);
      localStorage.setItem(APP_SPACE_TAB_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
    return () => window.removeEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
  }, []);

  const pendingDemandes = useMemo(
    () =>
      demandes
        .filter((demande) => canValidatorHandleRequest(demande, validator))
        .filter((demande) =>
          [
            demande.codeDemande,
            demande.nomGagnant,
            demande.prenomGagnant,
            demande.numeroTicketGagnant,
            demande.agenceOrigineNom,
          ].some((value) => String(value ?? '').toLowerCase().includes(pendingSearchTerm.toLowerCase()))
        ),
    [demandes, pendingSearchTerm, validator]
  );

  const assignedDemandes = useMemo(() => {
    if (!validator) return [];
    return demandes.filter((demande) => isValidatorAssignedToDemande(demande, validator));
  }, [demandes, validator]);

  const historyDemandes = useMemo(
    () =>
      assignedDemandes.filter((demande) =>
        [
          demande.codeDemande,
          demande.nomGagnant,
          demande.prenomGagnant,
          demande.numeroTicketGagnant,
          getEffectiveDemandeStatus(demande),
          demande.agenceOrigineNom,
        ].some((value) => String(value ?? '').toLowerCase().includes(historySearchTerm.toLowerCase()))
      ),
    [assignedDemandes, historySearchTerm]
  );

  useEffect(() => {
    const fallbackDemandeId = pendingDemandes[0]?.id || historyDemandes[0]?.id || null;

    if (!selectedDemandeId && fallbackDemandeId) {
      setSelectedDemandeId(fallbackDemandeId);
      return;
    }

    const stillExists = assignedDemandes.some((demande) => String(demande.id) === String(selectedDemandeId));
    if (selectedDemandeId && !stillExists) {
      setSelectedDemandeId(fallbackDemandeId);
    }
  }, [assignedDemandes, historyDemandes, pendingDemandes, selectedDemandeId]);

  const selectedDemande =
    assignedDemandes.find((demande) => String(demande.id) === String(selectedDemandeId)) ||
    pendingDemandes[0] ||
    historyDemandes[0] ||
    null;

  const isSelectedDemandeActionable = selectedDemande
    ? canValidatorHandleRequest(selectedDemande, validator)
    : false;

  const selectedDemandeEvents = useMemo(
    () =>
      events
        .filter((event) => String(event.demandeId ?? '') === String(selectedDemande?.id ?? ''))
        .sort((firstEvent, secondEvent) => new Date(secondEvent.created_at) - new Date(firstEvent.created_at)),
    [events, selectedDemande?.id]
  );

  const handledCount = useMemo(() => {
    if (!validator) return 0;
    return events.filter((event) => String(event.actorId ?? '') === String(validator.id)).length;
  }, [events, validator]);

  const isRegionalProfile =
    validator?.fonction === VALIDATOR_FUNCTIONS.REGIONAL && Boolean(validator?.regionAssignee);
  const isGeneralProfile = validator?.fonction === VALIDATOR_FUNCTIONS.GENERAL;

  const handleLogin = (userData) => {
    setValidator(userData);
    localStorage.setItem(spaceConfig.storageKey, JSON.stringify({ isAuthenticated: true, userData }));
  };

  const handleLogout = () => {
    setValidator(null);
    setDemandes([]);
    setEvents([]);
    setActiveSection('paiement');
    localStorage.removeItem(spaceConfig.storageKey);
    navigate('/');
  };

  const handleDecision = async (decision) => {
    if (!selectedDemande || !validator) return;

    setIsActionLoading(true);

    const statusBefore = selectedDemande.statutGlobal;
    let nextStatus = DEMANDE_STATUSES.REJECTED;
    let nextStage = WORKFLOW_STAGES.DONE;
    let nextStepLabel = 'workflow';
    const updates = {
      commentaireDerniereAction: actionComment.trim() || null,
    };

    if (decision === 'approve') {
      if (validator.fonction === VALIDATOR_FUNCTIONS.REGIONAL) {
        updates.dateValidationDirecteurRegional = new Date().toISOString();
        const requiresGeneralValidation =
          Number(selectedDemande.montantGain) >= 50000000 ||
          String(selectedDemande.circuitValidation ?? '').includes(VALIDATOR_FUNCTIONS.GENERAL);

        nextStatus = requiresGeneralValidation
          ? DEMANDE_STATUSES.PENDING_GENERAL
          : DEMANDE_STATUSES.PENDING_EXPLOITATION;
        nextStage = requiresGeneralValidation
          ? WORKFLOW_STAGES.GENERAL
          : WORKFLOW_STAGES.EXPLOITATION;
        nextStepLabel = requiresGeneralValidation ? 'directeur général' : 'Exploitation';
      } else {
        updates.dateValidationDirecteurGeneral = new Date().toISOString();
        nextStatus = DEMANDE_STATUSES.PENDING_EXPLOITATION;
        nextStage = WORKFLOW_STAGES.EXPLOITATION;
        nextStepLabel = 'Exploitation';
      }
    }

    updates.statutGlobal = nextStatus;
    updates.niveauValidationCourant = nextStage;

    const { error: updateError } = await supabase
      .from('demandes_paiement_gain')
      .update(updates)
      .eq('id', selectedDemande.id);

    if (updateError) {
      toast({
        title: 'Action impossible',
        description: updateError.message,
        variant: 'destructive',
      });
      setIsActionLoading(false);
      return;
    }

    const actorName = buildFullName(validator.prenom, validator.nom);
    await recordPaiementGainEvent({
      demandeId: selectedDemande.id,
      codeDemande: selectedDemande.codeDemande,
      actionType: decision === 'approve' ? 'validation' : 'rejet',
      actorType:
        validator.fonction === VALIDATOR_FUNCTIONS.REGIONAL ? WORKFLOW_STAGES.REGIONAL : WORKFLOW_STAGES.GENERAL,
      actorId: validator.id,
      actorName,
      actorFunction: validator.fonction,
      statusBefore,
      statusAfter: nextStatus,
      commentaire: actionComment.trim() || null,
    });

    toast({
      title: decision === 'approve' ? 'Demande validée' : 'Demande refusée',
      description:
        decision === 'approve'
          ? `La demande a été transmise au ${nextStepLabel}.`
          : 'La demande a été refusée et clôturée.',
      className: decision === 'approve' ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
    });

    setActionComment('');
    await loadData();
    setIsActionLoading(false);
  };

  const renderDemandeDetailsSections = (demande) => (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Montant</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(demande.montantGain)}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Procédure</p>
          <p className="mt-1 font-medium">{demande.procedureResume || 'N/A'}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lieu de paiement</p>
          <p className="mt-1 font-medium">{demande.lieuPaiement || 'N/A'}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Agence d’origine</p>
          <p className="mt-1 font-medium">{demande.agenceOrigineNom || 'N/A'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Informations du gagnant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Nom :</span> {demande.nomGagnant || 'N/A'}</p>
            <p><span className="font-medium">Prénom :</span> {demande.prenomGagnant || 'N/A'}</p>
            <p><span className="font-medium">Secteur :</span> {demande.secteurResidence || 'N/A'}</p>
            <p><span className="font-medium">Province :</span> {demande.provinceResidence || 'N/A'}</p>
            <p><span className="font-medium">Région souhaitée :</span> {demande.directeurRegionalRegion || 'N/A'}</p>
            <p><span className="font-medium">Agence souhaitée :</span> {demande.localitePaiementSouhaitee || 'N/A'}</p>
            <p><span className="font-medium">Pièce d’identité :</span> {demande.numeroPieceIdentite || 'N/A'}</p>
            <p><span className="font-medium">Autorité :</span> {demande.autoritePieceIdentite || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Informations de course et ticket</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Numéro de course :</span> {demande.numeroCourse || 'N/A'}</p>
            <p><span className="font-medium">Type de pari :</span> {demande.typePari || 'N/A'}</p>
            <p><span className="font-medium">Date de réunion :</span> {formatDisplayDate(demande.dateReunionCourse)}</p>
            <p><span className="font-medium">Date de course :</span> {formatDisplayDate(demande.dateCourse)}</p>
            <p><span className="font-medium">Ticket gagnant :</span> {demande.numeroTicketGagnant || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Pièce d’identité et paiement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Numéro de pièce :</span> {demande.numeroPieceIdentite || 'N/A'}</p>
            <p><span className="font-medium">Date d’établissement :</span> {formatDisplayDate(demande.dateEtablissementPiece)}</p>
            <p><span className="font-medium">Autorité :</span> {demande.autoritePieceIdentite || 'N/A'}</p>
            <p><span className="font-medium">Mode de paiement :</span> {demande.modePaiement || 'N/A'}</p>
            <p><span className="font-medium">Lieu de paiement :</span> {demande.lieuPaiement || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Agences et validation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Chef d’agence :</span> {demande.chefAgenceNom || 'N/A'}</p>
            <p><span className="font-medium">Agence source :</span> {demande.agenceOrigineNom || 'N/A'}</p>
            <p><span className="font-medium">Code PDV source :</span> {demande.agenceOrigineCodePDV || 'N/A'}</p>
            <p><span className="font-medium">Agence de paiement :</span> {demande.agencePaiementNom || 'Non attribuée'}</p>
            <p><span className="font-medium">Code PDV paiement :</span> {demande.agencePaiementCodePDV || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-primary">Dates de validation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <p><span className="font-medium">Validation chef d’agence :</span> {formatDisplayDateTime(demande.dateValidationChef)}</p>
          <p><span className="font-medium">Validation directeur régional :</span> {formatDisplayDateTime(demande.dateValidationDirecteurRegional)}</p>
          <p><span className="font-medium">Validation directeur général :</span> {formatDisplayDateTime(demande.dateValidationDirecteurGeneral)}</p>
          <p><span className="font-medium">Autorisation exploitation :</span> {formatDisplayDateTime(demande.dateAutorisationExploitation)}</p>
          <p><span className="font-medium">Paiement final :</span> {formatDisplayDateTime(demande.datePaiementFinal)}</p>
        </CardContent>
      </Card>

      {demande.photoPieceUrl && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Pièce d’identité jointe</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={demande.photoPieceUrl}
              alt="Pièce d’identité"
              className="max-h-80 rounded-xl border object-contain"
            />
          </CardContent>
        </Card>
      )}
    </>
  );

  const renderWorkflowEvents = (workflowEvents) => {
    if (workflowEvents.length === 0) {
      return <p className="text-sm text-muted-foreground">Aucun événement enregistré pour cette demande.</p>;
    }

    return (
      <div className="space-y-3">
        {workflowEvents.map((event) => (
          <div key={event.id} className="rounded-xl border bg-background/70 p-4 text-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{event.actionType}</p>
                <p className="text-muted-foreground">
                  {event.actorName} {event.actorFunction ? `• ${event.actorFunction}` : ''}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{formatDisplayDateTime(event.created_at)}</p>
            </div>
            <p className="mt-2 text-muted-foreground">
              {event.statusBefore || 'N/A'} {' -> '} {event.statusAfter || 'N/A'}
            </p>
            {event.commentaire ? <p className="mt-2">{event.commentaire}</p> : null}
          </div>
        ))}
      </div>
    );
  };

  const renderPaymentSection = () => (
    <div className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <ShieldCheck className="mr-3 h-8 w-8" />
            {spaceConfig.spaceTitle}
          </CardTitle>
          <CardDescription>
            Validez les demandes d’autorisation de paiement selon votre niveau hiérarchique.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <Clock3 className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">Demandes à traiter</p>
              <p className="text-2xl font-bold">{pendingDemandes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Demandes suivies</p>
              <p className="text-2xl font-bold">{assignedDemandes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Actions enregistrées</p>
              <p className="text-2xl font-bold">{handledCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full max-w-xl grid-cols-2">
          <TabsTrigger value="pending">Demandes à valider</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <Card className="shadow-xl glassmorphism">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-primary">File de validation</CardTitle>
                  <CardDescription>
                    Les demandes ci-dessous attendent votre validation avant transmission à l’Exploitation.
                  </CardDescription>
                </div>
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pendingSearchTerm}
                    onChange={(event) => setPendingSearchTerm(event.target.value)}
                    placeholder="Rechercher une demande..."
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && demandes.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Chargement des demandes...</p>
              ) : (
                <Table>
                  <TableCaption>
                    {pendingDemandes.length === 0
                      ? 'Aucune demande ne vous est actuellement affectée.'
                      : `${pendingDemandes.length} demande(s) en attente de votre validation.`}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Gagnant</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Agence source</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDemandes.map((demande, index) => (
                      <motion.tr
                        key={demande.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                          String(selectedDemandeId) === String(demande.id) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedDemandeId(demande.id)}
                      >
                        <TableCell className="font-medium">{demande.codeDemande}</TableCell>
                        <TableCell>
                          {demande.prenomGagnant || '-'} {demande.nomGagnant || ''}
                        </TableCell>
                        <TableCell>{formatCurrency(demande.montantGain)}</TableCell>
                        <TableCell>{demande.agenceOrigineNom || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadgeClass(getEffectiveDemandeStatus(demande))}>
                            {getEffectiveDemandeStatus(demande)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDemandeId(demande.id);
                            }}
                          >
                            Examiner
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedDemande && isSelectedDemandeActionable && (
            <Card className="shadow-xl glassmorphism">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Détail de la demande {selectedDemande.codeDemande}</CardTitle>
                <CardDescription>
                  Étape en cours : {getWorkflowStageLabel(getEffectiveWorkflowStage(selectedDemande))}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderDemandeDetailsSections(selectedDemande)}

                <div className="space-y-2">
                  <Label htmlFor="validator-comment">Commentaire de décision</Label>
                  <Textarea
                    id="validator-comment"
                    rows={4}
                    value={actionComment}
                    onChange={(event) => setActionComment(event.target.value)}
                    placeholder="Ajoutez un commentaire de validation ou de refus si nécessaire."
                    disabled={isActionLoading}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleDecision('approve')}
                    disabled={isActionLoading}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Valider la demande
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDecision('reject')}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                    Refuser la demande
                  </Button>
                </div>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">Historique du workflow</CardTitle>
                  </CardHeader>
                  <CardContent>{renderWorkflowEvents(selectedDemandeEvents)}</CardContent>
                </Card>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card className="shadow-xl glassmorphism">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-primary">Historique des demandes suivies</CardTitle>
                  <CardDescription>
                    Retrouvez les demandes qui vous sont affectées et leur progression globale dans le circuit.
                  </CardDescription>
                </div>
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={historySearchTerm}
                    onChange={(event) => setHistorySearchTerm(event.target.value)}
                    placeholder="Rechercher dans l’historique..."
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>
                  {historyDemandes.length === 0
                    ? 'Aucune demande historique trouvée.'
                    : `${historyDemandes.length} demande(s) associée(s) à votre profil.`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Gagnant</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Étape courante</TableHead>
                    <TableHead>Statut global</TableHead>
                    <TableHead>Mise à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyDemandes.map((demande, index) => (
                    <motion.tr
                      key={demande.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                        String(selectedDemandeId) === String(demande.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedDemandeId(demande.id)}
                    >
                      <TableCell className="font-medium">{demande.codeDemande}</TableCell>
                      <TableCell>
                        {demande.prenomGagnant || '-'} {demande.nomGagnant || ''}
                      </TableCell>
                      <TableCell>{formatCurrency(demande.montantGain)}</TableCell>
                      <TableCell>{getWorkflowStageLabel(getEffectiveWorkflowStage(demande))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadgeClass(getEffectiveDemandeStatus(demande))}>
                          {getEffectiveDemandeStatus(demande)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDisplayDateTime(demande.updated_at)}</TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedDemande && (
            <Card className="shadow-xl glassmorphism">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Détail de la demande {selectedDemande.codeDemande}</CardTitle>
                <CardDescription>
                  Étape en cours : {getWorkflowStageLabel(getEffectiveWorkflowStage(selectedDemande))}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderDemandeDetailsSections(selectedDemande)}

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">Historique du workflow</CardTitle>
                  </CardHeader>
                  <CardContent>{renderWorkflowEvents(selectedDemandeEvents)}</CardContent>
                </Card>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderUnavailableRegionalSection = (title, description) => (
    <Card className="shadow-xl glassmorphism">
      <CardHeader>
        <CardTitle className="text-2xl text-primary">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );

  const renderCurrentSection = () => {
    if (activeSection === 'maintenance') {
      if (spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.GENERAL) {
        return <RegionalMaintenanceSection allowAllRegions viewerLabel="directeur général" />;
      }

      return isRegionalProfile ? (
        <RegionalMaintenanceSection regionName={validator.regionAssignee} viewerLabel="directeur régional" />
      ) : (
        renderUnavailableRegionalSection(
          'Maintenance des Terminaux',
          'Cette vue est réservée aux directeurs régionaux disposant d’une région assignée.'
        )
      );
    }

    if (activeSection === 'pointage') {
      if (spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.GENERAL) {
        return <RegionalPointageSection allowAllRegions />;
      }

      return isRegionalProfile ? (
        <RegionalPointageSection regionName={validator.regionAssignee} />
      ) : (
        renderUnavailableRegionalSection(
          'Suivi Pointage',
          'Cette vue est réservée aux directeurs régionaux disposant d’une région assignée.'
        )
      );
    }

    return renderPaymentSection();
  };

  if (!validator) {
    return <LoginPage onLogin={handleLogin} spaceConfig={spaceConfig} />;
  }

  const menuItems = [
    {
      key: 'paiement',
      label: 'Paiement de Gain',
      icon: <ShieldCheck className="h-5 w-5" />,
      disabled: false,
    },
    {
      key: 'maintenance',
      label: 'Maintenance Terminaux',
      icon: <Wrench className="h-5 w-5" />,
      disabled: spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.GENERAL ? !isGeneralProfile : !isRegionalProfile,
    },
    {
      key: 'pointage',
      label: 'Suivi Pointage',
      icon: <ClipboardList className="h-5 w-5" />,
      disabled: spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.GENERAL ? !isGeneralProfile : !isRegionalProfile,
    },
  ].filter((item) => isAppSpaceTabEnabled(spaceTabFunctionalities, currentSpaceKey, item.key));

  useEffect(() => {
    const fallbackTab = getFirstEnabledAppSpaceTab(spaceTabFunctionalities, currentSpaceKey)?.key || null;

    if (!menuItems.length) {
      setActiveSection('');
      return;
    }

    if (!menuItems.some((item) => item.key === activeSection) && fallbackTab) {
      setActiveSection(fallbackTab);
    }
  }, [activeSection, currentSpaceKey, menuItems, spaceTabFunctionalities]);

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="md:w-72"
      >
        <Card className="sticky top-20 shadow-lg glassmorphism">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20">
                <AvatarImage src={validator.photo_url || ''} alt={`${validator.prenom} ${validator.nom}`} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {[validator.prenom?.[0], validator.nom?.[0]].filter(Boolean).join('') || spaceConfig.fallbackInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl text-primary">{spaceConfig.spaceTitle}</CardTitle>
                <CardDescription className="text-sm">
                  {validator.prenom} {validator.nom} <br />
                  {validator.fonction} <br />
                  {spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.GENERAL
                    ? 'Périmètre : National'
                    : `Région : ${validator.regionAssignee || 'Non assignée'}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            <nav className="flex flex-grow flex-col space-y-2">
              {menuItems.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={activeSection === item.key ? 'default' : 'ghost'}
                  className={`justify-start py-3 text-base ${
                    activeSection === item.key
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted/50'
                  } ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => !item.disabled && setActiveSection(item.key)}
                  disabled={item.disabled}
                >
                  {React.cloneElement(item.icon, { className: 'mr-3 h-5 w-5' })}
                  {item.label}
                </Button>
              ))}
            </nav>

            {spaceConfig.expectedFunction === VALIDATOR_FUNCTIONS.REGIONAL && !isRegionalProfile && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Les onglets Maintenance et Suivi Pointage sont disponibles uniquement pour un directeur régional avec région assignée.
              </div>
            )}

            <div className="mt-auto pt-4">
              <Button
                variant="outline"
                className="w-full justify-start py-3 text-base hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5 text-red-500" />
                Déconnexion
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.aside>

      <main className="flex-1">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {menuItems.length === 0 ? (
            <Card className="shadow-xl glassmorphism">
              <CardContent className="p-6 text-center text-muted-foreground">
                Aucun onglet n’est actuellement activé pour cet espace.
              </CardContent>
            </Card>
          ) : (
            renderCurrentSection()
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceValidationPaiementGainPage;
