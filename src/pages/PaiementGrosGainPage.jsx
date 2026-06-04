import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePageState } from '@/hooks/usePageState';
import { motion } from 'framer-motion';
import {
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  Loader2,
  LogIn,
  MapPin,
  Search,
  ShieldCheck,
  UploadCloud,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/Combobox';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { buildRegionOptions, fetchRegions } from '@/lib/regions';
import {
  buildProcedureSummary,
  DEMANDE_STATUSES,
  formatCurrency,
  formatDisplayDate,
  formatDisplayDateTime,
  generateDemandeCode,
  getEffectiveDemandeStatus,
  getEffectiveWorkflowStage,
  getStatusBadgeClass,
  getWorkflowStageLabel,
  isChefApprovalPending,
  normalizeText,
  VALIDATOR_FUNCTIONS,
  WORKFLOW_STAGES,
} from '@/lib/paiementGainUtils';
import {
  fetchPaiementGainWorkflowConfigs,
  resolveProcedureForAmount,
} from '@/lib/paiementGainWorkflowConfig';
import {
  buildFullName,
  normalizeBigIntIdentifier,
  recordPaiementGainEvent,
  uploadPaiementGainIdentityPhoto,
} from '@/lib/paiementGainService';
import { isSupabaseAuthError } from '@/lib/guichetiereSpace';

const DEFAULT_FORM_DATA = {
  montantGain: '',
  numeroCourse: '',
  typePari: '',
  regionPaiementSouhaitee: '',
  agenceSouhaiteeNom: '',
  directeurRegionalId: '',
  dateReunionCourse: '',
  dateCourse: '',
  nomGagnant: '',
  prenomGagnant: '',
  secteurResidence: '',
  provinceResidence: '',
  numeroPieceIdentite: '',
  dateEtablissementPiece: '',
  autoritePieceIdentite: '',
  numeroTicketGagnant: '',
};

const ALL_FILTER_VALUE = '__all__';
const sortDemandesByUpdatedAt = (firstDemande, secondDemande) =>
  new Date(secondDemande?.updated_at || secondDemande?.created_at || 0) -
  new Date(firstDemande?.updated_at || firstDemande?.created_at || 0);

const notifyPaiementGainLoadError = (toast, error, title, description) => {
  if (isSupabaseAuthError(error)) return;

  toast({
    title,
    description,
    variant: 'destructive',
  });
};

const PaiementGrosGainPage = () => {
  const location = useLocation();
  const { toast } = useToast();
  const storedAuth = JSON.parse(localStorage.getItem('pmuChefAuth') || '{}');
  const chefInfo = storedAuth.chefInfo || null;
  const isChefAgenceWorkspace = location.pathname.startsWith('/espace-chef-agence/');

  const [agences, setAgences] = useState([]);
  const [regions, setRegions] = useState([]);
  const [validateurs, setValidateurs] = useState([]);
  const [workflowConfigs, setWorkflowConfigs] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [chefDecisionComment, setChefDecisionComment] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [ownDemandesSearchTerm, setOwnDemandesSearchTerm] = usePageState('paiement-gros-gain', 'ownSearch', '');
  const [ownDemandesStatusFilter, setOwnDemandesStatusFilter] = usePageState('paiement-gros-gain', 'ownStatus', ALL_FILTER_VALUE);
  const [agencyDemandesSearchTerm, setAgencyDemandesSearchTerm] = usePageState('paiement-gros-gain', 'agencySearch', '');
  const [agencyDemandesStatusFilter, setAgencyDemandesStatusFilter] = usePageState('paiement-gros-gain', 'agencyStatus', ALL_FILTER_VALUE);
  const [chefTab, setChefTab] = usePageState('paiement-gros-gain', 'chefTab', 'pending');
  const [userTab, setUserTab] = usePageState('paiement-gros-gain', 'userTab', 'demande');
  const [selectedOwnDemandeId, setSelectedOwnDemandeId] = useState(null);
  const [selectedAgencyDemandeId, setSelectedAgencyDemandeId] = useState(null);
  const [selectedChefActionDemandeId, setSelectedChefActionDemandeId] = useState(null);
  const [selectedPaymentDemandeId, setSelectedPaymentDemandeId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChefDecisionLoading, setIsChefDecisionLoading] = useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!chefInfo?.id) return;

    setIsLoading(true);

    const [
      { data: agencesData, error: agencesError },
      { data: regionsData, error: regionsError },
      { data: validateursData, error: validateursError },
      { data: workflowConfigData, error: workflowConfigError, isMissingTable: workflowConfigMissingTable },
      { data: demandesData, error: demandesError },
      { data: eventsData, error: eventsError },
    ] = await Promise.all([
      supabase.from('agences').select('*').eq('is_current', true).order('nom', { ascending: true }),
      fetchRegions(),
      supabase.from('validateurs_paiement_gain').select('*').eq('statut', 'Actif').order('nom', { ascending: true }),
      fetchPaiementGainWorkflowConfigs(),
      supabase.from('demandes_paiement_gain').select('*').order('updated_at', { ascending: false }),
      supabase.from('paiement_gain_workflow_events').select('*').order('created_at', { ascending: false }),
    ]);

    if (agencesError) {
      notifyPaiementGainLoadError(
        toast,
        agencesError,
        'Agences indisponibles',
        'Impossible de charger la liste des agences. Veuillez réessayer plus tard.'
      );
    } else {
      setAgences(agencesData || []);
    }

    if (regionsError) {
      notifyPaiementGainLoadError(
        toast,
        regionsError,
        'Régions indisponibles',
        'Impossible de charger la liste des régions. Veuillez réessayer plus tard.'
      );
    } else {
      setRegions(regionsData || []);
    }

    if (validateursError) {
      notifyPaiementGainLoadError(
        toast,
        validateursError,
        'Validateurs indisponibles',
        'Impossible de charger les validateurs de paiement. Veuillez réessayer plus tard.'
      );
    } else {
      setValidateurs(validateursData || []);
    }

    if (workflowConfigError && !workflowConfigMissingTable && !isSupabaseAuthError(workflowConfigError)) {
      toast({
        title: 'Configuration workflows indisponible',
        description: 'Les règles standards de paiement gros gain sont utilisées temporairement. Veuillez réessayer plus tard.',
        variant: 'destructive',
      });
    }
    setWorkflowConfigs(workflowConfigData || []);

    if (demandesError) {
      setDemandes([]);
      notifyPaiementGainLoadError(
        toast,
        demandesError,
        'Demandes indisponibles',
        'Impossible de charger les demandes de paiement. Veuillez réessayer plus tard.'
      );
    } else {
      setDemandes(demandesData || []);
    }

    if (eventsError) {
      setEvents([]);
      if (isSupabaseAuthError(eventsError)) {
        setIsLoading(false);
        return;
      }
      notifyPaiementGainLoadError(
        toast,
        eventsError,
        'Historique indisponible',
        'Impossible de charger l’historique des validations. Veuillez réessayer plus tard.'
      );
    } else {
      setEvents(eventsData || []);
    }

    setIsLoading(false);
  }, [chefInfo?.id, toast]);

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, 15000);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  const currentAgency = useMemo(
    () =>
      agences.find((agence) => normalizeText(agence.nom) === normalizeText(chefInfo?.nomAgence)) || null,
    [agences, chefInfo?.nomAgence]
  );

  const connectedAgencyName = currentAgency?.nom || chefInfo?.nomAgence || 'Agence non renseignée';
  const connectedAgencyRegion = currentAgency?.region || 'Région non renseignée';
  const connectedAgencyCodePdv = currentAgency?.codePDV || null;

  const regionalValidators = useMemo(
    () => validateurs.filter((validateur) => validateur.fonction === VALIDATOR_FUNCTIONS.REGIONAL),
    [validateurs]
  );

  const generalValidators = useMemo(
    () => validateurs.filter((validateur) => validateur.fonction === VALIDATOR_FUNCTIONS.GENERAL),
    [validateurs]
  );

  const regionOptions = useMemo(
    () => buildRegionOptions(regions, { currentValue: formData.regionPaiementSouhaitee }),
    [formData.regionPaiementSouhaitee, regions]
  );

  const desiredAgencyOptions = useMemo(
    () =>
      agences
        .filter(
          (agence) =>
            !formData.regionPaiementSouhaitee ||
            normalizeText(agence.region) === normalizeText(formData.regionPaiementSouhaitee)
        )
        .map((agence) => ({
          value: agence.nom,
          label: `${agence.nom}${agence.codePDV ? ` • ${agence.codePDV}` : ''}`,
        })),
    [agences, formData.regionPaiementSouhaitee]
  );

  const filteredRegionalValidators = useMemo(
    () =>
      regionalValidators.filter(
        (validateur) =>
          !formData.regionPaiementSouhaitee ||
          normalizeText(validateur.regionAssignee) === normalizeText(formData.regionPaiementSouhaitee)
      ),
    [formData.regionPaiementSouhaitee, regionalValidators]
  );

  const regionalValidatorOptions = useMemo(
    () =>
      filteredRegionalValidators.map((validateur) => ({
        value: String(validateur.id),
        label: `${validateur.prenom} ${validateur.nom} • ${validateur.regionAssignee || 'Sans région'}`,
      })),
    [filteredRegionalValidators]
  );

  const selectedProcedure = useMemo(
    () => resolveProcedureForAmount(Number(formData.montantGain), workflowConfigs),
    [formData.montantGain, workflowConfigs]
  );

  const selectedRegionalValidator = useMemo(
    () => regionalValidators.find((validateur) => String(validateur.id) === String(formData.directeurRegionalId)) || null,
    [formData.directeurRegionalId, regionalValidators]
  );

  const selectedDesiredAgency = useMemo(
    () => agences.find((agence) => normalizeText(agence.nom) === normalizeText(formData.agenceSouhaiteeNom)) || null,
    [agences, formData.agenceSouhaiteeNom]
  );

  const selectedGeneralValidator = useMemo(() => generalValidators[0] || null, [generalValidators]);

  const ownDemandes = useMemo(
    () =>
      demandes.filter(
        (demande) =>
          String(demande.chefAgenceId ?? '') === String(chefInfo?.id ?? '') ||
          String(demande.chefAgenceMatricule ?? '') === String(chefInfo?.matricule ?? '')
      ),
    [chefInfo?.id, chefInfo?.matricule, demandes]
  );

  const matchesConnectedAgency = useCallback(
    (demande) => {
      const demandeAgenceNom = normalizeText(demande?.agencePaiementNom);
      const connectedAgenceNom = normalizeText(connectedAgencyName);
      const demandeAgenceCodePdv = String(demande?.agencePaiementCodePDV ?? '').trim();
      const connectedAgenceCodePdv = String(connectedAgencyCodePdv ?? '').trim();

      if (connectedAgenceCodePdv && demandeAgenceCodePdv && demandeAgenceCodePdv === connectedAgenceCodePdv) {
        return true;
      }

      return Boolean(connectedAgenceNom) && demandeAgenceNom === connectedAgenceNom;
    },
    [connectedAgencyCodePdv, connectedAgencyName]
  );

  const authorizedDemandes = useMemo(
    () =>
      demandes.filter(
        (demande) =>
          matchesConnectedAgency(demande) &&
          demande.statutGlobal === DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT
      ),
    [demandes, matchesConnectedAgency]
  );

  const chefValidationDemandes = useMemo(
    () => [...ownDemandes].filter((demande) => isChefApprovalPending(demande)).sort(sortDemandesByUpdatedAt),
    [ownDemandes]
  );

  const chefActionDemandes = useMemo(() => {
    const demandeMap = new Map();

    [...chefValidationDemandes, ...authorizedDemandes].forEach((demande) => {
      demandeMap.set(String(demande.id), demande);
    });

    return Array.from(demandeMap.values()).sort(sortDemandesByUpdatedAt);
  }, [authorizedDemandes, chefValidationDemandes]);

  const paidDemandes = useMemo(
    () =>
      demandes.filter(
        (demande) => matchesConnectedAgency(demande) && demande.statutGlobal === DEMANDE_STATUSES.PAID
      ),
    [demandes, matchesConnectedAgency]
  );

  const agencyDemandes = useMemo(
    () => demandes.filter((demande) => matchesConnectedAgency(demande)),
    [demandes, matchesConnectedAgency]
  );

  const chefWorkspaceHistoryDemandes = useMemo(() => {
    const demandeMap = new Map();

    [...ownDemandes, ...agencyDemandes].forEach((demande) => {
      demandeMap.set(String(demande.id), demande);
    });

    return Array.from(demandeMap.values()).sort(sortDemandesByUpdatedAt);
  }, [agencyDemandes, ownDemandes]);

  const historyDemandes = useMemo(
    () => (isChefAgenceWorkspace ? chefWorkspaceHistoryDemandes : agencyDemandes),
    [agencyDemandes, chefWorkspaceHistoryDemandes, isChefAgenceWorkspace]
  );

  const filteredOwnDemandes = useMemo(
    () =>
      ownDemandes
        .filter((demande) => ownDemandesStatusFilter === ALL_FILTER_VALUE || getEffectiveDemandeStatus(demande) === ownDemandesStatusFilter)
        .filter((demande) =>
          [
            demande.codeDemande,
            demande.nomGagnant,
            demande.prenomGagnant,
            demande.numeroTicketGagnant,
            getEffectiveDemandeStatus(demande),
            demande.agencePaiementNom,
          ].some((value) => String(value ?? '').toLowerCase().includes(ownDemandesSearchTerm.toLowerCase()))
        ),
    [ownDemandes, ownDemandesSearchTerm, ownDemandesStatusFilter]
  );

  const filteredAgencyDemandes = useMemo(
    () =>
      historyDemandes
        .filter((demande) => agencyDemandesStatusFilter === ALL_FILTER_VALUE || getEffectiveDemandeStatus(demande) === agencyDemandesStatusFilter)
        .filter((demande) =>
          [
            demande.codeDemande,
            demande.nomGagnant,
            demande.prenomGagnant,
            demande.numeroTicketGagnant,
            getEffectiveDemandeStatus(demande),
            demande.agenceOrigineNom,
            demande.agencePaiementNom,
            demande.localitePaiementSouhaitee,
          ].some((value) => String(value ?? '').toLowerCase().includes(agencyDemandesSearchTerm.toLowerCase()))
        ),
    [historyDemandes, agencyDemandesSearchTerm, agencyDemandesStatusFilter]
  );

  useEffect(() => {
    if (!selectedOwnDemandeId && filteredOwnDemandes.length > 0) {
      setSelectedOwnDemandeId(filteredOwnDemandes[0].id);
      return;
    }

    const stillExists = filteredOwnDemandes.some((demande) => String(demande.id) === String(selectedOwnDemandeId));
    if (selectedOwnDemandeId && !stillExists) {
      setSelectedOwnDemandeId(filteredOwnDemandes[0]?.id || null);
    }
  }, [filteredOwnDemandes, selectedOwnDemandeId]);

  useEffect(() => {
    if (!selectedChefActionDemandeId && chefActionDemandes.length > 0) {
      setSelectedChefActionDemandeId(chefActionDemandes[0].id);
      return;
    }

    const stillExists = chefActionDemandes.some((demande) => String(demande.id) === String(selectedChefActionDemandeId));
    if (selectedChefActionDemandeId && !stillExists) {
      setSelectedChefActionDemandeId(chefActionDemandes[0]?.id || null);
    }
  }, [chefActionDemandes, selectedChefActionDemandeId]);

  useEffect(() => {
    if (!selectedPaymentDemandeId && authorizedDemandes.length > 0) {
      setSelectedPaymentDemandeId(authorizedDemandes[0].id);
      return;
    }

    const stillExists = authorizedDemandes.some((demande) => String(demande.id) === String(selectedPaymentDemandeId));
    if (selectedPaymentDemandeId && !stillExists) {
      setSelectedPaymentDemandeId(authorizedDemandes[0]?.id || null);
    }
  }, [authorizedDemandes, selectedPaymentDemandeId]);

  useEffect(() => {
    if (!selectedAgencyDemandeId && filteredAgencyDemandes.length > 0) {
      setSelectedAgencyDemandeId(filteredAgencyDemandes[0].id);
      return;
    }

    const stillExists = filteredAgencyDemandes.some((demande) => String(demande.id) === String(selectedAgencyDemandeId));
    if (selectedAgencyDemandeId && !stillExists) {
      setSelectedAgencyDemandeId(filteredAgencyDemandes[0]?.id || null);
    }
  }, [filteredAgencyDemandes, selectedAgencyDemandeId]);

  const selectedOwnDemande =
    filteredOwnDemandes.find((demande) => String(demande.id) === String(selectedOwnDemandeId)) || null;
  const selectedChefActionDemande =
    chefActionDemandes.find((demande) => String(demande.id) === String(selectedChefActionDemandeId)) || null;
  const selectedAgencyDemande =
    filteredAgencyDemandes.find((demande) => String(demande.id) === String(selectedAgencyDemandeId)) || null;
  const selectedPaymentDemande =
    authorizedDemandes.find((demande) => String(demande.id) === String(selectedPaymentDemandeId)) || null;

  const selectedOwnDemandeEvents = useMemo(
    () =>
      events
        .filter((event) => String(event.demandeId ?? '') === String(selectedOwnDemande?.id ?? ''))
        .sort((firstEvent, secondEvent) => new Date(secondEvent.created_at) - new Date(firstEvent.created_at)),
    [events, selectedOwnDemande?.id]
  );

  const selectedPaymentDemandeEvents = useMemo(
    () =>
      events
        .filter((event) => String(event.demandeId ?? '') === String(selectedPaymentDemande?.id ?? ''))
        .sort((firstEvent, secondEvent) => new Date(secondEvent.created_at) - new Date(firstEvent.created_at)),
    [events, selectedPaymentDemande?.id]
  );

  useEffect(() => {
    setChefDecisionComment('');
  }, [selectedOwnDemande?.id, selectedChefActionDemande?.id]);

  useEffect(() => {
    setPaymentComment('');
  }, [selectedPaymentDemande?.id, selectedChefActionDemande?.id]);

  const selectedChefActionDemandeEvents = useMemo(
    () =>
      events
        .filter((event) => String(event.demandeId ?? '') === String(selectedChefActionDemande?.id ?? ''))
        .sort((firstEvent, secondEvent) => new Date(secondEvent.created_at) - new Date(firstEvent.created_at)),
    [events, selectedChefActionDemande?.id]
  );

  const selectedAgencyDemandeEvents = useMemo(
    () =>
      events
        .filter((event) => String(event.demandeId ?? '') === String(selectedAgencyDemande?.id ?? ''))
        .sort((firstEvent, secondEvent) => new Date(secondEvent.created_at) - new Date(firstEvent.created_at)),
    [events, selectedAgencyDemande?.id]
  );

  const selectedOwnDemandeAwaitingChefDecision = isChefApprovalPending(selectedOwnDemande);
  const selectedChefActionDemandeAwaitingChefDecision = isChefApprovalPending(selectedChefActionDemande);
  const selectedChefActionDemandeAwaitingPayment =
    Boolean(selectedChefActionDemande) &&
    selectedChefActionDemande.statutGlobal === DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT &&
    matchesConnectedAgency(selectedChefActionDemande);

  const handleFormFieldChange = (fieldName, fieldValue) => {
    setFormData((previousData) => {
      const updatedFormData = {
        ...previousData,
        [fieldName]: fieldValue,
      };

      if (fieldName === 'regionPaiementSouhaitee') {
        if (normalizeText(previousData.regionPaiementSouhaitee) !== normalizeText(fieldValue)) {
          updatedFormData.agenceSouhaiteeNom = '';
          updatedFormData.directeurRegionalId = '';
        }
      }

      return updatedFormData;
    });
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmitDemande = async () => {
    if (!chefInfo?.id) {
      toast({
        title: 'Chef non identifié',
        description: 'Veuillez vous reconnecter à votre espace chef d’agence.',
        variant: 'destructive',
      });
      return;
    }

    const montantGain = Number(formData.montantGain);
    const procedure = resolveProcedureForAmount(montantGain, workflowConfigs);

    if (!procedure || !Number.isFinite(montantGain) || montantGain <= 0) {
      toast({
        title: 'Montant invalide',
        description: 'Veuillez saisir un montant de gain valide.',
        variant: 'destructive',
      });
      return;
    }

    if (procedure.identificationRequired) {
      const requiredFields = [
        formData.numeroCourse,
        formData.typePari,
        formData.regionPaiementSouhaitee,
        formData.agenceSouhaiteeNom,
        formData.dateReunionCourse,
        formData.dateCourse,
        formData.nomGagnant,
        formData.prenomGagnant,
        formData.secteurResidence,
        formData.provinceResidence,
        formData.numeroPieceIdentite,
        formData.dateEtablissementPiece,
        formData.autoritePieceIdentite,
        formData.numeroTicketGagnant,
      ];

      if (requiredFields.some((value) => !String(value ?? '').trim())) {
        toast({
          title: 'Informations incomplètes',
          description:
            'Veuillez compléter tous les champs d’identification du gagnant, de course, de région et d’agence souhaitée avant envoi.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (procedure.requiresRegionalApproval && !selectedRegionalValidator) {
      toast({
        title: 'Validateur régional requis',
        description: 'Veuillez sélectionner le directeur régional lié à la localité souhaitée.',
        variant: 'destructive',
      });
      return;
    }

    if (procedure.requiresGeneralApproval && !selectedGeneralValidator) {
      toast({
        title: 'Direction générale absente',
        description: 'Aucun profil actif de directeur général n’est disponible pour ce workflow.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const codeDemande = generateDemandeCode();
    let photoPieceUrl = null;

    if (photoFile) {
      const { data: uploadedUrl, error: uploadError } = await uploadPaiementGainIdentityPhoto(photoFile, codeDemande);

      if (uploadError) {
        toast({
          title: 'Erreur pièce d’identité',
          description: uploadError.message,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      photoPieceUrl = uploadedUrl;
    }

    const directeurRegionalName =
      procedure.requiresRegionalApproval && selectedRegionalValidator
        ? buildFullName(selectedRegionalValidator.prenom, selectedRegionalValidator.nom)
        : null;
    const directeurGeneralName =
      procedure.requiresGeneralApproval && selectedGeneralValidator
        ? buildFullName(selectedGeneralValidator.prenom, selectedGeneralValidator.nom)
        : null;

    const waitingChefApproval = procedure.requiresChefApproval;
    const initialComment = waitingChefApproval
      ? 'Demande créée et en attente de validation du chef d’agence.'
      : 'Demande créée et transmise dans le circuit de validation.';

    const payload = {
      codeDemande,
      montantGain,
      montantTranche: procedure.trancheLabel,
      procedureResume: buildProcedureSummary(procedure),
      modePaiement: procedure.modePaiement,
      lieuPaiement: procedure.lieuPaiement,
      identificationRequise: procedure.identificationRequired,
      numeroCourse: formData.numeroCourse.trim() || null,
      typePari: formData.typePari.trim() || null,
      localitePaiementSouhaitee: selectedDesiredAgency?.nom || formData.agenceSouhaiteeNom.trim() || null,
      directeurRegionalId: procedure.requiresRegionalApproval
        ? normalizeBigIntIdentifier(selectedRegionalValidator?.id)
        : null,
      directeurRegionalName,
      directeurRegionalRegion: procedure.requiresRegionalApproval
        ? formData.regionPaiementSouhaitee || selectedRegionalValidator?.regionAssignee || null
        : null,
      directeurGeneralId: procedure.requiresGeneralApproval
        ? normalizeBigIntIdentifier(selectedGeneralValidator?.id)
        : null,
      directeurGeneralName,
      dateReunionCourse: formData.dateReunionCourse || null,
      dateCourse: formData.dateCourse || null,
      nomGagnant: formData.nomGagnant.trim() || null,
      prenomGagnant: formData.prenomGagnant.trim() || null,
      secteurResidence: formData.secteurResidence.trim() || null,
      provinceResidence: formData.provinceResidence.trim() || null,
      numeroPieceIdentite: formData.numeroPieceIdentite.trim() || null,
      dateEtablissementPiece: formData.dateEtablissementPiece || null,
      autoritePieceIdentite: formData.autoritePieceIdentite.trim() || null,
      numeroTicketGagnant: formData.numeroTicketGagnant.trim() || null,
      photoPieceUrl,
      chefAgenceId: normalizeBigIntIdentifier(chefInfo.id),
      chefAgenceMatricule: chefInfo.matricule || null,
      chefAgenceNom: chefInfo.nomChef || null,
      agenceOrigineNom: chefInfo.nomAgence || null,
      agenceOrigineCodePDV: currentAgency?.codePDV || null,
      regionOrigine: currentAgency?.region || null,
      statutGlobal: procedure.initialStatus,
      niveauValidationCourant: procedure.initialStage,
      circuitValidation: procedure.circuit.join(' > '),
      dateValidationChef: null,
      commentaireDerniereAction: initialComment,
    };

    const { data: insertedDemande, error: insertError } = await supabase
      .from('demandes_paiement_gain')
      .insert(payload)
      .select('*')
      .single();

    if (insertError || !insertedDemande) {
      toast({
        title: "Erreur d'enregistrement",
        description: insertError?.message || 'Impossible de créer la demande.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    await recordPaiementGainEvent({
      demandeId: insertedDemande.id,
      codeDemande,
      actionType: waitingChefApproval ? 'creation_demande' : 'soumission_demande',
      actorType: 'chef_agence',
      actorId: chefInfo.id,
      actorName: chefInfo.nomChef || 'Chef d’agence',
      actorFunction: 'Chef d’agence',
      statusBefore: null,
      statusAfter: payload.statutGlobal,
      commentaire: initialComment,
    });

    toast({
      title: 'Demande envoyée',
      description: waitingChefApproval
        ? `La demande ${codeDemande} a été créée et attend maintenant la validation du chef d’agence.`
        : `La demande ${codeDemande} a été créée et transmise dans le circuit de validation.`,
      className: 'bg-green-500 text-white',
    });

    resetForm();
    await loadData();
    setIsSubmitting(false);
  };

  const getNextStepAfterChefApproval = (demande) => {
    const circuitValidation = String(demande?.circuitValidation ?? '');

    if (circuitValidation.includes(VALIDATOR_FUNCTIONS.REGIONAL)) {
      return {
        nextStatus: DEMANDE_STATUSES.PENDING_REGIONAL,
        nextStage: WORKFLOW_STAGES.REGIONAL,
        nextLabel: 'directeur régional',
      };
    }

    if (circuitValidation.includes(VALIDATOR_FUNCTIONS.GENERAL)) {
      return {
        nextStatus: DEMANDE_STATUSES.PENDING_GENERAL,
        nextStage: WORKFLOW_STAGES.GENERAL,
        nextLabel: 'directeur général',
      };
    }

    return {
      nextStatus: DEMANDE_STATUSES.PENDING_EXPLOITATION,
      nextStage: WORKFLOW_STAGES.EXPLOITATION,
      nextLabel: 'Exploitation',
    };
  };

  const handleChefDecision = async (decision) => {
    const demandeToHandle = isChefAgenceWorkspace ? selectedChefActionDemande : selectedOwnDemande;
    if (!demandeToHandle || !chefInfo?.id) return;

    setIsChefDecisionLoading(true);

    const statusBefore = demandeToHandle.statutGlobal;
    const updates = {
      commentaireDerniereAction:
        chefDecisionComment.trim() ||
        (decision === 'approve'
          ? 'Demande validée par le chef d’agence.'
          : 'Demande refusée par le chef d’agence.'),
    };

    let nextLabel = 'circuit suivant';

    if (decision === 'approve') {
      const nextStep = getNextStepAfterChefApproval(demandeToHandle);
      updates.dateValidationChef = new Date().toISOString();
      updates.statutGlobal = nextStep.nextStatus;
      updates.niveauValidationCourant = nextStep.nextStage;
      nextLabel = nextStep.nextLabel;
    } else {
      updates.statutGlobal = DEMANDE_STATUSES.REJECTED;
      updates.niveauValidationCourant = WORKFLOW_STAGES.DONE;
    }

    const { error: updateError } = await supabase
      .from('demandes_paiement_gain')
      .update(updates)
      .eq('id', demandeToHandle.id);

    if (updateError) {
      toast({
        title: 'Action impossible',
        description: updateError.message,
        variant: 'destructive',
      });
      setIsChefDecisionLoading(false);
      return;
    }

    await recordPaiementGainEvent({
      demandeId: demandeToHandle.id,
      codeDemande: demandeToHandle.codeDemande,
      actionType: decision === 'approve' ? 'validation_chef' : 'rejet_chef',
      actorType: WORKFLOW_STAGES.CHEF,
      actorId: chefInfo.id,
      actorName: chefInfo.nomChef || 'Chef d’agence',
      actorFunction: 'Chef d’agence',
      statusBefore,
      statusAfter: updates.statutGlobal,
      commentaire: updates.commentaireDerniereAction,
    });

    toast({
      title: decision === 'approve' ? 'Demande validée' : 'Demande refusée',
      description:
        decision === 'approve'
          ? `La demande ${demandeToHandle.codeDemande} a été transmise au ${nextLabel}.`
          : `La demande ${demandeToHandle.codeDemande} a été refusée par le chef d’agence.`,
      className: decision === 'approve' ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
    });

    setChefDecisionComment('');
    await loadData();
    setIsChefDecisionLoading(false);
  };

  const handleConfirmPayment = async () => {
    const demandeToPay = isChefAgenceWorkspace ? selectedChefActionDemande : selectedPaymentDemande;
    if (!demandeToPay || !chefInfo?.id) return;

    setIsPaymentSubmitting(true);

    const statusBefore = demandeToPay.statutGlobal;
    const updates = {
      statutGlobal: DEMANDE_STATUSES.PAID,
      niveauValidationCourant: WORKFLOW_STAGES.DONE,
      datePaiementFinal: new Date().toISOString(),
      commentaireDerniereAction: paymentComment.trim() || 'Paiement confirmé par le chef d’agence.',
    };

    const { error: updateError } = await supabase
      .from('demandes_paiement_gain')
      .update(updates)
      .eq('id', demandeToPay.id);

    if (updateError) {
      toast({
        title: 'Paiement non confirmé',
        description: updateError.message,
        variant: 'destructive',
      });
      setIsPaymentSubmitting(false);
      return;
    }

    await recordPaiementGainEvent({
      demandeId: demandeToPay.id,
      codeDemande: demandeToPay.codeDemande,
      actionType: 'paiement_final',
      actorType: WORKFLOW_STAGES.AGENCY_PAYMENT,
      actorId: chefInfo.id,
      actorName: chefInfo.nomChef || 'Chef d’agence',
      actorFunction: 'Chef d’agence - paiement agence',
      statusBefore,
      statusAfter: DEMANDE_STATUSES.PAID,
      commentaire: paymentComment.trim() || 'Paiement validé en agence.',
    });

    toast({
      title: 'Paiement final validé',
      description: `Le paiement du gain ${demandeToPay.codeDemande} a été confirmé.`,
      className: 'bg-green-500 text-white',
    });

    setPaymentComment('');
    await loadData();
    setIsPaymentSubmitting(false);
  };

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
              {event.statusBefore || 'Création'} {' -> '} {event.statusAfter || 'N/A'}
            </p>
            {event.commentaire ? <p className="mt-2">{event.commentaire}</p> : null}
          </div>
        ))}
      </div>
    );
  };

  const renderDemandeDetailsSections = (demande) => (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Montant</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(demande.montantGain)}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut global</p>
          <Badge variant="outline" className={getStatusBadgeClass(getEffectiveDemandeStatus(demande))}>
            {getEffectiveDemandeStatus(demande)}
          </Badge>
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Etape en cours</p>
          <p className="mt-1 font-medium">{getWorkflowStageLabel(getEffectiveWorkflowStage(demande))}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Agence de paiement</p>
          <p className="mt-1 font-medium">{demande.agencePaiementNom || 'Non attribuee'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Informations du gagnant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Nom :</span> {demande.nomGagnant || 'N/A'}</p>
            <p><span className="font-medium">Prenom :</span> {demande.prenomGagnant || 'N/A'}</p>
            <p><span className="font-medium">Secteur de residence :</span> {demande.secteurResidence || 'N/A'}</p>
            <p><span className="font-medium">Province de residence :</span> {demande.provinceResidence || 'N/A'}</p>
            <p><span className="font-medium">Region souhaitee :</span> {demande.directeurRegionalRegion || 'N/A'}</p>
            <p><span className="font-medium">Agence souhaitee :</span> {demande.localitePaiementSouhaitee || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Informations de course et ticket</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Numero de course :</span> {demande.numeroCourse || 'N/A'}</p>
            <p><span className="font-medium">Type de pari :</span> {demande.typePari || 'N/A'}</p>
            <p><span className="font-medium">Date de reunion :</span> {formatDisplayDate(demande.dateReunionCourse)}</p>
            <p><span className="font-medium">Date de course :</span> {formatDisplayDate(demande.dateCourse)}</p>
            <p><span className="font-medium">Numero du ticket gagnant :</span> {demande.numeroTicketGagnant || 'N/A'}</p>
            <p><span className="font-medium">Procedure :</span> {demande.procedureResume || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Piece d'identite et paiement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Numero de piece :</span> {demande.numeroPieceIdentite || 'N/A'}</p>
            <p><span className="font-medium">Date d'etablissement :</span> {formatDisplayDate(demande.dateEtablissementPiece)}</p>
            <p><span className="font-medium">Autorite :</span> {demande.autoritePieceIdentite || 'N/A'}</p>
            <p><span className="font-medium">Mode de paiement :</span> {demande.modePaiement || 'N/A'}</p>
            <p><span className="font-medium">Lieu de paiement :</span> {demande.lieuPaiement || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Agences et validation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Chef d'agence :</span> {demande.chefAgenceNom || 'N/A'}</p>
            <p><span className="font-medium">Agence source :</span> {demande.agenceOrigineNom || 'N/A'}</p>
            <p><span className="font-medium">Code PDV source :</span> {demande.agenceOrigineCodePDV || 'N/A'}</p>
            <p><span className="font-medium">Agence de paiement :</span> {demande.agencePaiementNom || 'Non attribuee'}</p>
            <p><span className="font-medium">Code PDV paiement :</span> {demande.agencePaiementCodePDV || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-primary">Dates de validation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <p><span className="font-medium">Validation chef d'agence :</span> {formatDisplayDateTime(demande.dateValidationChef)}</p>
          <p><span className="font-medium">Validation directeur regional :</span> {formatDisplayDateTime(demande.dateValidationDirecteurRegional)}</p>
          <p><span className="font-medium">Validation directeur general :</span> {formatDisplayDateTime(demande.dateValidationDirecteurGeneral)}</p>
          <p><span className="font-medium">Autorisation exploitation :</span> {formatDisplayDateTime(demande.dateAutorisationExploitation)}</p>
          <p><span className="font-medium">Paiement final :</span> {formatDisplayDateTime(demande.datePaiementFinal)}</p>
        </CardContent>
      </Card>

      {demande.photoPieceUrl && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Piece d'identite jointe</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={demande.photoPieceUrl}
              alt="Piece d'identite"
              className="max-h-80 rounded-xl border object-contain"
            />
          </CardContent>
        </Card>
      )}
    </>
  );

  if (!chefInfo?.id) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
        <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <CardHeader>
            <CardTitle className="text-3xl text-primary">Paiement Gros Gain</CardTitle>
            <CardDescription>
              Cet espace est accessible une fois connecté à votre espace Chef d’agence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Connectez-vous d’abord avec votre matricule et votre mot de passe chef d’agence, puis revenez ici pour créer les demandes et finaliser les paiements autorisés.
            </p>
            <Button asChild className="bg-gradient-to-r from-primary to-emerald-600 text-white hover:from-primary/90 hover:to-emerald-600/90">
              <Link to="/espace-chef-agence/paiement-gros-gain">
                <LogIn className="mr-2 h-4 w-4" />
                Accéder à l’espace Chef d’agence
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader>
          <div>
            <CardTitle className="flex items-center text-3xl font-bold text-primary">
              <Wallet className="mr-3 h-7 w-7" />
              Paiement Gros Gain
            </CardTitle>
            <CardDescription>
              Agence connectée : <span className="font-medium text-foreground">{connectedAgencyName}</span>
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiStatCard
          icon={FileText}
          label={isChefAgenceWorkspace ? 'Demandes suivies' : 'Demandes créées'}
          value={isChefAgenceWorkspace ? chefWorkspaceHistoryDemandes.length : ownDemandes.length}
          helper={
            isChefAgenceWorkspace
              ? "Demandes liées à l'agence du chef d’agence."
              : 'Historique personnel des demandes saisies.'
          }
          tone="primary"
        />
        <KpiStatCard
          icon={Clock3}
          label={isChefAgenceWorkspace ? 'Demandes à traiter' : 'Autorisations à payer'}
          value={isChefAgenceWorkspace ? chefActionDemandes.length : authorizedDemandes.length}
          helper={
            isChefAgenceWorkspace
              ? 'Demandes en attente de validation ou de paiement final.'
              : 'Autorisations validées encore en attente de règlement.'
          }
          tone="amber"
        />
        <KpiStatCard
          icon={CheckCircle2}
          label="Paiements finalisés"
          value={paidDemandes.length}
          helper="Demandes définitivement payées et clôturées."
          tone="emerald"
        />
      </div>

      {isChefAgenceWorkspace ? (
        <Tabs value={chefTab} onValueChange={setChefTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Demandes à traiter</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <Card className="shadow-xl glassmorphism">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Demandes à traiter par le chef d’agence</CardTitle>
                <CardDescription>
                  Les demandes en attente de validation du chef d’agence et les autorisations prêtes pour paiement final sont regroupées ici.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableCaption>
                    {chefActionDemandes.length === 0
                      ? 'Aucune demande n’attend actuellement une action du chef d’agence.'
                      : `${chefActionDemandes.length} demande(s) en attente de traitement.`}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Gagnant</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Etape</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Action requise</TableHead>
                      <TableHead>Mise à jour</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chefActionDemandes.map((demande, index) => (
                      <motion.tr
                        key={demande.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                          String(selectedChefActionDemandeId) === String(demande.id) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedChefActionDemandeId(demande.id)}
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
                        <TableCell>
                          {isChefApprovalPending(demande) ? 'Validation du chef' : 'Paiement final en agence'}
                        </TableCell>
                        <TableCell>{formatDisplayDateTime(demande.updated_at)}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedChefActionDemande && (
              <Card className="shadow-xl glassmorphism">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">
                    Traitement de la demande {selectedChefActionDemande.codeDemande}
                  </CardTitle>
                  <CardDescription>
                    {selectedChefActionDemandeAwaitingChefDecision
                      ? 'Cette demande attend votre validation avant transmission à l’étape suivante du workflow.'
                      : selectedChefActionDemandeAwaitingPayment
                        ? 'Cette demande a terminé le circuit de validation et attend maintenant votre confirmation de paiement.'
                        : 'Consultez le détail complet de la demande et son historique.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {renderDemandeDetailsSections(selectedChefActionDemande)}

                  {selectedChefActionDemandeAwaitingChefDecision && (
                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg text-primary">Validation du chef d’agence</CardTitle>
                        <CardDescription>
                          Contrôlez la demande puis validez-la ou refusez-la avant transmission au validateur suivant.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Commentaire de validation</Label>
                          <Textarea
                            rows={4}
                            value={chefDecisionComment}
                            onChange={(event) => setChefDecisionComment(event.target.value)}
                            placeholder="Ajoutez un commentaire de validation ou de refus si nécessaire."
                            disabled={isChefDecisionLoading}
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={() => handleChefDecision('approve')}
                            disabled={isChefDecisionLoading}
                            className="bg-green-600 text-white hover:bg-green-700"
                          >
                            {isChefDecisionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Valider et transmettre
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleChefDecision('reject')}
                            disabled={isChefDecisionLoading}
                          >
                            Refuser la demande
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {selectedChefActionDemandeAwaitingPayment && (
                    <>
                      <div className="space-y-2">
                        <Label>Commentaire de paiement</Label>
                        <Textarea
                          rows={4}
                          value={paymentComment}
                          onChange={(event) => setPaymentComment(event.target.value)}
                          placeholder="Commentaire ou référence interne de paiement."
                          disabled={isPaymentSubmitting}
                        />
                      </div>

                      <Button
                        onClick={handleConfirmPayment}
                        disabled={isPaymentSubmitting}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        {isPaymentSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirmer le paiement final
                      </Button>
                    </>
                  )}

                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">Historique du workflow</CardTitle>
                    </CardHeader>
                    <CardContent>{renderWorkflowEvents(selectedChefActionDemandeEvents)}</CardContent>
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
                    <CardTitle className="text-2xl text-primary">Historique des demandes d’autorisation</CardTitle>
                    <CardDescription>
                      Retrouvez toutes les demandes affectées à votre agence, leur statut et leur progression.
                    </CardDescription>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),220px] lg:w-[720px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={agencyDemandesSearchTerm}
                        onChange={(event) => setAgencyDemandesSearchTerm(event.target.value)}
                        placeholder="Rechercher par code, gagnant, ticket ou agence..."
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>

                    <Select value={agencyDemandesStatusFilter} onValueChange={setAgencyDemandesStatusFilter} disabled={isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les statuts" />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>Tous les statuts</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_CHEF}>{DEMANDE_STATUSES.PENDING_CHEF}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_REGIONAL}>{DEMANDE_STATUSES.PENDING_REGIONAL}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_GENERAL}>{DEMANDE_STATUSES.PENDING_GENERAL}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_EXPLOITATION}>{DEMANDE_STATUSES.PENDING_EXPLOITATION}</SelectItem>
                        <SelectItem value={DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT}>{DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT}</SelectItem>
                        <SelectItem value={DEMANDE_STATUSES.PAID}>{DEMANDE_STATUSES.PAID}</SelectItem>
                        <SelectItem value={DEMANDE_STATUSES.REJECTED}>{DEMANDE_STATUSES.REJECTED}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableCaption>
                    {historyDemandes.length === 0
                      ? 'Aucune demande liée à votre agence n’est encore disponible.'
                      : filteredAgencyDemandes.length === 0
                        ? 'Aucune demande ne correspond aux filtres actuels.'
                        : `${filteredAgencyDemandes.length} demande(s) affichée(s) sur ${historyDemandes.length} liée(s) à votre agence.`}
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
                    {filteredAgencyDemandes.map((demande, index) => (
                      <motion.tr
                        key={demande.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                          String(selectedAgencyDemandeId) === String(demande.id) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedAgencyDemandeId(demande.id)}
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

            {selectedAgencyDemande && (
              <Card className="shadow-xl glassmorphism">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">Suivi de la demande {selectedAgencyDemande.codeDemande}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {renderDemandeDetailsSections(selectedAgencyDemande)}

                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">Historique du workflow</CardTitle>
                    </CardHeader>
                    <CardContent>{renderWorkflowEvents(selectedAgencyDemandeEvents)}</CardContent>
                  </Card>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={userTab} onValueChange={setUserTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="demande">Demande de Paiement de Gain</TabsTrigger>
          <TabsTrigger value="autorisation">Autorisation de Paiement de Gain</TabsTrigger>
        </TabsList>

        <TabsContent value="demande" className="space-y-6">
          <Card className="shadow-xl glassmorphism">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Créer une demande de paiement</CardTitle>
              <CardDescription>
                Le circuit de validation est calculé automatiquement selon le montant du ticket gagnant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label>Veuillez saisir le montant de votre gain</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.montantGain}
                    onChange={(event) => handleFormFieldChange('montantGain', event.target.value)}
                    placeholder="Montant en FCFA"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {selectedProcedure && (
                <div className="grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Tranche</p>
                    <p className="font-medium">{selectedProcedure.trancheLabel}</p>
                    {selectedProcedure.workflowLabel && selectedProcedure.workflowLabel !== selectedProcedure.trancheLabel ? (
                      <p className="mt-1 text-xs text-muted-foreground">{selectedProcedure.workflowLabel}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode de paiement</p>
                    <p className="font-medium">{selectedProcedure.modePaiement}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Lieu de paiement</p>
                    <p className="font-medium">{selectedProcedure.lieuPaiement}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Circuit</p>
                    <p className="font-medium">{selectedProcedure.circuit.join(' -> ')}</p>
                  </div>
                  <div className="lg:col-span-4">
                    <p className="text-sm text-muted-foreground">{selectedProcedure.description}</p>
                  </div>
                </div>
              )}

              {selectedProcedure?.identificationRequired && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Numéro de la course</Label>
                      <Input
                        value={formData.numeroCourse}
                        onChange={(event) => handleFormFieldChange('numeroCourse', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type de pari</Label>
                      <Input
                        value={formData.typePari}
                        onChange={(event) => handleFormFieldChange('typePari', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Région souhaitée</Label>
                      <Combobox
                        options={regionOptions}
                        value={formData.regionPaiementSouhaitee}
                        onSelect={(selectedValue) => handleFormFieldChange('regionPaiementSouhaitee', selectedValue)}
                        placeholder="Sélectionner une région"
                        searchPlaceholder="Rechercher une région..."
                        emptyText="Aucune région disponible."
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Agence souhaitée</Label>
                      <Combobox
                        options={desiredAgencyOptions}
                        value={formData.agenceSouhaiteeNom}
                        onSelect={(selectedValue) => handleFormFieldChange('agenceSouhaiteeNom', selectedValue)}
                        placeholder={
                          formData.regionPaiementSouhaitee
                            ? "Sélectionner une agence"
                            : "Choisir d'abord une région"
                        }
                        searchPlaceholder="Rechercher une agence..."
                        emptyText="Aucune agence disponible pour cette région."
                        disabled={isSubmitting || !formData.regionPaiementSouhaitee}
                      />
                    </div>
                    {selectedProcedure?.requiresRegionalApproval && (
                      <div className="space-y-2">
                        <Label>Directeur régional associé</Label>
                        <Combobox
                          options={regionalValidatorOptions}
                          value={formData.directeurRegionalId}
                          onSelect={(selectedValue) => handleFormFieldChange('directeurRegionalId', selectedValue)}
                          placeholder="Sélectionner un directeur régional"
                          searchPlaceholder="Rechercher un directeur régional..."
                          emptyText="Aucun directeur régional actif pour cette région."
                          disabled={isSubmitting || !formData.regionPaiementSouhaitee}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Date du jour de la réunion</Label>
                      <Input
                        type="date"
                        value={formData.dateReunionCourse}
                        onChange={(event) => handleFormFieldChange('dateReunionCourse', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date de la course</Label>
                      <Input
                        type="date"
                        value={formData.dateCourse}
                        onChange={(event) => handleFormFieldChange('dateCourse', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Numéro du ticket gagnant</Label>
                      <Input
                        value={formData.numeroTicketGagnant}
                        onChange={(event) => handleFormFieldChange('numeroTicketGagnant', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom du gagnant</Label>
                      <Input
                        value={formData.nomGagnant}
                        onChange={(event) => handleFormFieldChange('nomGagnant', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prénom du gagnant</Label>
                      <Input
                        value={formData.prenomGagnant}
                        onChange={(event) => handleFormFieldChange('prenomGagnant', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Secteur de résidence</Label>
                      <Input
                        value={formData.secteurResidence}
                        onChange={(event) => handleFormFieldChange('secteurResidence', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Province de résidence</Label>
                      <Input
                        value={formData.provinceResidence}
                        onChange={(event) => handleFormFieldChange('provinceResidence', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Numéro de la carte d’identité</Label>
                      <Input
                        value={formData.numeroPieceIdentite}
                        onChange={(event) => handleFormFieldChange('numeroPieceIdentite', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date d’établissement de la carte</Label>
                      <Input
                        type="date"
                        value={formData.dateEtablissementPiece}
                        onChange={(event) => handleFormFieldChange('dateEtablissementPiece', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 xl:col-span-3">
                      <Label>Autorité ayant délivré la pièce d’identité</Label>
                      <Input
                        value={formData.autoritePieceIdentite}
                        onChange={(event) => handleFormFieldChange('autoritePieceIdentite', event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Photo de la pièce d’identité
                    </Label>
                    <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} disabled={isSubmitting} />
                    {photoPreview ? (
                      <img src={photoPreview} alt="Prévisualisation pièce" className="max-h-72 rounded-xl border object-contain" />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Vous pouvez importer une image existante ou prendre la photo directement depuis un mobile.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedProcedure?.requiresGeneralApproval && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">Direction générale sollicitée</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedGeneralValidator ? (
                      <p className="text-sm">
                        La demande sera transmise à <span className="font-medium">{selectedGeneralValidator.prenom} {selectedGeneralValidator.nom}</span>.
                      </p>
                    ) : (
                      <p className="text-sm text-red-600">Aucun directeur général actif n’est configuré pour le moment.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSubmitDemande}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-primary to-emerald-600 text-white hover:from-primary/90 hover:to-emerald-600/90"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Envoyer la demande
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl glassmorphism">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl text-primary">Historique de mes demandes</CardTitle>
                  <CardDescription>
                    Suivez l’avancement de vos demandes et leur progression dans la chaîne de validation.
                  </CardDescription>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),220px] lg:w-[720px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={ownDemandesSearchTerm}
                      onChange={(event) => setOwnDemandesSearchTerm(event.target.value)}
                      placeholder="Rechercher par code, gagnant, ticket ou agence..."
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>

                  <Select value={ownDemandesStatusFilter} onValueChange={setOwnDemandesStatusFilter} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>Tous les statuts</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_CHEF}>{DEMANDE_STATUSES.PENDING_CHEF}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_REGIONAL}>{DEMANDE_STATUSES.PENDING_REGIONAL}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_GENERAL}>{DEMANDE_STATUSES.PENDING_GENERAL}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PENDING_EXPLOITATION}>{DEMANDE_STATUSES.PENDING_EXPLOITATION}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT}>{DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.PAID}>{DEMANDE_STATUSES.PAID}</SelectItem>
                      <SelectItem value={DEMANDE_STATUSES.REJECTED}>{DEMANDE_STATUSES.REJECTED}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>
                  {ownDemandes.length === 0
                    ? 'Aucune demande de paiement n’a encore été créée.'
                    : filteredOwnDemandes.length === 0
                      ? 'Aucune demande ne correspond aux filtres actuels.'
                      : `${filteredOwnDemandes.length} demande(s) affichée(s) sur ${ownDemandes.length} pour votre agence.`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Gagnant</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Agence de paiement</TableHead>
                    <TableHead className="text-right">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOwnDemandes.map((demande, index) => (
                    <motion.tr
                      key={demande.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                        String(selectedOwnDemandeId) === String(demande.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedOwnDemandeId(demande.id)}
                    >
                      <TableCell className="font-medium">{demande.codeDemande}</TableCell>
                      <TableCell>
                        {demande.prenomGagnant || '-'} {demande.nomGagnant || ''}
                      </TableCell>
                      <TableCell>{formatCurrency(demande.montantGain)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadgeClass(getEffectiveDemandeStatus(demande))}>
                          {getEffectiveDemandeStatus(demande)}
                        </Badge>
                      </TableCell>
                      <TableCell>{demande.agencePaiementNom || 'En attente'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOwnDemandeId(demande.id)}>
                          Ouvrir
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedOwnDemande && (
            <Card className="shadow-xl glassmorphism">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Suivi de la demande {selectedOwnDemande.codeDemande}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderDemandeDetailsSections(selectedOwnDemande)}

                {selectedOwnDemandeAwaitingChefDecision && (
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg text-primary">Validation du chef d’agence</CardTitle>
                      <CardDescription>
                        Cette demande attend votre validation avant transmission à l’étape suivante du workflow.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Commentaire de validation</Label>
                        <Textarea
                          rows={4}
                          value={chefDecisionComment}
                          onChange={(event) => setChefDecisionComment(event.target.value)}
                          placeholder="Ajoutez un commentaire de validation ou de refus si nécessaire."
                          disabled={isChefDecisionLoading}
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={() => handleChefDecision('approve')}
                          disabled={isChefDecisionLoading}
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          {isChefDecisionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Valider et transmettre
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleChefDecision('reject')}
                          disabled={isChefDecisionLoading}
                        >
                          Refuser la demande
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  {selectedOwnDemandeEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun événement enregistré pour cette demande.</p>
                  ) : (
                    selectedOwnDemandeEvents.map((event) => (
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
                          {event.statusBefore || 'Création'} {' -> '} {event.statusAfter || 'N/A'}
                        </p>
                        {event.commentaire ? <p className="mt-2">{event.commentaire}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="autorisation" className="space-y-6">
          <Card className="shadow-xl glassmorphism">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Autorisations reçues pour paiement</CardTitle>
              <CardDescription>
                Une fois la demande validée par les acteurs requis et autorisée par l’Exploitation, elle arrive ici pour paiement final en agence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>
                  {authorizedDemandes.length === 0
                    ? 'Aucune autorisation de paiement n’est disponible pour votre agence.'
                    : `${authorizedDemandes.length} autorisation(s) en attente de paiement.`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Gagnant</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date autorisation</TableHead>
                    <TableHead className="text-right">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authorizedDemandes.map((demande, index) => (
                    <motion.tr
                      key={demande.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                        String(selectedPaymentDemandeId) === String(demande.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedPaymentDemandeId(demande.id)}
                    >
                      <TableCell className="font-medium">{demande.codeDemande}</TableCell>
                      <TableCell>
                        {demande.prenomGagnant || '-'} {demande.nomGagnant || ''}
                      </TableCell>
                      <TableCell>{formatCurrency(demande.montantGain)}</TableCell>
                      <TableCell>{formatDisplayDateTime(demande.dateAutorisationExploitation)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPaymentDemandeId(demande.id)}>
                          Ouvrir
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedPaymentDemande && (
            <Card className="shadow-xl glassmorphism">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">
                  Finaliser le paiement {selectedPaymentDemande.codeDemande}
                </CardTitle>
                <CardDescription>
                  Cette demande a terminé le circuit de validation et attend maintenant votre confirmation de paiement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Montant</p>
                    <p className="mt-1 text-lg font-semibold">{formatCurrency(selectedPaymentDemande.montantGain)}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode</p>
                    <p className="mt-1 font-medium">{selectedPaymentDemande.modePaiement}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Lieu</p>
                    <p className="mt-1 font-medium">{selectedPaymentDemande.lieuPaiement}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Gagnant</p>
                    <p className="mt-1 font-medium">
                      {selectedPaymentDemande.prenomGagnant} {selectedPaymentDemande.nomGagnant}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Commentaire de paiement</Label>
                  <Textarea
                    rows={4}
                    value={paymentComment}
                    onChange={(event) => setPaymentComment(event.target.value)}
                    placeholder="Commentaire ou référence interne de paiement."
                    disabled={isPaymentSubmitting}
                  />
                </div>

                <Button
                  onClick={handleConfirmPayment}
                  disabled={isPaymentSubmitting}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  {isPaymentSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Confirmer le paiement final
                </Button>

                <div className="space-y-3">
                  {selectedPaymentDemandeEvents.map((event) => (
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
                        {event.statusBefore || 'Création'} {' -> '} {event.statusAfter || 'N/A'}
                      </p>
                      {event.commentaire ? <p className="mt-2">{event.commentaire}</p> : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-xl glassmorphism">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Historique des paiements finalisés</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>
                  {paidDemandes.length === 0
                    ? 'Aucun paiement finalisé dans cette agence.'
                    : `${paidDemandes.length} paiement(s) finalisé(s).`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Gagnant</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date paiement</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidDemandes.map((demande) => (
                    <TableRow key={demande.id}>
                      <TableCell className="font-medium">{demande.codeDemande}</TableCell>
                      <TableCell>
                        {demande.prenomGagnant || '-'} {demande.nomGagnant || ''}
                      </TableCell>
                      <TableCell>{formatCurrency(demande.montantGain)}</TableCell>
                      <TableCell>{formatDisplayDateTime(demande.datePaiementFinal)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadgeClass(getEffectiveDemandeStatus(demande))}>
                          {getEffectiveDemandeStatus(demande)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};

export default PaiementGrosGainPage;
