import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/Combobox';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import EquipmentManager from './EquipmentManager';

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
};

const ConfigurationTab = ({
  canManage = true,
  lockedAgenceId = null,
  lockedAgenceName = '',
  showEquipmentManagement = true,
  readOnlyMessage = '',
}) => {
  const { toast } = useToast();
  const [agences, setAgences] = useState([]);
  const [equipments, setEquipments] = useState({
    imprimantes: [],
    ecrans: [],
    lecteurs: [],
  });
  const [agenceId, setAgenceId] = useState('');
  const [terminaux, setTerminaux] = useState({});
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);

  const ipPool = ['192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.13'];

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [
        agencesResponse,
        terminauxResponse,
        imprimantesResponse,
        ecransResponse,
        lecteursResponse,
      ] = await Promise.all([
        supabase.from('agences').select('id, nom, nbreTerminaux, codePDV, region').order('nom', { ascending: true }),
        supabase
          .from('terminaux')
          .select('id, reference, type_terminal, position, adresse_ip, agence_id, imprimante_reference, lecteur_reference, ecran_reference, statut')
          .order('reference', { ascending: true }),
        supabase.from('equipments_imprimantes').select('*').order('reference', { ascending: true }),
        supabase.from('equipments_ecrans').select('*').order('reference', { ascending: true }),
        supabase.from('equipments_lecteurs').select('*').order('reference', { ascending: true }),
      ]);

      if (agencesResponse.error) {
        toast({ title: 'Erreur chargement agences', description: agencesResponse.error.message, variant: 'destructive' });
      } else {
        setAgences(agencesResponse.data || []);
      }

      if (terminauxResponse.error) {
        toast({ title: 'Erreur chargement terminaux', description: terminauxResponse.error.message, variant: 'destructive' });
      } else {
        const groupedTerminaux = (terminauxResponse.data || []).reduce((accumulator, terminal) => {
          const agencyKey = String(terminal.agence_id ?? '');
          if (!accumulator[agencyKey]) {
            accumulator[agencyKey] = [];
          }
          accumulator[agencyKey].push({
            id: terminal.id,
            ref: terminal.reference,
            type: terminal.type_terminal,
            position: terminal.position,
            ip: terminal.adresse_ip,
            imprimante: terminal.imprimante_reference,
            lecteur: terminal.lecteur_reference,
            ecran: terminal.ecran_reference,
            statut: terminal.statut,
          });
          return accumulator;
        }, {});
        setTerminaux(groupedTerminaux);
      }

      const equipmentResponses = [
        { key: 'imprimantes', response: imprimantesResponse },
        { key: 'ecrans', response: ecransResponse },
        { key: 'lecteurs', response: lecteursResponse },
      ];

      const equipmentData = {};
      equipmentResponses.forEach(({ key, response }) => {
        if (response.error) {
          toast({ title: `Erreur chargement ${key}`, description: response.error.message, variant: 'destructive' });
          equipmentData[key] = [];
        } else {
          equipmentData[key] = response.data || [];
        }
      });

      setEquipments(equipmentData);
    } catch (error) {
      console.error('Erreur chargement configuration terminaux:', error);
      toast({ title: 'Erreur de chargement', description: 'Impossible de charger les données', variant: 'destructive' });
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resolvedLockedAgence = useMemo(() => {
    if (lockedAgenceId) {
      return agences.find((agence) => String(agence.id) === String(lockedAgenceId)) || null;
    }

    if (lockedAgenceName) {
      return agences.find((agence) => normalizeText(agence.nom) === normalizeText(lockedAgenceName)) || null;
    }

    return null;
  }, [agences, lockedAgenceId, lockedAgenceName]);

  useEffect(() => {
    if (resolvedLockedAgence?.id) {
      setAgenceId(String(resolvedLockedAgence.id));
    }
  }, [resolvedLockedAgence]);

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
  };

  const showReadOnlyToast = () => {
    toast({
      title: 'Lecture seule',
      description: readOnlyMessage || 'La configuration des terminaux est en lecture seule sur cet écran.',
      variant: 'destructive',
    });
  };

  const handleSaveTerminal = async () => {
    if (!canManage) {
      showReadOnlyToast();
      return;
    }

    if (!agenceId || !formData.ref || !formData.type || !formData.position) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez renseigner l’agence, la référence, le type et la position.',
        variant: 'destructive',
      });
      return;
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
      statut: 'Actif',
    };

    const existingTerminal = (terminaux[agenceId] || []).find(
      (terminal) => normalizeText(terminal.ref) === normalizeText(formData.ref)
    );

    setIsLoading(true);

    const query = existingTerminal
      ? supabase.from('terminaux').update(payload).eq('id', existingTerminal.id)
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
      title: existingTerminal ? 'Terminal mis à jour' : 'Terminal ajouté',
      description: existingTerminal
        ? 'La configuration du terminal a été mise à jour.'
        : 'Le terminal a été configuré avec succès.',
      className: 'bg-green-500 text-white',
    });

    resetForm();
    await loadData();
    setIsLoading(false);
  };

  const agencesOptions = useMemo(
    () =>
      agences.map((agence) => ({
        value: String(agence.id),
        label: `${agence.nom} (${(terminaux[String(agence.id)] || []).length} terminaux)`,
      })),
    [agences, terminaux]
  );

  const typeOptions = [
    { value: '2020', label: '2020' },
    { value: '2032', label: '2032' },
  ];

  const ipOptions = ipPool.map((ip) => ({
    value: ip,
    label: ip,
  }));

  const selectedTerminaux = terminaux[agenceId] || [];

  const assignedEquipmentReferences = useMemo(() => {
    return Object.values(terminaux).flat().reduce(
      (accumulator, terminal) => {
        if (terminal.imprimante) {
          accumulator.imprimantes.add(normalizeText(terminal.imprimante));
        }
        if (terminal.lecteur) {
          accumulator.lecteurs.add(normalizeText(terminal.lecteur));
        }
        if (terminal.ecran) {
          accumulator.ecrans.add(normalizeText(terminal.ecran));
        }
        return accumulator;
      },
      {
        imprimantes: new Set(),
        lecteurs: new Set(),
        ecrans: new Set(),
      }
    );
  }, [terminaux]);

  const buildEquipmentOptions = (equipmentList, equipmentType, selectedReference) =>
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
      }));

  const imprimantesOptions = buildEquipmentOptions(equipments.imprimantes, 'imprimantes', formData.imprimante);
  const lecteursOptions = buildEquipmentOptions(equipments.lecteurs, 'lecteurs', formData.lecteur);
  const ecransOptions = buildEquipmentOptions(equipments.ecrans, 'ecrans', formData.ecran);

  const configurationContent = (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Configuration des terminaux</CardTitle>
        <CardDescription>
          {resolvedLockedAgence
            ? `Configurez les terminaux de ${resolvedLockedAgence.nom}.`
            : 'Sélectionnez une agence et configurez ses terminaux avec recherche intégrée.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {readOnlyMessage ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {readOnlyMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Agence</Label>
            <Combobox
              options={agencesOptions}
              value={agenceId}
              onSelect={setAgenceId}
              placeholder="Choisir une agence"
              searchPlaceholder="Rechercher une agence..."
              emptyText="Aucune agence trouvée."
              disabled={isLoading || Boolean(resolvedLockedAgence)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type de terminal</Label>
            <Combobox
              options={typeOptions}
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
              onChange={(event) => setFormData((previousState) => ({ ...previousState, position: event.target.value }))}
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
              onSelect={(value) => setFormData((previousState) => ({ ...previousState, imprimante: value }))}
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
        </div>

        <Separator />

        <Button
          onClick={handleSaveTerminal}
          disabled={!agenceId || !formData.ref || isLoading || !canManage}
          className="bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90"
        >
          Sauvegarder le terminal
        </Button>

        {selectedTerminaux.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 font-medium">Terminaux configurés</h4>
            <div className="space-y-2">
              {selectedTerminaux.map((terminal) => (
                <div key={terminal.id} className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{terminal.ref} - {terminal.type}</p>
                      <p className="text-sm text-muted-foreground">Position: {terminal.position}</p>
                      <p className="text-sm text-muted-foreground">IP: {terminal.ip || 'N/A'}</p>
                    </div>
                    <div className="text-right text-sm">
                      {terminal.imprimante && <p>🖨️ {terminal.imprimante}</p>}
                      {terminal.lecteur && <p>📱 {terminal.lecteur}</p>}
                      {terminal.ecran && <p>🖥️ {terminal.ecran}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

        <TabsContent value="terminaux">
          {configurationContent}
        </TabsContent>

        <TabsContent value="equipements">
          <EquipmentManager
            canManage={canManage}
            readOnlyMessage={readOnlyMessage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigurationTab;
