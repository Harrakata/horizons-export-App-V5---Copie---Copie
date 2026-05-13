import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/Combobox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { Building2, CalendarClock, Globe, Wrench, ClipboardList } from 'lucide-react';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { ajouterAuStockDefectueux } from '@/lib/stockDefectueux';
import { fetchRegions, buildRegionOptions, normalizeRegionText } from '@/lib/regions';

const normalizeMaintenanceText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isMissingInterventionIdError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    message.includes('null value in column "id"') &&
    message.includes('interventions_maintenance')
  );
};

const isInvalidIntegerIdError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    message.includes('invalid input syntax for type bigint') ||
    message.includes('invalid input syntax for type integer') ||
    message.includes('invalid input syntax for type smallint')
  );
};

const generateInterventionUuid = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const generateInterventionNumericId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

const slugify = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const downloadTextFile = (fileName, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const printHtmlContent = (htmlContent) => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframeWindow?.document;

  if (!iframeWindow || !iframeDocument) {
    iframe.remove();
    throw new Error("Impossible de préparer l'impression du document.");
  }

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
    }, 300);
  };

  iframeWindow.onafterprint = cleanup;

  iframeDocument.open();
  iframeDocument.write(htmlContent);
  iframeDocument.close();

  window.setTimeout(() => {
    iframeWindow.focus();
    iframeWindow.print();
  }, 500);
};

const ValidationSignatureField = ({
  title,
  signerName,
  signatureRef,
  signatureValue,
  onValidate,
  onClear,
  disabled,
  statusLabel,
  helperText,
}) => (
  <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h4 className="font-medium text-primary">{title}</h4>
        <p className="text-sm text-muted-foreground">{signerName}</p>
      </div>
      <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${signatureValue ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {statusLabel}
      </span>
    </div>

    <div className="rounded-xl border bg-slate-50 p-3">
      <SignatureCanvas
        ref={signatureRef}
        penColor="#111827"
        canvasProps={{
          className: 'h-44 w-full rounded-lg bg-white',
        }}
      />
    </div>

    <p className="text-sm text-muted-foreground">
      {helperText}
    </p>

    {signatureValue && (
      <div className="rounded-xl border bg-emerald-50/60 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-700">Apercu de la signature</p>
        <img src={signatureValue} alt={`Signature de ${signerName}`} className="h-24 w-full object-contain" />
      </div>
    )}

    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onClear} disabled={disabled}>
        Effacer
      </Button>
      <Button type="button" onClick={onValidate} disabled={disabled}>
        Valider la signature
      </Button>
    </div>
  </div>
);

const ValidationInfoBlock = ({ label, value, tone = 'default', fullWidth = false }) => {
  const toneClassName = {
    default: 'border-slate-200 bg-slate-50/70',
    accent: 'border-blue-200 bg-blue-50/70',
    success: 'border-emerald-200 bg-emerald-50/70',
    warning: 'border-amber-200 bg-amber-50/70',
  }[tone];

  return (
    <div className={`${fullWidth ? 'md:col-span-2' : ''} rounded-xl border p-4 ${toneClassName}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
};

const MaintenanceTab = ({ technicien }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    region: '',
    agence: '',
    terminal: '',
    sousEnsemble: '',
    typeIntervention: 'curative',
    code: '',
    panne: '',
    piece: '',
    commentaire: '',
    remplace: 'non',
    remplacement: '',
  });
  const [recap, setRecap] = useState(null);

  // États pour stocker les données chargées depuis Supabase
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [terminaux, setTerminaux] = useState([]);
  const [codesPannes, setCodesPannes] = useState([]);
  const [codesInterventions, setCodesInterventions] = useState([]);
  const [piecesRechange, setPiecesRechange] = useState([]);
  const [recentInterventions, setRecentInterventions] = useState([]);
  const [isRecentInterventionsLoading, setIsRecentInterventionsLoading] = useState(false);
  const [chefAgence, setChefAgence] = useState(null);
  const [technicienSignature, setTechnicienSignature] = useState(null);
  const [chefAgenceSignature, setChefAgenceSignature] = useState(null);
  const [savedInterventionId, setSavedInterventionId] = useState(null);
  const [savedValidationFile, setSavedValidationFile] = useState(null);
  const technicienSignatureRef = useRef(null);
  const chefAgenceSignatureRef = useRef(null);
  const [replacementOptions, setReplacementOptions] = useState([]);
  const [isLoadingReplacements, setIsLoadingReplacements] = useState(false);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  // Charger les données initiales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Charger les terminaux quand l'agence change
  useEffect(() => {
    if (form.agence) {
      loadTerminaux(form.agence);
    } else {
      setTerminaux([]);
    }
  }, [form.agence]);

  useEffect(() => {
    if (form.agence) {
      loadRecentInterventions();
    } else {
      setRecentInterventions([]);
      setIsRecentInterventionsLoading(false);
    }
  }, [form.agence, form.terminal, form.sousEnsemble]);

  useEffect(() => {
    if (form.agence) {
      loadChefAgence(form.agence);
    } else {
      setChefAgence(null);
    }
  }, [form.agence, agences]);

  useEffect(() => {
    if (form.sousEnsemble && form.terminal) {
      loadReplacementOptions();
    } else {
      setReplacementOptions([]);
    }
  }, [form.sousEnsemble, form.terminal]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Charger les régions depuis la table dédiée
      const regionsResponse = await fetchRegions();
      if (!regionsResponse.error) setRegions(regionsResponse.data || []);

      // Charger les agences
      const { data: agencesData, error: agencesError } = await supabase
        .from('agences')
        .select('id, nom, nbreTerminaux, codePDV, region')
        .order('nom', { ascending: true });

      if (agencesError) {
        toast({ title: 'Erreur', description: 'Impossible de charger les agences', variant: 'destructive' });
      } else {
        setAgences(agencesData || []);
      }

      // Charger les codes de pannes
      const { data: pannesData, error: pannesError } = await supabase
        .from('codes_pannes')
        .select('*')
        .order('code', { ascending: true });
      
      if (pannesError) {
        toast({ title: 'Erreur', description: 'Impossible de charger les codes de pannes', variant: 'destructive' });
      } else {
        setCodesPannes(pannesData || []);
      }

      // Charger les codes d'interventions
      const { data: interventionsData, error: interventionsError } = await supabase
        .from('codes_interventions')
        .select('*')
        .order('code', { ascending: true });
      
      if (interventionsError) {
        toast({ title: 'Erreur', description: "Impossible de charger les codes d\'interventions", variant: 'destructive' });
      } else {
        setCodesInterventions(interventionsData || []);
      }

      // Charger les pièces de rechange
      const { data: piecesData, error: piecesError } = await supabase
        .from('pieces_rechange')
        .select('*')
        .gt('stock_disponible', 0) // Stock > 0
        .order('nom', { ascending: true });
      
      if (piecesError) {
        toast({ title: 'Erreur', description: 'Impossible de charger les pièces de rechange', variant: 'destructive' });
      } else {
        setPiecesRechange(piecesData || []);
      }

    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors du chargement des données', variant: 'destructive' });
      console.error('Erreur de chargement:', error);
    }
    setIsLoading(false);
  };

  const loadTerminaux = async (agenceId) => {
    try {
      const { data, error } = await supabase
        .from('terminaux')
        .select('*')
        .eq('agence_id', agenceId)
        .eq('statut', 'Actif')
        .order('reference', { ascending: true });
      
      if (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger les terminaux', variant: 'destructive' });
        setTerminaux([]);
      } else {
        setTerminaux(data || []);
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors du chargement des terminaux', variant: 'destructive' });
      setTerminaux([]);
    }
  };

  const loadRecentInterventions = async () => {
    if (!form.agence) {
      setRecentInterventions([]);
      return;
    }

    setIsRecentInterventionsLoading(true);

    try {
      let terminalRecords = [];

      if (form.terminal) {
        const selectedTerminal = terminaux.find((terminal) => String(terminal.id) === String(form.terminal));

        if (selectedTerminal) {
          terminalRecords = [selectedTerminal];
        } else {
          const { data: terminalData, error: terminalError } = await supabase
            .from('terminaux')
            .select('id, reference')
            .eq('id', form.terminal);

          if (terminalError) {
            throw terminalError;
          }

          terminalRecords = terminalData || [];
        }
      } else {
        const { data: terminalData, error: terminalError } = await supabase
          .from('terminaux')
          .select('id, reference')
          .eq('agence_id', form.agence);

        if (terminalError) {
          throw terminalError;
        }

        terminalRecords = terminalData || [];
      }

      const terminalIds = terminalRecords.map((terminal) => terminal.id);

      if (terminalIds.length === 0) {
        setRecentInterventions([]);
        return;
      }

      let query = supabase
        .from('interventions_maintenance')
        .select('id, terminal_id, type_intervention, sous_ensemble, code_panne_id, code_intervention_id, commentaire, statut, date_intervention, date_fin')
        .in('terminal_id', terminalIds)
        .order('date_intervention', { ascending: false })
        .limit(10);

      if (form.sousEnsemble) {
        query = query.eq('sous_ensemble', form.sousEnsemble);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const terminalReferenceById = terminalRecords.reduce((acc, terminal) => {
        acc[String(terminal.id)] = terminal.reference;
        return acc;
      }, {});

      setRecentInterventions(
        (data || []).map((intervention) => ({
          ...intervention,
          terminal_reference: terminalReferenceById[String(intervention.terminal_id)] || `Terminal #${intervention.terminal_id}`,
        }))
      );
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les dernières interventions',
        variant: 'destructive',
      });
      console.error('Erreur chargement interventions récentes:', error);
      setRecentInterventions([]);
    } finally {
      setIsRecentInterventionsLoading(false);
    }
  };

  const loadChefAgence = async (agenceId) => {
    const agence = agences.find((item) => String(item.id) === String(agenceId));

    if (!agence) {
      setChefAgence(null);
      return;
    }

    try {
      let { data, error } = await supabase
        .from('chefs_agence')
        .select('id, matricule, nom, prenom, agenceEnCharge, codePDV')
        .eq('agenceEnCharge', agence.nom)
        .limit(1);

      if (error) {
        throw error;
      }

      let chef = data?.[0] || null;

      if (!chef && agence.codePDV) {
        const chefByCodePdv = await supabase
          .from('chefs_agence')
          .select('id, matricule, nom, prenom, agenceEnCharge, codePDV')
          .eq('codePDV', agence.codePDV)
          .limit(1);

        if (chefByCodePdv.error) {
          throw chefByCodePdv.error;
        }

        chef = chefByCodePdv.data?.[0] || null;
      }

      setChefAgence(chef);
    } catch (error) {
      console.error("Erreur chargement chef d'agence:", error);
      setChefAgence(null);
      toast({
        title: 'Erreur',
        description: "Impossible de charger le chef d'agence associé",
        variant: 'destructive',
      });
    }
  };

  const loadReplacementOptions = async () => {
    const terminal = terminaux.find((t) => String(t.id) === form.terminal);
    if (!terminal || !form.sousEnsemble) {
      setReplacementOptions([]);
      return;
    }

    let type = null;
    if (terminal.imprimante_reference === form.sousEnsemble) type = 'imprimante';
    else if (terminal.lecteur_reference === form.sousEnsemble) type = 'lecteur';
    else if (terminal.ecran_reference === form.sousEnsemble) type = 'ecran';
    else if (terminal.afficheur_reference === form.sousEnsemble) type = 'afficheur';

    if (!type) {
      setReplacementOptions([]);
      return;
    }

    const tableMap = {
      imprimante: 'equipments_imprimantes',
      lecteur: 'equipments_lecteurs',
      ecran: 'equipments_ecrans',
      afficheur: 'equipments_afficheurs',
    };

    const terminalFieldMap = {
      imprimante: 'imprimante_reference',
      lecteur: 'lecteur_reference',
      ecran: 'ecran_reference',
      afficheur: 'afficheur_reference',
    };

    const normalizeRef = (v) => String(v ?? '').trim().toLowerCase();

    setIsLoadingReplacements(true);
    try {
      // Récupérer toutes les références déjà assignées à d'autres terminaux (tous agences confondus)
      const { data: autresTerminaux, error: termError } = await supabase
        .from('terminaux')
        .select('id, imprimante_reference, lecteur_reference, ecran_reference, afficheur_reference')
        .neq('id', terminal.id);

      if (termError) console.error('Erreur filtre terminaux:', termError);

      const refField = terminalFieldMap[type];
      const refsAssignees = new Set(
        (autresTerminaux || [])
          .map((t) => normalizeRef(t[refField]))
          .filter(Boolean)
      );

      const { data, error } = await supabase
        .from(tableMap[type])
        .select('reference, modele, statut')
        .order('reference', { ascending: true });

      if (!error) {
        const available = (data || []).filter((e) => {
          const s = normalizeMaintenanceText(e.statut ?? '');
          const isBlocked = s === 'en panne' || s === 'hors service' || s === 'en maintenance';
          const isAssigned = refsAssignees.has(normalizeRef(e.reference));
          const isCurrent = normalizeRef(e.reference) === normalizeRef(form.sousEnsemble);
          return !isBlocked && !isAssigned && !isCurrent;
        });
        setReplacementOptions(
          available.map((e) => ({
            value: e.reference,
            label: `${e.reference}${e.modele ? ` - ${e.modele}` : ''}`,
          }))
        );
      } else {
        setReplacementOptions([]);
      }
    } catch (err) {
      console.error('Erreur chargement sous-ensembles disponibles:', err);
      setReplacementOptions([]);
    } finally {
      setIsLoadingReplacements(false);
    }
  };

  // Obtenir les sous-ensembles du terminal sélectionné
  const getSousEnsembles = () => {
    const terminal = terminaux.find(t => String(t.id) === form.terminal);
    if (!terminal) return [];
    
    const sousEnsembles = [];
    if (terminal.imprimante_reference) {
      sousEnsembles.push({ value: terminal.imprimante_reference, label: `Imprimante - ${terminal.imprimante_reference}` });
    }
    if (terminal.lecteur_reference) {
      sousEnsembles.push({ value: terminal.lecteur_reference, label: `Lecteur - ${terminal.lecteur_reference}` });
    }
    if (terminal.ecran_reference) {
      sousEnsembles.push({ value: terminal.ecran_reference, label: `Écran - ${terminal.ecran_reference}` });
    }
    
    return sousEnsembles;
  };

  const clearValidationDraft = () => {
    setTechnicienSignature(null);
    setChefAgenceSignature(null);
    setSavedInterventionId(null);
    setSavedValidationFile(null);
    technicienSignatureRef.current?.clear();
    chefAgenceSignatureRef.current?.clear();
  };

  const handleChange = (field) => (value) => {
    if (form[field] !== value) {
      clearValidationDraft();
    }

    setForm((p) => {
      const updated = { ...p, [field]: value };
      if (field === 'region') {
        updated.agence = '';
        updated.terminal = '';
        updated.sousEnsemble = '';
      }
      if (field === 'agence') {
        updated.terminal = '';
        updated.sousEnsemble = '';
      }
      if (field === 'terminal') {
        updated.sousEnsemble = '';
      }
      return updated;
    });
  };

  const handleReplacementSelect = (value) => {
    handleChange('remplacement')(value);
  };

  // Préparer les options pour les Combobox
  const regionsOptions = buildRegionOptions(
    regions.length > 0
      ? regions
      : agences.filter((a) => a.region).map((a) => ({ nom: a.region, codeRegion: '' }))
  );

  const filteredAgences = form.region
    ? agences.filter(
        (agence) => normalizeRegionText(agence.region) === normalizeRegionText(form.region)
      )
    : agences;

  const agencesOptions = filteredAgences.map(a => ({
    value: String(a.id),
    label: `${a.nom} (${a.nbreTerminaux} terminaux)`
  }));

  const terminauxOptions = terminaux.map(t => ({
    value: String(t.id),
    label: `${t.reference} - ${t.type_terminal} - ${t.position || 'Position non définie'}`
  }));

  const sousEnsemblesOptions = getSousEnsembles();

  const codesPannesOptions = codesPannes.map(c => ({
    // Assurer que la valeur est une chaîne pour éviter les problèmes de comparaison
    value: String(c.code),
    label: `${c.code} - ${c.libelle}`
  }));

  const codesInterventionsOptions = codesInterventions.map(c => ({
    value: String(c.code),
    label: `${c.code} - ${c.libelle}`
  }));

  const piecesRechangeOptions = piecesRechange.map(p => ({
    value: p.nom,
    label: `${p.nom} - Stock: ${p.stock_disponible}`
  }));

  const formatInterventionDate = (dateValue) => {
    if (!dateValue) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(dateValue));
  };

  const getInterventionCodeLabel = (intervention) => {
    if (intervention.type_intervention === 'curative') {
      const codePanne = codesPannes.find((item) => String(item.id) === String(intervention.code_panne_id));
      return codePanne ? `${codePanne.code} - ${codePanne.libelle}` : 'N/A';
    }

    const codeIntervention = codesInterventions.find((item) => String(item.id) === String(intervention.code_intervention_id));
    return codeIntervention ? `${codeIntervention.code} - ${codeIntervention.libelle}` : 'N/A';
  };

  const getInterventionTypeLabel = (type) => (
    type === 'curative' ? 'Curative' : 'Préventive'
  );

  const selectedAgence = agences.find(a => String(a.id) === form.agence);
  const selectedTerminal = terminaux.find(t => String(t.id) === form.terminal);
  const chefAgenceNomComplet = chefAgence ? `${chefAgence.prenom} ${chefAgence.nom}` : '';
  const currentDetailLabel = form.typeIntervention === 'curative' ? 'Description panne' : 'Pièce utilisée';
  const currentDetailValue = form.typeIntervention === 'curative' ? (form.panne || 'N/A') : (form.piece || 'Aucune');
  const remplacementValue = form.remplace === 'oui' ? (form.remplacement || 'N/A') : 'Aucun remplacement';
  const validationReadyCount = [technicienSignature, chefAgenceSignature].filter(Boolean).length;
  const availableRegionsCount = regionsOptions.length;
  const availableAgencesCount = filteredAgences.length;
  const availableTerminauxCount = terminaux.length;
  const recentInterventionsCount = recentInterventions.length;
  const validationStatusText = chefAgence
    ? `${validationReadyCount}/2 signatures validées`
    : "Chef d'agence non associé";

  const formatValidationDate = (dateValue = new Date()) =>
    new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(dateValue));

  const getCurrentInterventionCodeLabel = () => {
    if (form.typeIntervention === 'curative') {
      const codePanne = codesPannes.find(
        (item) => String(item.code).toLowerCase() === String(form.code).trim().toLowerCase()
      );
      return codePanne ? `${codePanne.code} - ${codePanne.libelle}` : form.code || 'N/A';
    }

    const codeIntervention = codesInterventions.find(
      (item) => String(item.code).toLowerCase() === String(form.code).trim().toLowerCase()
    );
    return codeIntervention ? `${codeIntervention.code} - ${codeIntervention.libelle}` : form.code || 'N/A';
  };

  const getValidationFileBaseName = () => {
    const agencySlug = slugify(selectedAgence?.nom || 'agence');
    const technicienSlug = slugify(`${technicien?.prenom || ''}-${technicien?.nom || ''}`) || 'technicien';
    const chefSlug = slugify(chefAgenceNomComplet) || 'chef-agence';
    return `validation_intervention_${agencySlug}_${technicienSlug}_${chefSlug}_${Date.now()}`;
  };

  const buildValidationHtml = (interventionId, p = null) => {
    const typeLabel       = p ? p.typeLabel       : getInterventionTypeLabel(form.typeIntervention);
    const codeLabel       = p ? p.codeLabel       : getCurrentInterventionCodeLabel();
    const validationDate  = p ? p.validationDate  : formatValidationDate();
    const detailLabel     = p ? p.detailLabel     : (form.typeIntervention === 'curative' ? 'Description panne' : 'Pièce utilisée');
    const detailValue     = p ? p.detailValue     : (form.typeIntervention === 'curative' ? (form.panne || 'N/A') : (form.piece || 'Aucune'));
    const remplacementValue = p ? p.remplacementValue : (form.remplace === 'oui' ? (form.remplacement || 'N/A') : 'Aucun remplacement');
    const commentValue    = p ? p.commentValue    : (form.commentaire || 'Aucun commentaire');
    const validationState = p ? p.validationState : (validationReadyCount === 2 ? 'Validation complete' : 'Validation en cours');
    const technicienName  = p ? p.technicienName  : (`${technicien?.prenom || ''} ${technicien?.nom || ''}`.trim() || 'N/A');
    const techMatricule   = p ? p.techMatricule   : (technicien?.matricule || 'Sans matricule');
    const chefAgenceName  = p ? p.chefAgenceName  : (chefAgenceNomComplet || 'N/A');
    const chefRef         = p ? p.chefRef         : (chefAgence?.matricule || chefAgence?.codePDV || 'Aucune reference');
    const agenceNom       = p ? p.agenceNom       : (selectedAgence?.nom || 'N/A');
    const terminalRef     = p ? p.terminalRef     : (selectedTerminal?.reference || 'N/A');
    const sousEnsemble    = p ? p.sousEnsemble    : (form.sousEnsemble || 'N/A');
    const techSig         = p ? p.techSig         : technicienSignature;
    const chefSig         = p ? p.chefSig         : chefAgenceSignature;

    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Validation intervention maintenance</title>
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #eef3f8;
        color: #0f172a;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        padding: 14px;
      }

      .page {
        max-width: 860px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #d7e0ea;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.10);
      }

      .hero {
        padding: 16px 20px;
        background:
          radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 26%),
          linear-gradient(135deg, #0f766e 0%, #14532d 100%);
        color: #ffffff;
      }

      .hero-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .brand {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        opacity: 0.92;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.14);
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 14px;
        align-items: center;
      }

      .eyebrow {
        margin: 0 0 4px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.80;
      }

      .hero-title {
        margin: 0;
        font-size: 20px;
        line-height: 1.15;
        letter-spacing: -0.01em;
      }

      .hero-subtitle {
        margin: 6px 0 0;
        font-size: 11px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.82);
      }

      .hero-meta {
        display: grid;
        gap: 6px;
      }

      .hero-meta-card {
        border-radius: 10px;
        padding: 7px 11px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.18);
      }

      .hero-meta-label {
        display: block;
        margin-bottom: 2px;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(255, 255, 255, 0.75);
      }

      .hero-meta-value {
        font-size: 12px;
        font-weight: 700;
        color: #ffffff;
      }

      .content {
        padding: 16px 20px 20px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 14px;
      }

      .summary-card {
        border: 1px solid #dbe5ef;
        border-radius: 12px;
        padding: 10px 12px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      }

      .summary-label {
        margin: 0 0 4px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
      }

      .summary-value {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.35;
        color: #0f172a;
      }

      .layout {
        display: grid;
        grid-template-columns: 1.42fr 0.98fr;
        gap: 12px;
        margin-bottom: 12px;
      }

      .panel {
        border: 1px solid #dbe5ef;
        border-radius: 14px;
        padding: 14px;
        background: #ffffff;
      }

      .panel-title {
        margin: 0 0 2px;
        font-size: 14px;
        font-weight: 700;
        color: #0f766e;
      }

      .panel-subtitle {
        margin: 0 0 10px;
        font-size: 11px;
        line-height: 1.5;
        color: #64748b;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .info-card {
        border: 1px solid #dbe5ef;
        border-radius: 10px;
        padding: 9px 11px;
        background: #f8fafc;
      }

      .info-card.wide {
        grid-column: 1 / -1;
      }

      .info-label {
        margin: 0 0 3px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
      }

      .info-value {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.45;
        color: #0f172a;
      }

      .participants {
        display: grid;
        gap: 8px;
      }

      .participant {
        border: 1px solid #dbe5ef;
        border-radius: 10px;
        padding: 9px 12px;
        background: #f8fafc;
      }

      .participant-role {
        margin: 0 0 3px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
      }

      .participant-name {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
      }

      .participant-meta {
        margin: 2px 0 0;
        font-size: 11px;
        color: #64748b;
      }

      .participant-state {
        margin-top: 6px;
        display: inline-flex;
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 10px;
        font-weight: 700;
        background: #dcfce7;
        color: #166534;
      }

      .participant-state.pending {
        background: #fef3c7;
        color: #92400e;
      }

      .detail-panel {
        margin-bottom: 12px;
      }

      .signatures {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .signature-box {
        border: 1px solid #dbe5ef;
        border-radius: 14px;
        padding: 12px;
        background: linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%);
        min-height: 160px;
      }

      .signature-title {
        margin: 0 0 2px;
        font-size: 13px;
        font-weight: 700;
        color: #0f766e;
      }

      .signature-subtitle {
        margin: 0 0 8px;
        font-size: 11px;
        color: #64748b;
      }

      .signature-visual {
        height: 88px;
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
      }

      .signature-visual img {
        max-width: 100%;
        max-height: 72px;
        object-fit: contain;
      }

      .signature-line {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #cbd5e1;
      }

      .signature-line .name {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
      }

      .signature-line .role {
        margin: 2px 0 0;
        font-size: 11px;
        color: #64748b;
      }

      .footer {
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-top: 1px solid #e2e8f0;
        padding-top: 10px;
        font-size: 10px;
        color: #64748b;
      }

      @media print {
        body {
          padding: 0;
          background: #ffffff;
        }

        .page {
          border: none;
          border-radius: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <div class="hero-top">
          <div class="brand">Star3000+</div>
          <div class="status-badge">${escapeHtml(validationState)}</div>
        </div>

        <div class="hero-grid">
          <div>
            <p class="eyebrow">Maintenance Terminaux</p>
            <h1 class="hero-title">Fiche de Validation d'Intervention</h1>
            <p class="hero-subtitle">
              Document de cloture et de validation croisee entre le technicien de maintenance
              et le chef d'agence pour confirmer l'intervention realisee.
            </p>
          </div>

          <div class="hero-meta">
            <div class="hero-meta-card">
              <span class="hero-meta-label">Date de generation</span>
              <div class="hero-meta-value">${escapeHtml(validationDate)}</div>
            </div>
            <div class="hero-meta-card">
              <span class="hero-meta-label">Agence / Terminal</span>
              <div class="hero-meta-value">${escapeHtml(agenceNom)} / ${escapeHtml(terminalRef)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="summary-grid">
          <div class="summary-card">
            <p class="summary-label">Type</p>
            <p class="summary-value">${escapeHtml(typeLabel)}</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">Sous-ensemble</p>
            <p class="summary-value">${escapeHtml(sousEnsemble)}</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">Code</p>
            <p class="summary-value">${escapeHtml(codeLabel)}</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">Remplacement</p>
            <p class="summary-value">${escapeHtml(remplacementValue)}</p>
          </div>
        </div>

        <div class="layout">
          <div class="panel">
            <h2 class="panel-title">Contexte technique</h2>
            <p class="panel-subtitle">Synthese de l'intervention effectuee sur le terminal et le sous-ensemble concernes.</p>

            <div class="info-grid">
              <div class="info-card">
                <p class="info-label">Agence</p>
                <p class="info-value">${escapeHtml(agenceNom)}</p>
              </div>
              <div class="info-card">
                <p class="info-label">Terminal</p>
                <p class="info-value">${escapeHtml(terminalRef)}</p>
              </div>
              <div class="info-card">
                <p class="info-label">${escapeHtml(detailLabel)}</p>
                <p class="info-value">${escapeHtml(detailValue)}</p>
              </div>
              <div class="info-card">
                <p class="info-label">Date de validation</p>
                <p class="info-value">${escapeHtml(validationDate)}</p>
              </div>
              <div class="info-card wide">
                <p class="info-label">Commentaire</p>
                <p class="info-value">${escapeHtml(commentValue)}</p>
              </div>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">Acteurs de validation</h2>
            <p class="panel-subtitle">Responsables identifies pour la cloture et l'approbation de la fiche.</p>

            <div class="participants">
              <div class="participant">
                <p class="participant-role">Technicien</p>
                <p class="participant-name">${escapeHtml(technicienName)}</p>
                <p class="participant-meta">${escapeHtml(techMatricule)}</p>
                <div class="participant-state">Signature recueillie</div>
              </div>

              <div class="participant">
                <p class="participant-role">Chef d'agence</p>
                <p class="participant-name">${escapeHtml(chefAgenceName)}</p>
                <p class="participant-meta">${escapeHtml(chefRef)}</p>
                <div class="participant-state">Signature recueillie</div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel detail-panel">
          <h2 class="panel-title">Validation et signatures</h2>
          <p class="panel-subtitle">Les deux parties ci-dessous confirment la conformite des informations portees sur cette fiche.</p>

          <div class="signatures">
            <div class="signature-box">
              <h3 class="signature-title">Signature du technicien</h3>
              <p class="signature-subtitle">Confirmation de la realisation de l'intervention</p>
              <div class="signature-visual">
                ${techSig ? `<img src="${techSig}" alt="Signature technicien" />` : '<span style="font-size:12px;color:#94a3b8;">Signature non disponible</span>'}
              </div>
              <div class="signature-line">
                <p class="name">${escapeHtml(technicienName)}</p>
                <p class="role">Technicien de maintenance</p>
              </div>
            </div>

            <div class="signature-box">
              <h3 class="signature-title">Signature du chef d'agence</h3>
              <p class="signature-subtitle">Approbation de la cloture et validation terrain</p>
              <div class="signature-visual">
                ${chefSig ? `<img src="${chefSig}" alt="Signature chef d'agence" />` : '<span style="font-size:12px;color:#94a3b8;">Signature non disponible</span>'}
              </div>
              <div class="signature-line">
                <p class="name">${escapeHtml(chefAgenceName)}</p>
                <p class="role">Chef d'agence</p>
              </div>
            </div>
          </div>
        </div>

        <div class="footer">
          <span>Star3000+ - Maintenance Terminaux</span>
          <span>Fiche de validation generee automatiquement</span>
        </div>
      </div>
    </div>
  </body>
</html>`;
  };

  const downloadHistoryPdf = async (intervention) => {
    setPdfDownloadingId(intervention.id);
    try {
      const [terminalRes, agenceRes] = await Promise.all([
        supabase.from('terminaux').select('id, reference, agence_id').eq('id', intervention.terminal_id).single(),
        supabase.from('agences').select('id, nom, codePDV').eq('id',
          (await supabase.from('terminaux').select('agence_id').eq('id', intervention.terminal_id).single()).data?.agence_id
        ).single(),
      ]);

      const terminal = terminalRes.data;
      const agence = agenceRes.data;

      let codeLabel = 'N/A';
      if (intervention.type_intervention === 'curative' && intervention.code_panne_id) {
        const { data: cp } = await supabase.from('codes_pannes').select('code, libelle').eq('id', intervention.code_panne_id).single();
        if (cp) codeLabel = `${cp.code} - ${cp.libelle}`;
      } else if (intervention.code_intervention_id) {
        const { data: ci } = await supabase.from('codes_interventions').select('code, libelle').eq('id', intervention.code_intervention_id).single();
        if (ci) codeLabel = `${ci.code} - ${ci.libelle}`;
      }

      let techName = 'N/A';
      let techMat = 'Sans matricule';
      if (intervention.technicien_id) {
        const { data: tech } = await supabase.from('techniciens').select('prenom, nom, matricule').eq('id', intervention.technicien_id).single();
        if (tech) { techName = `${tech.prenom} ${tech.nom}`.trim(); techMat = tech.matricule || 'Sans matricule'; }
      }

      let chefName = 'N/A';
      let chefRef = 'Aucune reference';
      if (agence) {
        let { data: chef } = await supabase.from('chefs_agence').select('id, matricule, nom, prenom, codePDV').eq('agenceEnCharge', agence.nom).limit(1);
        if (!chef?.length && agence.codePDV) {
          ({ data: chef } = await supabase.from('chefs_agence').select('id, matricule, nom, prenom, codePDV').eq('codePDV', agence.codePDV).limit(1));
        }
        if (chef?.[0]) {
          chefName = `${chef[0].prenom} ${chef[0].nom}`.trim();
          chefRef = chef[0].matricule || chef[0].codePDV || 'Aucune reference';
        }
      }

      const typeLabel = getInterventionTypeLabel(intervention.type_intervention);
      const isReplaced = intervention.equipement_remplace;
      const params = {
        typeLabel,
        codeLabel,
        validationDate: formatValidationDate(intervention.date_fin || intervention.date_intervention),
        detailLabel: intervention.type_intervention === 'curative' ? 'Description panne' : 'Pièce utilisée',
        detailValue: intervention.commentaire || 'N/A',
        remplacementValue: isReplaced ? (intervention.reference_remplacement || 'N/A') : 'Aucun remplacement',
        commentValue: intervention.commentaire || 'Aucun commentaire',
        validationState: 'Validation complete',
        technicienName: techName,
        techMatricule: techMat,
        chefAgenceName: chefName,
        chefRef,
        agenceNom: agence?.nom || 'N/A',
        terminalRef: terminal?.reference || intervention.terminal_reference || 'N/A',
        sousEnsemble: intervention.sous_ensemble || 'N/A',
        techSig: null,
        chefSig: null,
      };

      printHtmlContent(buildValidationHtml(intervention.id, params));
    } catch (error) {
      console.error('Erreur génération PDF historique:', error);
      toast({ title: 'Erreur', description: 'Impossible de générer le PDF de cette intervention', variant: 'destructive' });
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const saveIntervention = async (interventionData) => {
    setIsLoading(true);
    try {
      // Préparer les données pour l'insertion
      const terminalId = interventionData.terminal;
      if (!terminalId) {
        toast({ title: 'Erreur', description: 'Terminal invalide', variant: 'destructive' });
        return null;
      }

      const dataToInsert = {
        terminal_id: terminalId,
        technicien_id: technicien?.id || null,
        type_intervention: interventionData.typeIntervention,
        sous_ensemble: interventionData.sousEnsemble,
        commentaire: interventionData.commentaire,
        description_panne: interventionData.panne || null,
        equipement_remplace: interventionData.remplace === 'oui',
        reference_remplacement: interventionData.remplacement || null,
        statut: 'Terminée',
        date_fin: new Date().toISOString()
      };

      // Ajouter les références selon le type d'intervention
      if (interventionData.typeIntervention === 'curative') {
        const codePanne = codesPannes.find(
          (p) => String(p.code).toLowerCase() === String(interventionData.code).trim().toLowerCase()
        );
        if (!codePanne) {
          toast({ title: 'Erreur', description: 'Code panne invalide', variant: 'destructive' });
          return null;
        }
        dataToInsert.code_panne_id = codePanne.id;
      } else {
        const codeIntervention = codesInterventions.find(
          (i) => String(i.code).toLowerCase() === String(interventionData.code).trim().toLowerCase()
        );
        if (!codeIntervention) {
          toast({ title: 'Erreur', description: "Code d'intervention invalide", variant: 'destructive' });
          return null;
        }
        dataToInsert.code_intervention_id = codeIntervention.id;
        const piece = piecesRechange.find(p => p.nom === interventionData.piece);
        if (piece) {
          dataToInsert.piece_remplacee_id = piece.id;
        }
      }

      let insertResult = await supabase
        .from('interventions_maintenance')
        .insert([dataToInsert])
        .select('id')
        .single();

      let insertedIntervention = insertResult.data;
      let error = insertResult.error;

      // Some existing databases were created without an automatic default on id.
      // Retry with a UUID first, then fall back to a numeric id for bigint schemas.
      if (isMissingInterventionIdError(error)) {
        let retryResult = await supabase
          .from('interventions_maintenance')
          .insert([{ id: generateInterventionUuid(), ...dataToInsert }])
          .select('id')
          .single();

        insertedIntervention = retryResult.data;
        error = retryResult.error;

        if (isInvalidIntegerIdError(error)) {
          retryResult = await supabase
            .from('interventions_maintenance')
            .insert([{ id: generateInterventionNumericId(), ...dataToInsert }])
            .select('id')
            .single();

          insertedIntervention = retryResult.data;
          error = retryResult.error;
        }
      }

      if (error) {
        toast({ title: 'Erreur', description: error.message || "Impossible d\'enregistrer l\'intervention", variant: 'destructive' });
        console.error('Erreur sauvegarde:', error);
        return null;
      }

      toast({
        title: 'Succès',
        description: 'Intervention enregistrée avec succès',
        className: "bg-green-500 text-white"
      });

      // Traitement du remplacement à la validation finale
      if (interventionData.remplace === 'oui' && interventionData.remplacement && interventionData.sousEnsemble) {
        const terminal = terminaux.find((t) => String(t.id) === String(interventionData.terminal));
        if (terminal) {
          let type = null;
          if (terminal.imprimante_reference === interventionData.sousEnsemble) type = 'imprimante';
          else if (terminal.lecteur_reference === interventionData.sousEnsemble) type = 'lecteur';
          else if (terminal.ecran_reference === interventionData.sousEnsemble) type = 'ecran';
          else if (terminal.afficheur_reference === interventionData.sousEnsemble) type = 'afficheur';

          if (type) {
            const fieldMap = { imprimante: 'imprimante_reference', lecteur: 'lecteur_reference', ecran: 'ecran_reference', afficheur: 'afficheur_reference' };
            const equipTableMap = { imprimante: 'equipments_imprimantes', lecteur: 'equipments_lecteurs', ecran: 'equipments_ecrans', afficheur: 'equipments_afficheurs' };

            await Promise.all([
              supabase.from('terminaux').update({ [fieldMap[type]]: interventionData.remplacement }).eq('id', terminal.id),
              supabase.from(equipTableMap[type]).update({ statut: 'En maintenance' }).eq('reference', interventionData.sousEnsemble),
              supabase.from(equipTableMap[type]).update({ statut: 'En service' }).eq('reference', interventionData.remplacement),
            ]);

            await ajouterAuStockDefectueux({
              referenceSousEnsemble: interventionData.sousEnsemble,
              typeSousEnsemble: type,
              typeTerminal: terminal.type_terminal || null,
              agenceProvenance: interventionData.agence || terminal.agence_id || null,
              dateEntree: new Date().toISOString(),
              commentaire: null,
              interventionId: insertedIntervention?.id || null,
            });
          }
        }
      }

      return insertedIntervention;
    } catch (error) {
      toast({ title: 'Erreur', description: "Erreur lors de l\'enregistrement", variant: 'destructive' });
      console.error('Erreur:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const validateSignature = (signatureRef, setSignature, signerLabel) => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Signature requise',
        description: `Veuillez signer pour ${signerLabel.toLowerCase()}.`,
        variant: 'destructive',
      });
      return;
    }

    setSignature(signatureRef.current.toDataURL('image/png'));
    toast({
      title: 'Signature enregistrée',
      description: `${signerLabel} a signé la fiche.`,
      className: 'bg-blue-500 text-white',
    });
  };

  const clearSignature = (signatureRef, setSignature) => {
    signatureRef.current?.clear();
    setSignature(null);
  };

  const downloadValidationPdf = () => {
    if (!technicienSignature || !chefAgenceSignature) {
      toast({
        title: 'Signatures requises',
        description: "Les signatures du technicien et du chef d'agence sont nécessaires pour le PDF.",
        variant: 'destructive',
      });
      return;
    }

    if (!chefAgence) {
      toast({
        title: "Chef d'agence introuvable",
        description: "Aucun chef d'agence n'est associé à l'agence sélectionnée.",
        variant: 'destructive',
      });
      return;
    }

    try {
      printHtmlContent(buildValidationHtml(savedInterventionId));
    } catch (error) {
      console.error('Erreur export PDF:', error);
      downloadTextFile(`${getValidationFileBaseName()}.html`, buildValidationHtml(savedInterventionId), 'text/html;charset=utf-8;');
      toast({
        title: 'Export alternatif généré',
        description: "L'impression PDF n'a pas pu démarrer. La fiche a été téléchargée en HTML.",
        className: 'bg-yellow-500 text-white',
      });
    }
  };

  const saveValidationFile = async (interventionId) => {
    const baseName = getValidationFileBaseName();
    const fileName = `${baseName}.html`;
    const filePath = `validations_maintenance/${fileName}`;
    const fileContent = buildValidationHtml(interventionId);

    try {
      const { data, error } = await supabase.storage
        .from('pmu-mali-storage')
        .upload(filePath, new Blob([fileContent], { type: 'text/html;charset=utf-8;' }), {
          contentType: 'text/html',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('pmu-mali-storage')
        .getPublicUrl(data.path);

      await supabase
        .from('interventions_maintenance')
        .update({ fiche_url: publicUrlData.publicUrl })
        .eq('id', interventionId);

      return {
        fileName,
        publicUrl: publicUrlData.publicUrl,
        storedInSupabase: true,
      };
    } catch (error) {
      console.error('Erreur enregistrement fiche validation:', error);
      downloadTextFile(fileName, fileContent, 'text/html;charset=utf-8;');

      return {
        fileName,
        publicUrl: null,
        storedInSupabase: false,
      };
    }
  };

  const finish = async () => {
    if (!chefAgence) {
      toast({
        title: "Chef d'agence requis",
        description: "Ajoutez ou associez un chef d'agence à cette agence avant la validation.",
        variant: 'destructive',
      });
      return;
    }

    if (!technicienSignature || !chefAgenceSignature) {
      toast({
        title: 'Signatures manquantes',
        description: "Les signatures du technicien et du chef d'agence sont requises pour enregistrer la validation.",
        variant: 'destructive',
      });
      return;
    }

    let interventionId = savedInterventionId;

    if (!interventionId) {
      const savedIntervention = await saveIntervention({ ...form, technicien });

      if (!savedIntervention?.id) {
        return;
      }

      interventionId = savedIntervention.id;
      setSavedInterventionId(savedIntervention.id);
    }

    setIsLoading(true);

    try {
      const validationFile = await saveValidationFile(interventionId);
      setSavedValidationFile(validationFile);
      setRecap({
        ...form,
        technicien,
        chefAgence,
        interventionId,
        technicienSignature,
        chefAgenceSignature,
        validationFile,
      });

      toast({
        title: 'Validation enregistrée',
        description: validationFile.storedInSupabase
          ? 'La fiche de validation a été enregistrée et archivée.'
          : 'La fiche a été générée et téléchargée localement.',
        className: 'bg-green-500 text-white',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    clearValidationDraft();
    setForm({
      region: '',
      agence: '',
      terminal: '',
      sousEnsemble: '',
      typeIntervention: 'curative',
      code: '',
      panne: '',
      piece: '',
      commentaire: '',
      remplace: 'non',
      remplacement: '',
    });
    setChefAgence(null);
    setRecap(null);
    setStep(1);
  };

  if (recap) {
    const recapAgence = agences.find(a => String(a.id) === recap.agence);
    const recapTerminal = terminaux.find(t => String(t.id) === recap.terminal);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4"
      >
        <Card className="shadow-lg glassmorphism">
        <CardHeader>
            <CardTitle className="text-xl text-green-600">✅ Intervention Terminée</CardTitle>
            <CardDescription>Récapitulatif et validation de l'intervention de maintenance</CardDescription>
        </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Agence :</strong> {recapAgence?.nom}</div>
              <div><strong>Terminal :</strong> {recapTerminal?.reference}</div>
              <div><strong>Sous-ensemble :</strong> {recap.sousEnsemble}</div>
              <div><strong>Type :</strong> {recap.typeIntervention === 'curative' ? 'Curative' : 'Préventive'}</div>
              <div><strong>N° Intervention :</strong> {recap.interventionId}</div>
              <div><strong>Chef d'agence :</strong> {recap.chefAgence?.prenom} {recap.chefAgence?.nom}</div>
              
          {recap.typeIntervention === 'curative' ? (
            <>
                  <div><strong>Code panne :</strong> {recap.code}</div>
                  <div><strong>Panne :</strong> {recap.panne}</div>
            </>
          ) : (
            <>
                  <div><strong>Code intervention :</strong> {recap.code}</div>
                  <div><strong>Pièce :</strong> {recap.piece}</div>
            </>
          )}
              
              {recap.commentaire && (
                <div className="md:col-span-2"><strong>Commentaire :</strong> {recap.commentaire}</div>
              )}
              
              {recap.remplace === 'oui' && (
                <div className="md:col-span-2"><strong>Remplacé par :</strong> {recap.remplacement}</div>
              )}
              
              <div className="md:col-span-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <strong>Technicien :</strong> {technicien?.prenom} {technicien?.nom} - {technicien?.matricule}
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border bg-white p-3">
                  <p className="mb-2 text-sm font-medium text-primary">Signature technicien</p>
                  {recap.technicienSignature ? (
                    <img src={recap.technicienSignature} alt="Signature technicien" className="h-24 w-full object-contain" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Non disponible</p>
                  )}
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="mb-2 text-sm font-medium text-primary">Signature chef d'agence</p>
                  {recap.chefAgenceSignature ? (
                    <img src={recap.chefAgenceSignature} alt="Signature chef d'agence" className="h-24 w-full object-contain" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Non disponible</p>
                  )}
                </div>
              </div>

              {recap.validationFile?.fileName && (
                <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <strong>Fiche de validation :</strong> {recap.validationFile.fileName}
                  {recap.validationFile.publicUrl && (
                    <>
                      {' '}-
                      <a href={recap.validationFile.publicUrl} target="_blank" rel="noreferrer" className="ml-1 text-primary underline">
                        Ouvrir la fiche enregistrée
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
        </CardContent>
        <CardFooter>
            <Button 
              onClick={resetForm} 
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              Nouvelle Intervention
            </Button>
        </CardFooter>
      </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-6"
    >
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <ClipboardList className="mr-3 h-8 w-8" />
            Faire une Maintenance
          </CardTitle>
          <CardDescription>
            Saisissez et archivez une intervention de maintenance sur un terminal.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiStatCard
          icon={Globe}
          label="Régions disponibles"
          value={availableRegionsCount}
          helper="Régions proposées pour orienter l'intervention."
          tone="blue"
        />
        <KpiStatCard
          icon={Building2}
          label="Agences filtrées"
          value={availableAgencesCount}
          helper="Agences disponibles selon la région sélectionnée."
          tone="violet"
        />
        <KpiStatCard
          icon={Wrench}
          label="Terminaux ciblables"
          value={availableTerminauxCount}
          helper="Terminaux actifs de l'agence actuellement choisie."
          tone="emerald"
        />
        <KpiStatCard
          icon={CalendarClock}
          label="Interventions récentes"
          value={recentInterventionsCount}
          helper="Historique récent chargé pour le périmètre courant."
          tone="amber"
        />
      </div>

      <Card className="shadow-lg glassmorphism">
      <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl text-primary">Fiche de Maintenance</CardTitle>
              <CardDescription>
                Étape {step} sur 3 - Préparez, validez et archivez l'intervention avec signatures
              </CardDescription>
            </div>
            {step > 1 && selectedAgence && selectedTerminal && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-medium text-primary">
                  <Building2 className="h-3 w-3" />
                  {selectedAgence.nom}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">
                  <Wrench className="h-3 w-3" />
                  {selectedTerminal.reference}
                </span>
                {form.sousEnsemble && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                    <ClipboardList className="h-3 w-3" />
                    {form.sousEnsemble}
                  </span>
                )}
              </div>
            )}
          </div>
      </CardHeader>
        <CardContent className="space-y-6">
        {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-primary">Sélection du Terminal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="region">Région</Label>
                  <Combobox
                    options={regionsOptions}
                    value={form.region}
                    onSelect={handleChange('region')}
                    placeholder="Choisir une région"
                    searchPlaceholder="Rechercher une région..."
                    emptyText="Aucune région trouvée."
                    disabled={isLoading}
                  />
            </div>

            <div className="space-y-2">
                  <Label htmlFor="agence">Agence *</Label>
                  <Combobox
                    options={agencesOptions}
                    value={form.agence}
                    onSelect={handleChange('agence')}
                    placeholder="Choisir une agence"
                    searchPlaceholder="Rechercher une agence..."
                    emptyText="Aucune agence trouvée."
                    disabled={isLoading}
                  />
            </div>
                
            <div className="space-y-2">
                  <Label htmlFor="terminal">Terminal *</Label>
                  <Combobox
                    options={terminauxOptions}
                    value={form.terminal}
                    onSelect={handleChange('terminal')}
                    placeholder="Choisir un terminal"
                    searchPlaceholder="Rechercher un terminal..."
                    emptyText="Aucun terminal trouvé pour cette agence."
                    disabled={!form.agence || isLoading}
                  />
            </div>
                
            <div className="space-y-2">
                  <Label htmlFor="sousEnsemble">Sous-ensemble *</Label>
                  <Combobox
                    options={sousEnsemblesOptions}
                    value={form.sousEnsemble}
                    onSelect={handleChange('sousEnsemble')}
                    placeholder="Choisir un sous-ensemble"
                    searchPlaceholder="Rechercher un équipement..."
                    emptyText="Aucun équipement associé à ce terminal."
                    disabled={!form.terminal || isLoading}
                  />
            </div>
          </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <h4 className="text-lg font-medium text-primary">10 dernières interventions</h4>
                  <p className="text-sm text-muted-foreground">
                    {form.agence
                      ? `Historique filtré pour ${selectedAgence?.nom || "l'agence sélectionnée"}${selectedTerminal ? `, ${selectedTerminal.reference}` : ''}${form.sousEnsemble ? `, ${form.sousEnsemble}` : ''}.`
                      : "Sélectionnez une agence pour afficher l'historique récent des interventions."}
                  </p>
                </div>

                {!form.agence ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    L'historique apparaît dès que vous choisissez une agence, puis il se resserre automatiquement avec le terminal et le sous-ensemble.
                  </div>
                ) : isRecentInterventionsLoading ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    Chargement des dernières interventions...
                  </div>
                ) : (
                  <Table>
                    <TableCaption>
                      {recentInterventions.length === 0
                        ? 'Aucune intervention trouvée pour ce filtre.'
                        : `Affichage des ${recentInterventions.length} intervention(s) les plus récentes. Cliquez sur une ligne pour afficher son PDF.`}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Terminal</TableHead>
                        <TableHead>Sous-ensemble</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentInterventions.length > 0 ? recentInterventions.map((intervention) => (
                        <TableRow
                          key={intervention.id}
                          className="cursor-pointer hover:bg-primary/5 transition-colors"
                          onClick={() => downloadHistoryPdf(intervention)}
                          title="Cliquer pour afficher/télécharger le PDF"
                        >
                          <TableCell className="whitespace-nowrap">{formatInterventionDate(intervention.date_intervention || intervention.date_fin)}</TableCell>
                          <TableCell className="font-medium">{intervention.terminal_reference}</TableCell>
                          <TableCell>{intervention.sous_ensemble}</TableCell>
                          <TableCell>{getInterventionTypeLabel(intervention.type_intervention)}</TableCell>
                          <TableCell>{getInterventionCodeLabel(intervention)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              {pdfDownloadingId === intervention.id && (
                                <svg className="h-3 w-3 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                              )}
                              {intervention.statut}
                            </span>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                            Aucun historique disponible pour la sélection actuelle.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-primary">Détails de l'Intervention</h3>
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Type d'intervention *</Label>
                  <RadioGroup
                    value={form.typeIntervention}
                    onValueChange={handleChange('typeIntervention')}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="curative" id="curative" />
                      <Label htmlFor="curative">Curative (Réparation)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="preventive" id="preventive" />
                      <Label htmlFor="preventive">Préventive (Maintenance)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {form.typeIntervention === 'curative' ? (
              <>
                <div className="space-y-2">
                        <Label htmlFor="code">Code panne *</Label>
                        <Combobox
                          options={codesPannesOptions}
                          value={form.code}
                          onSelect={handleChange('code')}
                          placeholder="Choisir un code de panne"
                          searchPlaceholder="Rechercher un code ou libellé..."
                          emptyText="Aucun code de panne trouvé."
                          disabled={isLoading}
                        />
                </div>
                <div className="space-y-2">
                        <Label htmlFor="panne">Description panne *</Label>
                        <Input 
                          value={form.panne} 
                          onChange={(e) => handleChange('panne')(e.target.value)}
                          placeholder="Décrivez la panne constatée"
                          disabled={isLoading}
                        />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                        <Label htmlFor="code">Code intervention *</Label>
                        <Combobox
                          options={codesInterventionsOptions}
                          value={form.code}
                          onSelect={handleChange('code')}
                          placeholder="Choisir un code d'intervention"
                          searchPlaceholder="Rechercher un code ou libellé..."
                          emptyText="Aucun code d'intervention trouvé."
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="piece">Pièce utilisée</Label>
                        <Combobox
                          options={piecesRechangeOptions}
                          value={form.piece}
                          onSelect={handleChange('piece')}
                          placeholder="Choisir une pièce de rechange"
                          searchPlaceholder="Rechercher une pièce..."
                          emptyText="Aucune pièce disponible en stock."
                          disabled={isLoading}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commentaire">Commentaire</Label>
                  <Textarea 
                    value={form.commentaire} 
                    onChange={(e) => handleChange('commentaire')(e.target.value)}
                    placeholder="Détails de l'intervention, observations, remarques techniques..."
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Sous ensemble remplacé ?</Label>
                    <RadioGroup
                      value={form.remplace}
                      onValueChange={handleChange('remplace')}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="non" id="non" />
                        <Label htmlFor="non">Non</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="oui" id="oui" />
                        <Label htmlFor="oui">Oui</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {form.remplace === 'oui' && (
                    <div className="space-y-2">
                      <Label htmlFor="remplacement">Référence de remplacement *</Label>
                      <Combobox
                        options={replacementOptions}
                        value={form.remplacement}
                        onSelect={handleReplacementSelect}
                        placeholder="Choisir un sous-ensemble disponible"
                        searchPlaceholder="Rechercher par référence..."
                        emptyText={isLoadingReplacements ? 'Chargement...' : 'Aucun sous-ensemble disponible.'}
                        disabled={isLoading || isLoadingReplacements}
                      />
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}

          {step === 3 && (
            <div className="space-y-8">
              <div className="overflow-hidden rounded-xl border bg-gradient-to-r from-slate-50 via-white to-blue-50 shadow-sm">
                <div className="flex flex-wrap items-center gap-4 px-5 py-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="inline-flex shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Étape finale
                    </span>
                    <h3 className="text-base font-semibold tracking-tight text-primary truncate">Validation de l'intervention</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <div className="rounded-lg border border-white/70 bg-white/90 px-3 py-1.5">
                      <span className="text-muted-foreground uppercase tracking-wide mr-1.5">Date</span>
                      <span className="font-medium">{formatValidationDate()}</span>
                    </div>
                    <div className="rounded-lg border border-white/70 bg-white/90 px-3 py-1.5">
                      <span className="text-muted-foreground uppercase tracking-wide mr-1.5">Agence</span>
                      <span className="font-medium">{selectedAgence?.nom || "N/A"}</span>
                    </div>
                    <div className="rounded-lg border border-white/70 bg-white/90 px-3 py-1.5">
                      <span className="text-muted-foreground uppercase tracking-wide mr-1.5">État</span>
                      <span className={`font-medium ${chefAgence ? 'text-emerald-700' : 'text-amber-700'}`}>{validationStatusText}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="text-xl font-semibold text-primary">Fiche de validation d'intervention</h4>
                      <p className="text-sm text-muted-foreground">Mise en page resserrée pour lecture et impression</p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                      <p><strong>Terminal :</strong> {selectedTerminal?.reference || 'N/A'}</p>
                      <p><strong>Sous-ensemble :</strong> {form.sousEnsemble || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Contexte</h5>
                        <span className="text-xs text-muted-foreground">Document pret a signer</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ValidationInfoBlock label="Agence" value={selectedAgence?.nom || 'N/A'} tone="accent" />
                        <ValidationInfoBlock label="Terminal" value={selectedTerminal?.reference || 'N/A'} />
                        <ValidationInfoBlock label="Type d'intervention" value={getInterventionTypeLabel(form.typeIntervention)} />
                        <ValidationInfoBlock label="Sous-ensemble" value={form.sousEnsemble || 'N/A'} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Constat et traitement</h5>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ValidationInfoBlock label="Code" value={getCurrentInterventionCodeLabel()} tone="accent" />
                        <ValidationInfoBlock label={currentDetailLabel} value={currentDetailValue} />
                        <ValidationInfoBlock label="Remplacement" value={remplacementValue} />
                        <ValidationInfoBlock label="Commentaire" value={form.commentaire || 'Aucun commentaire'} fullWidth tone="default" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-base font-semibold text-primary">Acteurs de validation</h4>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${validationReadyCount === 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {validationReadyCount}/2 signes
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border bg-slate-50/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Technicien</p>
                        <p className="mt-1 font-medium text-slate-900">{technicien?.prenom} {technicien?.nom}</p>
                        <p className="text-sm text-muted-foreground">{technicien?.matricule || 'Sans matricule'}</p>
                        <p className={`mt-2 text-xs font-medium ${technicienSignature ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {technicienSignature ? 'Signature validee' : 'Signature en attente'}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-slate-50/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Chef d'agence</p>
                        {chefAgence ? (
                          <>
                            <p className="mt-1 font-medium text-slate-900">{chefAgence.prenom} {chefAgence.nom}</p>
                            <p className="text-sm text-muted-foreground">{chefAgence.matricule || chefAgence.codePDV || 'Aucune reference'}</p>
                            <p className={`mt-2 text-xs font-medium ${chefAgenceSignature ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {chefAgenceSignature ? 'Signature validee' : 'Signature en attente'}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-red-600">
                            Aucun chef d'agence n'est actuellement associe a l'agence selectionnee.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h4 className="mb-4 text-base font-semibold text-primary">Etat du dossier</h4>
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3 rounded-xl border bg-slate-50/80 px-4 py-3">
                        <span>Fiche de validation</span>
                        <span className="font-medium text-emerald-700">Prete</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 rounded-xl border bg-slate-50/80 px-4 py-3">
                        <span>Signatures</span>
                        <span className={`font-medium ${validationReadyCount === 2 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {validationStatusText}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 rounded-xl border bg-slate-50/80 px-4 py-3">
                        <span>Sortie du document</span>
                        <span className="font-medium text-slate-900">PDF ou archivage</span>
                      </div>
                    </div>
                  </div>

                  {savedValidationFile?.fileName && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm shadow-sm">
                      <p className="font-medium text-emerald-800">Derniere fiche preparee</p>
                      <p className="mt-2 break-words text-emerald-900">{savedValidationFile.fileName}</p>
                      {savedValidationFile.publicUrl && (
                        <a
                          href={savedValidationFile.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-primary underline"
                        >
                          Ouvrir la version enregistree
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-primary">Signatures</h4>
                    <p className="text-sm text-muted-foreground">
                      Les deux signatures sont requises avant l'enregistrement definitif.
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${validationReadyCount === 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {validationReadyCount === 2 ? 'Validation complete' : 'Validation en cours'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <ValidationSignatureField
                    title="Signature du technicien"
                    signerName={`${technicien?.prenom || ''} ${technicien?.nom || ''}`.trim() || 'Technicien'}
                    signatureRef={technicienSignatureRef}
                    signatureValue={technicienSignature}
                    onValidate={() => validateSignature(technicienSignatureRef, setTechnicienSignature, 'Le technicien')}
                    onClear={() => clearSignature(technicienSignatureRef, setTechnicienSignature)}
                    disabled={isLoading}
                    statusLabel={technicienSignature ? 'Validee' : 'En attente'}
                    helperText="Le technicien confirme ici la realisation de l'intervention et les informations mentionnees."
                  />
                  <ValidationSignatureField
                    title="Signature du chef d'agence"
                    signerName={chefAgenceNomComplet || "Chef d'agence introuvable"}
                    signatureRef={chefAgenceSignatureRef}
                    signatureValue={chefAgenceSignature}
                    onValidate={() => validateSignature(chefAgenceSignatureRef, setChefAgenceSignature, "Le chef d'agence")}
                    onClear={() => clearSignature(chefAgenceSignatureRef, setChefAgenceSignature)}
                    disabled={isLoading || !chefAgence}
                    statusLabel={chefAgenceSignature ? 'Validee' : 'En attente'}
                    helperText={chefAgence
                      ? "Le chef d'agence valide la conformite de la fiche avant export ou archivage."
                      : "Associez d'abord un chef d'agence a cette agence pour activer cette signature."}
                  />
                </div>
              </div>
            </div>
          )}
      </CardContent>
        
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isLoading}>
              ← Retour
            </Button>
          )}
          
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              disabled={!form.agence || !form.terminal || !form.sousEnsemble || isLoading}
              className="ml-auto bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              Suivant →
            </Button>
          )}
          
          {step === 2 && (
            <Button 
              onClick={() => setStep(3)}
              disabled={!form.code || (form.remplace === 'oui' && !form.remplacement) || isLoading}
              className="ml-auto bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              Suivant →
            </Button>
          )}

          {step === 3 && (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={downloadValidationPdf}
                disabled={!technicienSignature || !chefAgenceSignature || !chefAgence || isLoading}
                className="w-full sm:w-auto"
              >
                Télécharger en PDF
              </Button>
              <Button 
                onClick={finish}
                disabled={!technicienSignature || !chefAgenceSignature || !chefAgence || isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 sm:w-auto"
              >
                {isLoading ? 'Enregistrement...' : 'Enregistrer la validation'}
              </Button>
            </div>
          )}
      </CardFooter>
    </Card>
    </motion.div>
  );
};

export default MaintenanceTab;
