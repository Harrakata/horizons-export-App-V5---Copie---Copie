import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { Edit, PlusCircle, Power, Settings2, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  buildProcedureFromWorkflowConfig,
  buildWorkflowApprovalsLabel,
  buildWorkflowConfigPayload,
  buildWorkflowRangeLabel,
  fetchPaiementGainWorkflowConfigs,
  WORKFLOW_CONFIG_STATUSES,
  WORKFLOW_CONFIG_TABLE,
} from '@/lib/paiementGainWorkflowConfig';
import { isSupabaseAuthError } from '@/lib/guichetiereSpace';

const BOOLEAN_OPTIONS = [
  { value: 'true', label: 'Oui' },
  { value: 'false', label: 'Non' },
];

const STATUS_BADGE_CLASS = {
  [WORKFLOW_CONFIG_STATUSES.ACTIVE]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [WORKFLOW_CONFIG_STATUSES.INACTIVE]: 'border-slate-200 bg-slate-100 text-slate-600',
};

const DEFAULT_FORM_DATA = {
  ordre: '1',
  codeWorkflow: '',
  libelle: '',
  montantMin: '0',
  montantMax: '',
  modePaiement: 'Espèces',
  lieuPaiement: '',
  identificationRequise: 'true',
  requiresChefApproval: 'false',
  requiresRegionalApproval: 'false',
  requiresGeneralApproval: 'false',
  description: '',
  statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
};

const toBoolean = (value) => String(value) === 'true';

const buildFormDataFromConfig = (config) => ({
  ordre: String(config.ordre ?? 1),
  codeWorkflow: config.codeWorkflow || '',
  libelle: config.libelle || '',
  montantMin: String(config.montantMin ?? 0),
  montantMax: config.montantMax === null || config.montantMax === undefined ? '' : String(config.montantMax),
  modePaiement: config.modePaiement || '',
  lieuPaiement: config.lieuPaiement || '',
  identificationRequise: String(Boolean(config.identificationRequise)),
  requiresChefApproval: String(Boolean(config.requiresChefApproval)),
  requiresRegionalApproval: String(Boolean(config.requiresRegionalApproval)),
  requiresGeneralApproval: String(Boolean(config.requiresGeneralApproval)),
  description: config.description || '',
  statut: config.statut || WORKFLOW_CONFIG_STATUSES.ACTIVE,
});

const PaiementGainWorkflowConfigSection = ({
  canWriteCurrentPage = true,
  onConfigsChanged,
}) => {
  const { toast } = useToast();
  const [workflowConfigs, setWorkflowConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentWorkflowConfig, setCurrentWorkflowConfig] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [isFallback, setIsFallback] = useState(false);
  const [isMissingTable, setIsMissingTable] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const { data, error, isFallback: fallback, isMissingTable: missingTable } =
      await fetchPaiementGainWorkflowConfigs({ includeInactive: true });

    setWorkflowConfigs(data || []);
    setIsFallback(Boolean(fallback));
    setIsMissingTable(Boolean(missingTable));

    if (error && !missingTable && !isSupabaseAuthError(error)) {
      toast({
        title: 'Configuration workflows indisponible',
        description: 'Les règles standards de paiement gros gain sont utilisées temporairement. Veuillez réessayer plus tard.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetDialogState = () => {
    setCurrentWorkflowConfig(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const openDialog = (config = null) => {
    setCurrentWorkflowConfig(config);
    setFormData(config ? buildFormDataFromConfig(config) : DEFAULT_FORM_DATA);
    setIsDialogOpen(true);
  };

  const handleFormFieldChange = (fieldName, value) => {
    setFormData((previousFormData) => ({
      ...previousFormData,
      [fieldName]: value,
    }));
  };

  const addButtonClassName = canWriteCurrentPage
    ? 'bg-gradient-to-r from-primary to-cyan-600 text-white hover:from-primary/90 hover:to-cyan-600/90'
    : 'bg-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-500 cursor-not-allowed';

  const editButtonClassName = canWriteCurrentPage && !isLoading && !isMissingTable
    ? 'h-8 w-8 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950'
    : 'h-8 w-8 cursor-not-allowed opacity-40';

  const activeConfigs = useMemo(
    () => workflowConfigs.filter((config) => config.statut === WORKFLOW_CONFIG_STATUSES.ACTIVE),
    [workflowConfigs]
  );

  const inactiveConfigs = workflowConfigs.length - activeConfigs.length;

  const previewConfig = useMemo(
    () => ({
      ordre: Number(formData.ordre || 1),
      codeWorkflow: formData.codeWorkflow,
      libelle: formData.libelle,
      montantMin: Number(formData.montantMin || 0),
      montantMax: formData.montantMax === '' ? null : Number(formData.montantMax),
      modePaiement: formData.modePaiement,
      lieuPaiement: formData.lieuPaiement,
      identificationRequise: toBoolean(formData.identificationRequise),
      requiresChefApproval: toBoolean(formData.requiresChefApproval),
      requiresRegionalApproval: toBoolean(formData.requiresRegionalApproval),
      requiresGeneralApproval: toBoolean(formData.requiresGeneralApproval),
      description: formData.description,
      statut: formData.statut,
    }),
    [formData]
  );

  const previewProcedure = useMemo(
    () => buildProcedureFromWorkflowConfig(previewConfig),
    [previewConfig]
  );

  const validateForm = () => {
    const ordre = Number(formData.ordre);
    const montantMin = Number(formData.montantMin);
    const montantMax = formData.montantMax === '' ? null : Number(formData.montantMax);

    if (!formData.codeWorkflow.trim() || !formData.libelle.trim() || !formData.modePaiement.trim() || !formData.lieuPaiement.trim()) {
      return 'Veuillez renseigner le code, le libellé, le mode et le lieu de paiement.';
    }

    if (!Number.isFinite(ordre) || ordre <= 0) {
      return 'Veuillez renseigner un ordre valide.';
    }

    if (!Number.isFinite(montantMin) || montantMin < 0) {
      return 'Veuillez renseigner un seuil minimum valide.';
    }

    if (montantMax !== null && (!Number.isFinite(montantMax) || montantMax <= montantMin)) {
      return 'Le seuil maximum doit être supérieur au seuil minimum.';
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!canWriteCurrentPage) {
      toast({
        title: 'Accès insuffisant',
        description: 'Votre profil est en lecture seule sur cet onglet.',
        variant: 'destructive',
      });
      return;
    }

    const validationMessage = validateForm();
    if (validationMessage) {
      toast({
        title: 'Configuration invalide',
        description: validationMessage,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const payload = buildWorkflowConfigPayload({
      ...previewConfig,
      persisted: currentWorkflowConfig?.persisted,
    });

    let error = null;

    if (currentWorkflowConfig?.persisted) {
      ({ error } = await supabase.from(WORKFLOW_CONFIG_TABLE).update(payload).eq('id', currentWorkflowConfig.id));
    } else {
      ({ error } = await supabase.from(WORKFLOW_CONFIG_TABLE).insert(payload));
    }

    if (error) {
      toast({
        title: 'Enregistrement impossible',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: currentWorkflowConfig?.persisted ? 'Workflow mis à jour' : 'Workflow ajouté',
      description: `La configuration ${payload.codeWorkflow} a bien été enregistrée.`,
      className: 'bg-green-500 text-white',
    });

    setIsDialogOpen(false);
    resetDialogState();
    await loadData();
    onConfigsChanged?.();
  };

  const handleToggleStatus = async (config) => {
    if (!canWriteCurrentPage) {
      toast({
        title: 'Accès insuffisant',
        description: 'Votre profil est en lecture seule sur cet onglet.',
        variant: 'destructive',
      });
      return;
    }

    if (!config.persisted) {
      toast({
        title: 'Workflow non persisté',
        description: 'Initialisez d’abord la table ou enregistrez ce workflow avant de modifier son statut.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const nextStatus =
      config.statut === WORKFLOW_CONFIG_STATUSES.ACTIVE
        ? WORKFLOW_CONFIG_STATUSES.INACTIVE
        : WORKFLOW_CONFIG_STATUSES.ACTIVE;

    const { error } = await supabase
      .from(WORKFLOW_CONFIG_TABLE)
      .update({ statut: nextStatus })
      .eq('id', config.id);

    if (error) {
      toast({
        title: 'Statut non modifié',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Statut mis à jour',
      description: `${config.libelle} est maintenant ${nextStatus.toLowerCase()}.`,
      className: 'bg-blue-500 text-white',
    });

    await loadData();
    onConfigsChanged?.();
  };

  const handleInitializeDefaults = async () => {
    if (!canWriteCurrentPage) {
      toast({
        title: 'Accès insuffisant',
        description: 'Votre profil est en lecture seule sur cet onglet.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const payload = workflowConfigs.map((config) => buildWorkflowConfigPayload(config));
    const { error } = await supabase.from(WORKFLOW_CONFIG_TABLE).insert(payload);

    if (error) {
      toast({
        title: 'Initialisation impossible',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Workflows initialisés',
      description: 'Les règles par défaut ont été enregistrées en base.',
      className: 'bg-green-500 text-white',
    });

    await loadData();
    onConfigsChanged?.();
  };

  return (
    <div className="space-y-6">
      {(isFallback || isMissingTable) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">
            {isMissingTable ? 'Configuration locale temporaire' : 'Configuration par défaut affichée'}
          </p>
          <p className="mt-1">
            {isMissingTable
              ? 'La configuration des workflows n’est pas encore disponible dans Supabase. Les workflows affichés ci-dessous correspondent aux règles standards locales de l’application et ne sont pas encore enregistrés en base.'
              : 'Aucune configuration n’a encore été enregistrée en base. Les workflows affichés ci-dessous correspondent aux règles standards de l’application.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {!isMissingTable && (
              <Button
                onClick={handleInitializeDefaults}
                className={addButtonClassName}
                disabled={isLoading || !canWriteCurrentPage}
              >
                Initialiser les workflows par défaut
              </Button>
            )}
            <span className="self-center text-xs text-amber-700">
              {isMissingTable
                ? 'Créez la table de configuration des workflows dans Supabase, puis rechargez la page.'
                : 'Vous pouvez initialiser ces workflows dans Supabase pour ensuite les modifier depuis cet écran.'}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiStatCard
          icon={Settings2}
          label="Workflows actifs"
          value={activeConfigs.length}
          helper="Règles de validation actuellement activées."
          tone="emerald"
        />
        <KpiStatCard
          icon={SlidersHorizontal}
          label="Configurations totales"
          value={workflowConfigs.length}
          helper="Nombre total de règles disponibles dans le référentiel."
          tone="blue"
        />
        <KpiStatCard
          icon={Power}
          label="Workflows inactifs"
          value={inactiveConfigs}
          helper="Règles conservées mais désactivées."
          tone="red"
        />
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Configuration du workflow</CardTitle>
              <CardDescription>
                Définissez les tranches de gain, les validateurs requis et le circuit de validation appliqué.
              </CardDescription>
            </div>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(isOpen) => {
                setIsDialogOpen(isOpen);
                if (!isOpen) resetDialogState();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={() => openDialog()}
                  className={addButtonClassName}
                  disabled={isLoading || !canWriteCurrentPage || isMissingTable}
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Ajouter un workflow
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl glassmorphism">
                <DialogHeader>
                  <DialogTitle className="text-2xl text-primary">
                    {currentWorkflowConfig?.persisted ? 'Modifier' : 'Créer'} une règle de workflow
                  </DialogTitle>
                  <DialogDescription>
                    Paramétrez les seuils, les validateurs et les étapes applicables à cette tranche de gain.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Ordre d’application</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.ordre}
                      onChange={(event) => handleFormFieldChange('ordre', event.target.value)}
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Code workflow</Label>
                    <Input
                      value={formData.codeWorkflow}
                      onChange={(event) => handleFormFieldChange('codeWorkflow', event.target.value)}
                      placeholder="PGG-5M-50M"
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select
                      value={formData.statut}
                      onValueChange={(selectedValue) => handleFormFieldChange('statut', selectedValue)}
                      disabled={isLoading || !canWriteCurrentPage}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={WORKFLOW_CONFIG_STATUSES.ACTIVE}>{WORKFLOW_CONFIG_STATUSES.ACTIVE}</SelectItem>
                        <SelectItem value={WORKFLOW_CONFIG_STATUSES.INACTIVE}>{WORKFLOW_CONFIG_STATUSES.INACTIVE}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label>Libellé de la tranche</Label>
                    <Input
                      value={formData.libelle}
                      onChange={(event) => handleFormFieldChange('libelle', event.target.value)}
                      placeholder="De 5 000 000 FCFA à moins de 50 000 000 FCFA"
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Seuil minimum</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.montantMin}
                      onChange={(event) => handleFormFieldChange('montantMin', event.target.value)}
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Seuil maximum</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.montantMax}
                      onChange={(event) => handleFormFieldChange('montantMax', event.target.value)}
                      placeholder="Laisser vide pour ouvert"
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mode de paiement</Label>
                    <Input
                      value={formData.modePaiement}
                      onChange={(event) => handleFormFieldChange('modePaiement', event.target.value)}
                      placeholder="Espèces ou Chèque"
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label>Lieu de paiement</Label>
                    <Input
                      value={formData.lieuPaiement}
                      onChange={(event) => handleFormFieldChange('lieuPaiement', event.target.value)}
                      placeholder="Caisse LONAB, Point de vente..."
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Identification requise</Label>
                    <Select
                      value={formData.identificationRequise}
                      onValueChange={(selectedValue) => handleFormFieldChange('identificationRequise', selectedValue)}
                      disabled={isLoading || !canWriteCurrentPage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOLEAN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Validation chef d’agence</Label>
                    <Select
                      value={formData.requiresChefApproval}
                      onValueChange={(selectedValue) => handleFormFieldChange('requiresChefApproval', selectedValue)}
                      disabled={isLoading || !canWriteCurrentPage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOLEAN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Validation directeur régional</Label>
                    <Select
                      value={formData.requiresRegionalApproval}
                      onValueChange={(selectedValue) => handleFormFieldChange('requiresRegionalApproval', selectedValue)}
                      disabled={isLoading || !canWriteCurrentPage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOLEAN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Validation directeur général</Label>
                    <Select
                      value={formData.requiresGeneralApproval}
                      onValueChange={(selectedValue) => handleFormFieldChange('requiresGeneralApproval', selectedValue)}
                      disabled={isLoading || !canWriteCurrentPage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOLEAN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label>Description</Label>
                    <Textarea
                      rows={4}
                      value={formData.description}
                      onChange={(event) => handleFormFieldChange('description', event.target.value)}
                      placeholder="Description métier détaillée de la procédure."
                      disabled={isLoading || !canWriteCurrentPage}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Aperçu du circuit</p>
                  <p className="mt-2 font-medium">{previewProcedure.circuit.join(' > ')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {buildWorkflowRangeLabel(previewConfig)} • {previewProcedure.description}
                  </p>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Annuler</Button>
                  </DialogClose>
                  <Button
                    onClick={handleSubmit}
                    className={addButtonClassName}
                    disabled={isLoading || !canWriteCurrentPage}
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableCaption>
              {workflowConfigs.length === 0
                ? 'Aucune règle de workflow disponible.'
                : `${workflowConfigs.length} règle(s) de workflow affichée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Ordre</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Tranche</TableHead>
                <TableHead>Seuils</TableHead>
                <TableHead>Validateurs</TableHead>
                <TableHead>Circuit</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflowConfigs.map((config) => {
                const procedure = buildProcedureFromWorkflowConfig(config);

                return (
                  <TableRow key={config.id}>
                    <TableCell>{config.ordre}</TableCell>
                    <TableCell className="font-medium">{config.codeWorkflow}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{config.libelle}</p>
                        <p className="text-xs text-muted-foreground">
                          {config.modePaiement} • {config.lieuPaiement}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{buildWorkflowRangeLabel(config)}</TableCell>
                    <TableCell>{buildWorkflowApprovalsLabel(config)}</TableCell>
                    <TableCell>{procedure.circuit.join(' > ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[config.statut] || STATUS_BADGE_CLASS[WORKFLOW_CONFIG_STATUSES.INACTIVE]}>
                        {config.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openDialog(config)}
                          title="Modifier"
                          className={editButtonClassName}
                          disabled={isLoading || !canWriteCurrentPage || isMissingTable}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleToggleStatus(config)}
                          title={config.statut === WORKFLOW_CONFIG_STATUSES.ACTIVE ? 'Désactiver' : 'Activer'}
                          className={
                            !canWriteCurrentPage || isLoading || isMissingTable
                              ? 'h-8 w-8 cursor-not-allowed opacity-40'
                              : config.statut === WORKFLOW_CONFIG_STATUSES.ACTIVE
                                ? 'h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950'
                                : 'h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950'
                          }
                          disabled={isLoading || !canWriteCurrentPage || isMissingTable}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaiementGainWorkflowConfigSection;
