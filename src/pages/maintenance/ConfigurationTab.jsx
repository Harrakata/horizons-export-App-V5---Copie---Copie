import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit, MapPinned, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { buildRegionOptions, fetchRegions, normalizeRegionText } from '@/lib/regions';
import { supabase } from '@/lib/supabaseClient';
import EquipmentManager from './EquipmentManager';

const ALL_FILTER_VALUE = '__all__';

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isEquipmentAvailableStatus = (status) => normalizeText(status) === 'disponible';

const DEFAULT_FORM_DATA = {
  ref: '',
  type: '2020',
  position: '',
  ip: '',
  imprimante: '',
  lecteur: '',
  ecran: '',
  afficheur: '',
};

const EQUIPMENT_FIELD_CONFIG = [
  {
    formKey: 'imprimante',
    pluralKey: 'imprimantes',
    terminalKey: 'imprimante_reference',
    label: 'Imprimante',
  },
  {
    formKey: 'lecteur',
    pluralKey: 'lecteurs',
    terminalKey: 'lecteur_reference',
    label: 'Lecteur',
  },
  {
    formKey: 'ecran',
    pluralKey: 'ecrans',
    terminalKey: 'ecran_reference',
    label: 'Écran',
  },
  {
    formKey: 'afficheur',
    pluralKey: 'afficheurs',
    terminalKey: 'afficheur_reference',
    label: 'Afficheur client',
  },
];

const getTerminalStatusBadgeClass = (status) => {
  const normalizedStatus = normalizeText(status);

  if (normalizedStatus === 'actif') {
    return 'border-green-200 bg-green-50 text-green-700';
  }

  if (normalizedStatus === 'en maintenance') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalizedStatus === 'hors service') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const ConfigurationTab = ({
  canManage = true,
  lockedAgenceId = null,
  lockedAgenceName = '',
  showEquipmentManagement = true,
  readOnlyMessage = '',
}) => {
  const { toast } = useToast();
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [equipments, setEquipments] = useState({
    imprimantes: [],
    ecrans: [],
    lecteurs: [],
    afficheurs: [],
  });
  const [agenceId, setAgenceId] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [terminaux, setTerminaux] = useState([]);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [editingTerminalId, setEditingTerminalId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parkFilters, setParkFilters] = useState({
    region: ALL_FILTER_VALUE,
    agenceId: ALL_FILTER_VALUE,
    type: ALL_FILTER_VALUE,
    statut: ALL_FILTER_VALUE,
    search: '',
  });

  const ipPool = ['192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.13'];

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [
        regionsResponse,
        agencesResponse,
        terminauxResponse,
        imprimantesResponse,
        ecransResponse,
        lecteursResponse,
        afficheurResponse,
      ] = await Promise.all([
        fetchRegions(),
        supabase.from('agences').select('id, nom, nbreTerminaux, codePDV, region').order('nom', { ascending: true }),
        supabase
          .from('terminaux')
          .select(
            'id, reference, type_terminal, position, adresse_ip, agence_id, imprimante_reference, lecteur_reference, ecran_reference, afficheur_reference, statut'
          )
          .order('reference', { ascending: true }),
        supabase.from('equipments_imprimantes').select('*').order('reference', { ascending: true }),
        supabase.from('equipments_ecrans').select('*').order('reference', { ascending: true }),
        supabase.from('equipments_lecteurs').select('*').order('reference', { ascending: true }),
        supabase.from('equipments_afficheurs').select('*').order('reference', { ascending: true }),
      ]);

      if (regionsResponse.error) {
        toast({
          title: 'Erreur chargement régions',
          description: regionsResponse.error.message,
          variant: 'destructive',
        });
      } else {
        setRegions(regionsResponse.data || []);
      }

      if (agencesResponse.error) {
        toast({
          title: 'Erreur chargement agences',
          description: agencesResponse.error.message,
          variant: 'destructive',
        });
      } else {
        setAgences(agencesResponse.data || []);
      }

      if (terminauxResponse.error) {
        toast({
          title: 'Erreur chargement terminaux',
          description: terminauxResponse.error.message,
          variant: 'destructive',
        });
      } else {
        setTerminaux(terminauxResponse.data || []);
      }

      const equipmentResponses = [
        { key: 'imprimantes', response: imprimantesResponse },
        { key: 'ecrans', response: ecransResponse },
        { key: 'lecteurs', response: lecteursResponse },
        { key: 'afficheurs', response: afficheurResponse },
      ];

      const equipmentData = {};
      equipmentResponses.forEach(({ key, response }) => {
        if (response.error) {
          toast({
            title: `Erreur chargement ${key}`,
            description: response.error.message,
            variant: 'destructive',
          });
          equipmentData[key] = [];
        } else {
          equipmentData[key] = response.data || [];
        }
      });

      setEquipments(equipmentData);
    } catch (error) {
      console.error('Erreur chargement configuration terminaux:', error);
      toast({
        title: 'Erreur de chargement',
        description: 'Impossible de charger les données.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agenciesById = useMemo(
    () =>
      agences.reduce((accumulator, agence) => {
        accumulator[String(agence.id)] = agence;
        return accumulator;
      }, {}),
    [agences]
  );

  const resolvedLockedAgence = useMemo(() => {
    if (lockedAgenceId) {
      return agences.find((agence) => String(agence.id) === String(lockedAgenceId)) || null;
    }

    if (lockedAgenceName) {
      return agences.find((agence) => normalizeText(agence.nom) === normalizeText(lockedAgenceName)) || null;
    }

    return null;
  }, [agences, lockedAgenceId, lockedAgenceName]);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setEditingTerminalId(null);

    if (resolvedLockedAgence?.id) {
      setAgenceId(String(resolvedLockedAgence.id));
      setFormRegion(resolvedLockedAgence.region || '');
      return;
    }

    setAgenceId('');
    setFormRegion('');
  }, [resolvedLockedAgence]);

  useEffect(() => {
    if (resolvedLockedAgence?.id) {
      setAgenceId(String(resolvedLockedAgence.id));
      setFormRegion(resolvedLockedAgence.region || '');
      setParkFilters((previousState) => ({
        ...previousState,
        region: resolvedLockedAgence.region || ALL_FILTER_VALUE,
        agenceId: String(resolvedLockedAgence.id),
      }));
    }
  }, [resolvedLockedAgence]);

  const derivedRegionsFromAgences = useMemo(
    () =>
      agences
        .filter((agence) => agence.region)
        .map((agence) => ({ nom: agence.region, codeRegion: '' })),
    [agences]
  );

  const regionSource = regions.length > 0 ? regions : derivedRegionsFromAgences;

  const regionOptions = useMemo(() => buildRegionOptions(regionSource), [regionSource]);
  const parkRegionOptions = useMemo(
    () => buildRegionOptions(regionSource, { includeAllLabel: 'Toutes les régions' }),
    [regionSource]
  );

  const terminauxByAgence = useMemo(
    () =>
      terminaux.reduce((accumulator, terminal) => {
        const agencyKey = String(terminal.agence_id ?? '');
        if (!accumulator[agencyKey]) {
          accumulator[agencyKey] = [];
        }
        accumulator[agencyKey].push(terminal);
        return accumulator;
      }, {}),
    [terminaux]
  );

  const filteredAgencesForForm = useMemo(() => {
    if (!formRegion) {
      return resolvedLockedAgence ? [resolvedLockedAgence] : [];
    }

    return agences.filter(
      (agence) => normalizeRegionText(agence.region) === normalizeRegionText(formRegion)
    );
  }, [agences, formRegion, resolvedLockedAgence]);

  const agencesOptions = useMemo(
    () =>
      filteredAgencesForForm.map((agence) => ({
        value: String(agence.id),
        label: `${agence.nom}${agence.codePDV ? ` • ${agence.codePDV}` : ''} (${(terminauxByAgence[String(agence.id)] || []).length}${Number.isFinite(Number(agence.nbreTerminaux)) ? ` / ${Number(agence.nbreTerminaux)}` : ''} terminaux)`,
      })),
    [filteredAgencesForForm, terminauxByAgence]
  );

  const selectedAgency = agenceId ? agenciesById[String(agenceId)] || null : null;
  const selectedAgencyTerminalCount = selectedAgency
    ? (terminauxByAgence[String(selectedAgency.id)] || []).length
    : 0;
  const selectedAgencyTerminalLimit = selectedAgency?.nbreTerminaux;
  const hasSelectedAgencyTerminalLimit =
    selectedAgencyTerminalLimit !== null &&
    selectedAgencyTerminalLimit !== undefined &&
    selectedAgencyTerminalLimit !== '' &&
    Number.isFinite(Number(selectedAgencyTerminalLimit));
  const normalizedSelectedAgencyTerminalLimit = hasSelectedAgencyTerminalLimit
    ? Number(selectedAgencyTerminalLimit)
    : null;
  const isEditingOnSameAgency =
    Boolean(editingTerminalId) &&
    String(editingTerminal?.agence_id ?? '') === String(selectedAgency?.id ?? '');
  const selectedAgencyHasReachedCapacity =
    hasSelectedAgencyTerminalLimit &&
    !isEditingOnSameAgency &&
    selectedAgencyTerminalCount >= normalizedSelectedAgencyTerminalLimit;

  useEffect(() => {
    if (!agenceId || resolvedLockedAgence) {
      return;
    }

    const currentAgency = agenciesById[String(agenceId)];
    if (!currentAgency) {
      setAgenceId('');
      return;
    }

    if (formRegion && normalizeRegionText(currentAgency.region) !== normalizeRegionText(formRegion)) {
      setAgenceId('');
    }
  }, [agenceId, agenciesById, formRegion, resolvedLockedAgence]);

  const showReadOnlyToast = () => {
    toast({
      title: 'Lecture seule',
      description: readOnlyMessage || 'La configuration des terminaux est en lecture seule sur cet écran.',
      variant: 'destructive',
    });
  };

  const editingTerminal = useMemo(
    () =>
      editingTerminalId
        ? terminaux.find((terminal) => String(terminal.id) === String(editingTerminalId)) || null
        : null,
    [editingTerminalId, terminaux]
  );

  const ipOptions = useMemo(
    () =>
      Array.from(new Set([...ipPool, formData.ip].filter(Boolean))).map((ip) => ({
        value: ip,
        label: ip,
      })),
    [formData.ip]
  );

  const assignedEquipmentReferences = useMemo(
    () =>
      terminaux
        .filter((terminal) => String(terminal.id) !== String(editingTerminalId ?? ''))
        .reduce(
          (accumulator, terminal) => {
            if (terminal.imprimante_reference) {
              accumulator.imprimantes.add(normalizeText(terminal.imprimante_reference));
            }
            if (terminal.lecteur_reference) {
              accumulator.lecteurs.add(normalizeText(terminal.lecteur_reference));
            }
            if (terminal.ecran_reference) {
              accumulator.ecrans.add(normalizeText(terminal.ecran_reference));
            }
            if (terminal.afficheur_reference) {
              accumulator.afficheurs.add(normalizeText(terminal.afficheur_reference));
            }
            return accumulator;
          },
          {
            imprimantes: new Set(),
            lecteurs: new Set(),
            ecrans: new Set(),
            afficheurs: new Set(),
          }
        ),
    [editingTerminalId, terminaux]
  );

  const buildEquipmentOptions = useCallback(
    (equipmentList, equipmentType, selectedReference) =>
      equipmentList
        .filter((equipment) => {
          const normalizedReference = normalizeText(equipment.reference);
          const isSelectedEquipment = normalizeText(selectedReference) === normalizedReference;
          const isAssigned = assignedEquipmentReferences[equipmentType].has(normalizedReference);
          return isSelectedEquipment || (!isAssigned && isEquipmentAvailableStatus(equipment.statut));
        })
        .map((equipment) => ({
          value: equipment.reference,
          label: `${equipment.reference} - ${equipment.marque || 'Marque N/A'} ${equipment.modele || ''}`.trim(),
        })),
    [assignedEquipmentReferences]
  );

  const imprimantesOptions = useMemo(
    () => buildEquipmentOptions(equipments.imprimantes, 'imprimantes', formData.imprimante),
    [buildEquipmentOptions, equipments.imprimantes, formData.imprimante]
  );
  const lecteursOptions = useMemo(
    () => buildEquipmentOptions(equipments.lecteurs, 'lecteurs', formData.lecteur),
    [buildEquipmentOptions, equipments.lecteurs, formData.lecteur]
  );
  const ecransOptions = useMemo(
    () => buildEquipmentOptions(equipments.ecrans, 'ecrans', formData.ecran),
    [buildEquipmentOptions, equipments.ecrans, formData.ecran]
  );
  const afficheurOptions = useMemo(
    () => buildEquipmentOptions(equipments.afficheurs, 'afficheurs', formData.afficheur),
    [buildEquipmentOptions, equipments.afficheurs, formData.afficheur]
  );

  const findEquipmentConflict = useCallback(
    (formKey, selectedReference) => {
      if (!selectedReference) {
        return null;
      }

      const config = EQUIPMENT_FIELD_CONFIG.find((item) => item.formKey === formKey);
      if (!config) {
        return null;
      }

      return (
        terminaux.find(
          (terminal) =>
            String(terminal.id) !== String(editingTerminalId ?? '') &&
            normalizeText(terminal[config.terminalKey]) === normalizeText(selectedReference)
        ) || null
      );
    },
    [editingTerminalId, terminaux]
  );

  const handleSaveTerminal = async () => {
    if (!canManage) {
      showReadOnlyToast();
      return;
    }

    if (!formRegion || !agenceId || !formData.ref || !formData.type || !formData.position) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez renseigner la région, l’agence, la référence, le type et la position.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedAgencyHasReachedCapacity) {
      toast({
        title: 'Capacité agence atteinte',
        description: `${selectedAgency?.nom || "L'agence sélectionnée"} a déjà ${selectedAgencyTerminalCount} terminal(aux) configuré(s) pour ${normalizedSelectedAgencyTerminalLimit} déclaré(s) dans l’espace Agence.`,
        variant: 'destructive',
      });
      return;
    }

    const duplicatedReferenceTerminal = terminaux.find(
      (terminal) =>
        String(terminal.id) !== String(editingTerminalId ?? '') &&
        normalizeText(terminal.reference) === normalizeText(formData.ref)
    );

    if (duplicatedReferenceTerminal) {
      toast({
        title: 'Référence déjà utilisée',
        description: `La référence ${formData.ref.trim()} est déjà affectée au terminal ${duplicatedReferenceTerminal.reference}.`,
        variant: 'destructive',
      });
      return;
    }

    for (const config of EQUIPMENT_FIELD_CONFIG) {
      const conflictTerminal = findEquipmentConflict(config.formKey, formData[config.formKey]);
      if (conflictTerminal) {
        const conflictAgency = agenciesById[String(conflictTerminal.agence_id)];
        toast({
          title: `${config.label} déjà configuré`,
          description: `${formData[config.formKey]} est déjà affecté au terminal ${conflictTerminal.reference}${conflictAgency?.nom ? ` de ${conflictAgency.nom}` : ''}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    const payload = {
      reference: formData.ref.trim(),
      type_terminal: formData.type.trim(),
      position: formData.position.trim(),
      adresse_ip: formData.ip || null,
      agence_id: agenceId,
      imprimante_reference: formData.imprimante || null,
      lecteur_reference: formData.lecteur || null,
      ecran_reference: formData.ecran || null,
      afficheur_reference: formData.afficheur || null,
      statut: editingTerminal?.statut || 'Actif',
    };

    setIsLoading(true);

    const query = editingTerminalId
      ? supabase.from('terminaux').update(payload).eq('id', editingTerminalId)
      : supabase.from('terminaux').insert(payload);

    const { error } = await query;

    if (error) {
      toast({
        title: "Erreur d'enregistrement",
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: editingTerminalId ? 'Terminal mis à jour' : 'Terminal ajouté',
      description: editingTerminalId
        ? 'La configuration du terminal a été mise à jour.'
        : 'Le terminal a été configuré avec succès.',
      className: 'bg-green-500 text-white',
    });

    resetForm();
    await loadData();
    setIsLoading(false);
  };

  const handleEditTerminal = (terminal) => {
    if (!canManage) {
      showReadOnlyToast();
      return;
    }

    const agency = agenciesById[String(terminal.agence_id)];

    setEditingTerminalId(terminal.id);
    setAgenceId(String(terminal.agence_id));
    setFormRegion(agency?.region || '');
    setFormData({
      ref: terminal.reference || '',
      type: terminal.type_terminal || '2020',
      position: terminal.position || '',
      ip: terminal.adresse_ip || '',
      imprimante: terminal.imprimante_reference || '',
      lecteur: terminal.lecteur_reference || '',
      ecran: terminal.ecran_reference || '',
      afficheur: terminal.afficheur_reference || '',
    });
  };

  const handleDeleteTerminal = async (terminal) => {
    if (!canManage) {
      showReadOnlyToast();
      return;
    }

    if (!window.confirm(`Supprimer le terminal ${terminal.reference} ? Cette action retirera aussi sa configuration actuelle.`)) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from('terminaux').delete().eq('id', terminal.id);

    if (error) {
      toast({
        title: 'Erreur de suppression',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Terminal supprimé',
      description: `Le terminal ${terminal.reference} a été supprimé du parc.`,
      className: 'bg-red-500 text-white',
    });

    if (String(editingTerminalId) === String(terminal.id)) {
      resetForm();
    }

    await loadData();
    setIsLoading(false);
  };

  const filteredAgencesForPark = useMemo(
    () =>
      agences.filter(
        (agence) =>
          parkFilters.region === ALL_FILTER_VALUE ||
          normalizeRegionText(agence.region) === normalizeRegionText(parkFilters.region)
      ),
    [agences, parkFilters.region]
  );

  const parkAgencyOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Toutes les agences' },
      ...filteredAgencesForPark.map((agence) => ({
        value: String(agence.id),
        label: `${agence.nom}${agence.codePDV ? ` • ${agence.codePDV}` : ''}`,
      })),
    ],
    [filteredAgencesForPark]
  );

  const parkTerminalRows = useMemo(
    () =>
      terminaux.map((terminal) => {
        const agency = agenciesById[String(terminal.agence_id)];
        return {
          ...terminal,
          agenceNom: agency?.nom || 'Agence inconnue',
          agenceCode: agency?.codePDV || '',
          regionNom: agency?.region || '',
        };
      }),
    [agenciesById, terminaux]
  );

  const filteredParkTerminalRows = useMemo(() => {
    const normalizedSearch = normalizeText(parkFilters.search);

    return parkTerminalRows
      .filter(
        (terminal) =>
          parkFilters.region === ALL_FILTER_VALUE ||
          normalizeRegionText(terminal.regionNom) === normalizeRegionText(parkFilters.region)
      )
      .filter(
        (terminal) =>
          parkFilters.agenceId === ALL_FILTER_VALUE ||
          String(terminal.agence_id) === String(parkFilters.agenceId)
      )
      .filter(
        (terminal) => parkFilters.type === ALL_FILTER_VALUE || terminal.type_terminal === parkFilters.type
      )
      .filter(
        (terminal) => parkFilters.statut === ALL_FILTER_VALUE || terminal.statut === parkFilters.statut
      )
      .filter(
        (terminal) =>
          !normalizedSearch ||
          [
            terminal.regionNom,
            terminal.agenceNom,
            terminal.agenceCode,
            terminal.reference,
            terminal.type_terminal,
            terminal.position,
            terminal.adresse_ip,
            terminal.imprimante_reference,
            terminal.lecteur_reference,
            terminal.ecran_reference,
            terminal.afficheur_reference,
            terminal.statut,
          ].some((value) => normalizeText(value).includes(normalizedSearch))
      );
  }, [parkFilters, parkTerminalRows]);

  const configurationContent = (
    <div className="space-y-6">
      <Card className="relative overflow-hidden shadow-lg">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle>{editingTerminalId ? 'Modifier un terminal' : 'Configuration des terminaux'}</CardTitle>
          <CardDescription>
            {resolvedLockedAgence
              ? `Configurez les terminaux de ${resolvedLockedAgence.nom} en choisissant leurs sous-ensembles disponibles.`
              : 'Choisissez une région, puis une agence, afin de configurer ses terminaux.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {readOnlyMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {readOnlyMessage}
            </div>
          ) : null}

          <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-slate-600">
            Un sous-ensemble déjà configuré sur un terminal ne peut pas être réaffecté à un autre tant qu’il n’a pas été libéré.
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Région</Label>
              <Combobox
                options={regionOptions}
                value={formRegion}
                onSelect={(value) => {
                  if (resolvedLockedAgence) return;
                  setFormRegion(value);
                  setAgenceId('');
                }}
                placeholder="Choisir une région"
                searchPlaceholder="Rechercher une région..."
                emptyText="Aucune région trouvée."
                disabled={isLoading || Boolean(resolvedLockedAgence)}
              />
            </div>
            <div className="space-y-2">
              <Label>Agence</Label>
              <Combobox
                options={agencesOptions}
                value={agenceId}
                onSelect={(value) => {
                  setAgenceId(value);
                  const nextAgency = agenciesById[String(value)];
                  if (nextAgency?.region) {
                    setFormRegion(nextAgency.region);
                  }
                }}
                placeholder="Choisir une agence"
                searchPlaceholder="Rechercher une agence..."
                emptyText="Aucune agence trouvée."
                disabled={isLoading || Boolean(resolvedLockedAgence) || (!formRegion && !resolvedLockedAgence)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de terminal</Label>
              <Combobox
                options={[
                  { value: '2020', label: '2020' },
                  { value: '2031', label: '2031' },
                ]}
                value={formData.type}
                onSelect={(value) => setFormData((previousState) => ({ ...previousState, type: value }))}
                placeholder="Choisir un type"
                searchPlaceholder="Rechercher un type..."
                emptyText="Aucun type trouvé."
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Référence</Label>
              <Input
                value={formData.ref}
                onChange={(event) => setFormData((previousState) => ({ ...previousState, ref: event.target.value }))}
                placeholder="Ex: TERM-001"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input
                value={formData.position}
                onChange={(event) =>
                  setFormData((previousState) => ({ ...previousState, position: event.target.value }))
                }
                placeholder="Ex: Guichet 1"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Adresse IP</Label>
              <Combobox
                options={ipOptions}
                value={formData.ip}
                onSelect={(value) => setFormData((previousState) => ({ ...previousState, ip: value }))}
                placeholder="Choisir une adresse IP"
                searchPlaceholder="Rechercher une IP..."
                emptyText="Aucune IP disponible."
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Imprimante</Label>
              <Combobox
                options={imprimantesOptions}
                value={formData.imprimante}
                onSelect={(value) =>
                  setFormData((previousState) => ({ ...previousState, imprimante: value }))
                }
                placeholder="Choisir une imprimante"
                searchPlaceholder="Rechercher une imprimante..."
                emptyText="Aucune imprimante disponible."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Lecteur</Label>
              <Combobox
                options={lecteursOptions}
                value={formData.lecteur}
                onSelect={(value) => setFormData((previousState) => ({ ...previousState, lecteur: value }))}
                placeholder="Choisir un lecteur"
                searchPlaceholder="Rechercher un lecteur..."
                emptyText="Aucun lecteur disponible."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Écran</Label>
              <Combobox
                options={ecransOptions}
                value={formData.ecran}
                onSelect={(value) => setFormData((previousState) => ({ ...previousState, ecran: value }))}
                placeholder="Choisir un écran"
                searchPlaceholder="Rechercher un écran..."
                emptyText="Aucun écran disponible."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Afficheur client</Label>
              <Combobox
                options={afficheurOptions}
                value={formData.afficheur}
                onSelect={(value) => setFormData((previousState) => ({ ...previousState, afficheur: value }))}
                placeholder="Choisir un afficheur client"
                searchPlaceholder="Rechercher un afficheur..."
                emptyText="Aucun afficheur disponible."
                disabled={isLoading}
              />
            </div>
          </div>

          {selectedAgency ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                  <MapPinned className="h-4 w-4 text-primary" />
                  {selectedAgency.nom}
                </span>
                <span>Région : {selectedAgency.region || 'N/A'}</span>
                <span>Code PDV : {selectedAgency.codePDV || 'N/A'}</span>
                <span>
                  Terminaux configurés : {selectedAgencyTerminalCount}
                  {hasSelectedAgencyTerminalLimit ? ` / ${normalizedSelectedAgencyTerminalLimit}` : ''}
                </span>
              </div>

              {hasSelectedAgencyTerminalLimit ? (
                <div
                  className={`rounded-md px-3 py-2 text-xs ${
                    selectedAgencyHasReachedCapacity
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {selectedAgencyHasReachedCapacity
                    ? "Le nombre maximum de terminaux déclaré pour cette agence est atteint. Vous pouvez modifier un terminal existant, mais pas en ajouter un nouveau."
                    : `Capacité disponible : ${Math.max(
                        normalizedSelectedAgencyTerminalLimit - selectedAgencyTerminalCount,
                        0
                      )} terminal(aux) restant(s).`}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Le nombre de terminaux autorisé pour cette agence n’est pas encore défini dans l’espace Agence.
                </div>
              )}
            </div>
          ) : null}

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSaveTerminal}
              disabled={!agenceId || !formData.ref || isLoading || !canManage || selectedAgencyHasReachedCapacity}
              className="bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90"
            >
              {editingTerminalId ? 'Mettre à jour le terminal' : 'Sauvegarder le terminal'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden shadow-lg">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative space-y-4">
          <div className="flex flex-col gap-2">
            <CardTitle>Parc de Terminaux</CardTitle>
            <CardDescription>
              Consultez les terminaux configurés, filtrez-les par région ou agence, puis modifiez ou supprimez leurs affectations.
            </CardDescription>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label>Région</Label>
              <Combobox
                options={parkRegionOptions}
                value={parkFilters.region}
                onSelect={(value) =>
                  setParkFilters((previousState) => ({
                    ...previousState,
                    region: value || ALL_FILTER_VALUE,
                    agenceId: ALL_FILTER_VALUE,
                  }))
                }
                placeholder="Toutes les régions"
                searchPlaceholder="Rechercher une région..."
                emptyText="Aucune région trouvée."
                disabled={isLoading || Boolean(resolvedLockedAgence)}
              />
            </div>
            <div className="space-y-2">
              <Label>Agence</Label>
              <Combobox
                options={parkAgencyOptions}
                value={parkFilters.agenceId}
                onSelect={(value) =>
                  setParkFilters((previousState) => ({
                    ...previousState,
                    agenceId: value || ALL_FILTER_VALUE,
                  }))
                }
                placeholder="Toutes les agences"
                searchPlaceholder="Rechercher une agence..."
                emptyText="Aucune agence trouvée."
                disabled={isLoading || Boolean(resolvedLockedAgence)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Combobox
                options={[
                  { value: ALL_FILTER_VALUE, label: 'Tous les types' },
                  { value: '2020', label: '2020' },
                  { value: '2031', label: '2031' },
                ]}
                value={parkFilters.type}
                onSelect={(value) =>
                  setParkFilters((previousState) => ({
                    ...previousState,
                    type: value || ALL_FILTER_VALUE,
                  }))
                }
                placeholder="Tous les types"
                searchPlaceholder="Rechercher un type..."
                emptyText="Aucun type trouvé."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Combobox
                options={[
                  { value: ALL_FILTER_VALUE, label: 'Tous les statuts' },
                  { value: 'Actif', label: 'Actif' },
                  { value: 'Inactif', label: 'Inactif' },
                  { value: 'En maintenance', label: 'En maintenance' },
                  { value: 'Hors service', label: 'Hors service' },
                ]}
                value={parkFilters.statut}
                onSelect={(value) =>
                  setParkFilters((previousState) => ({
                    ...previousState,
                    statut: value || ALL_FILTER_VALUE,
                  }))
                }
                placeholder="Tous les statuts"
                searchPlaceholder="Rechercher un statut..."
                emptyText="Aucun statut trouvé."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={parkFilters.search}
                  onChange={(event) =>
                    setParkFilters((previousState) => ({ ...previousState, search: event.target.value }))
                  }
                  placeholder="Référence, agence, IP..."
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                {filteredParkTerminalRows.length === 0
                  ? 'Aucun terminal ne correspond aux filtres actuels.'
                  : `${filteredParkTerminalRows.length} terminal(aux) configuré(s).`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Région</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Adresse IP</TableHead>
                  <TableHead>Imprimante</TableHead>
                  <TableHead>Lecteur</TableHead>
                  <TableHead>Écran</TableHead>
                  <TableHead>Afficheur client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParkTerminalRows.map((terminal) => (
                  <TableRow key={terminal.id}>
                    <TableCell>{terminal.regionNom || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{terminal.agenceNom}</span>
                        <span className="text-xs text-muted-foreground">{terminal.agenceCode || 'Sans code PDV'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{terminal.reference}</TableCell>
                    <TableCell>{terminal.type_terminal || 'N/A'}</TableCell>
                    <TableCell>{terminal.position || 'N/A'}</TableCell>
                    <TableCell>{terminal.adresse_ip || 'N/A'}</TableCell>
                    <TableCell>{terminal.imprimante_reference || 'Non affectée'}</TableCell>
                    <TableCell>{terminal.lecteur_reference || 'Non affecté'}</TableCell>
                    <TableCell>{terminal.ecran_reference || 'Non affecté'}</TableCell>
                    <TableCell>{terminal.afficheur_reference || 'Non affecté'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTerminalStatusBadgeClass(terminal.statut)}>
                        {terminal.statut || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditTerminal(terminal)}
                        className="text-blue-500 hover:text-blue-700"
                        disabled={isLoading || !canManage}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTerminal(terminal)}
                        className="text-red-500 hover:text-red-700"
                        disabled={isLoading || !canManage}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!showEquipmentManagement) {
    return <div className="space-y-6">{configurationContent}</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="terminaux" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="terminaux">Configuration Terminaux</TabsTrigger>
          <TabsTrigger value="equipements">Gestion Équipements</TabsTrigger>
        </TabsList>

        <TabsContent value="terminaux">{configurationContent}</TabsContent>

        <TabsContent value="equipements">
          <EquipmentManager canManage={canManage} readOnlyMessage={readOnlyMessage} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigurationTab;
