import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Monitor, PlusCircle, Printer, Scan, Search, Trash2, Tv, CheckCircle2, Wrench, XCircle, Package, Box, Shield, Plug, FileUp, FileDown } from 'lucide-react';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { supabase } from '@/lib/supabaseClient';

const STATUS_BADGE_COLORS = {
  Disponible: 'bg-green-100 text-green-800',
  'En service': 'bg-blue-100 text-blue-800',
  'En panne': 'bg-red-100 text-red-800',
  'En maintenance': 'bg-yellow-100 text-yellow-800',
  'Hors service': 'bg-gray-100 text-gray-800',
};

const getStatusBadgeColor = (status) => STATUS_BADGE_COLORS[status] ?? 'bg-gray-100 text-gray-800';

const STATUS_OPTIONS = ['Disponible', 'En service', 'En panne', 'En maintenance', 'Hors service'];

// Détecte une table absente ou un cache de schéma PostgREST non rafraîchi
// (erreur typique juste après la création d'une nouvelle table).
const isMissingTableError = (error) =>
  error?.code === 'PGRST205' || /could not find the table/i.test(error?.message || '');

const EQUIPMENT_TYPES = {
  imprimantes: {
    label: 'Imprimantes',
    singular: 'Imprimante',
    icon: <Printer className="h-5 w-5" />,
    table: 'equipments_imprimantes',
    sousEnsemble: 'imprimante',
  },
  ecrans: {
    label: 'Écrans',
    singular: 'Écran',
    icon: <Monitor className="h-5 w-5" />,
    table: 'equipments_ecrans',
    sousEnsemble: 'ecran',
  },
  lecteurs: {
    label: 'Lecteurs',
    singular: 'Lecteur',
    icon: <Scan className="h-5 w-5" />,
    table: 'equipments_lecteurs',
    sousEnsemble: 'lecteur',
  },
  afficheurs: {
    label: 'Afficheur client',
    singular: 'Afficheur client',
    icon: <Tv className="h-5 w-5" />,
    table: 'equipments_afficheurs',
    sousEnsemble: 'afficheur',
  },
  bucs: {
    label: 'BUC',
    singular: 'BUC',
    icon: <Box className="h-5 w-5" />,
    table: 'equipments_bucs',
    sousEnsemble: 'buc',
  },
  carrosseries: {
    label: 'Carrosseries',
    singular: 'Carrosserie',
    icon: <Shield className="h-5 w-5" />,
    table: 'equipments_carrosseries',
    sousEnsemble: 'carrosserie',
  },
  alimentations: {
    label: 'Alimentation',
    singular: 'Alimentation',
    icon: <Plug className="h-5 w-5" />,
    table: 'equipments_alimentations',
    sousEnsemble: 'alimentation',
  },
};

const KPI_STATS = [
  { key: 'total',         label: 'Total',        helper: 'Équipements enregistrés.',             tone: 'primary', icon: Package },
  { key: 'disponible',    label: 'Disponibles',  helper: 'Prêts à être assignés.',               tone: 'emerald', icon: CheckCircle2 },
  { key: 'enService',     label: 'En service',   helper: 'Assignés à un terminal.',              tone: 'blue',    icon: CheckCircle2 },
  { key: 'enMaintenance', label: 'Maintenance',  helper: 'En cours de maintenance.',             tone: 'amber',   icon: Wrench },
  { key: 'horsService',   label: 'Hors service', helper: 'Retirés du parc.',                     tone: 'violet',  icon: XCircle },
];

const EquipmentTable = ({ type, config, allEquipments, filteredEquipments, hasData, searchTerm, onSearchChange, onOpenDialog, onDelete, onExport, onImport, isLoading, canManage }) => {
  const fileInputRef = useRef(null);
  const kpi = {
    total:         allEquipments.length,
    disponible:    allEquipments.filter(e => e.statut === 'Disponible').length,
    enService:     allEquipments.filter(e => e.statut === 'En service').length,
    enMaintenance: allEquipments.filter(e => e.statut === 'En maintenance').length,
    horsService:   allEquipments.filter(e => e.statut === 'Hors service').length,
  };

  return (
  <Card className="relative overflow-hidden shadow-lg">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
    <CardHeader className="relative space-y-4">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          {config.icon}
          <div>
            <CardTitle className="text-xl text-primary">{config.label}</CardTitle>
            <CardDescription>Gérez les {config.label.toLowerCase()} disponibles</CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(type, file);
              event.target.value = null;
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || !canManage}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Importer
          </Button>
          <Button
            variant="outline"
            onClick={() => onExport(type)}
            disabled={isLoading}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button
            onClick={() => onOpenDialog(null, type)}
            className="bg-gradient-to-r from-primary to-blue-600 text-white hover:from-primary/90 hover:to-blue-600/90"
            disabled={isLoading || !canManage}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_STATS.map(({ key, label, helper, tone, icon }) => (
          <KpiStatCard key={key} icon={icon} label={label} value={kpi[key]} helper={helper} tone={tone} />
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={`Rechercher dans les ${config.label.toLowerCase()}...`}
          value={searchTerm}
          onChange={(event) => onSearchChange(type, event.target.value)}
          className="pl-10"
          disabled={isLoading}
        />
      </div>
    </CardHeader>
    <CardContent>
      {isLoading && !hasData ? (
        <p className="py-8 text-center text-muted-foreground">Chargement...</p>
      ) : (
        <Table>
          <TableCaption>
            {filteredEquipments.length === 0
              ? `Aucun ${config.singular.toLowerCase()} trouvé.`
              : `Liste de ${filteredEquipments.length} ${config.label.toLowerCase()}.`}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Modèle</TableHead>
              <TableHead>Marque</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEquipments.map((equipment) => (
              <TableRow key={equipment.id}>
                <TableCell className="font-medium">{equipment.reference}</TableCell>
                <TableCell>{equipment.modele}</TableCell>
                <TableCell>{equipment.marque}</TableCell>
                <TableCell>
                  <Badge className={getStatusBadgeColor(equipment.statut)}>
                    {equipment.statut}
                  </Badge>
                </TableCell>
                <TableCell>{equipment.description || 'N/A'}</TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenDialog(equipment, type)}
                    className="text-blue-500 hover:text-blue-700"
                    disabled={isLoading || !canManage}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        disabled={isLoading || !canManage}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Confirmer la suppression</DialogTitle>
                        <DialogDescription>
                          Êtes-vous sûr de vouloir supprimer {equipment.reference} ? Cette action est irréversible.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" disabled={isLoading}>Annuler</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          onClick={() => onDelete(equipment.id, type)}
                          disabled={isLoading || !canManage}
                        >
                          {isLoading ? 'Suppression...' : 'Supprimer'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
  );
};

const EquipmentManager = ({ canManage = true, readOnlyMessage = '' }) => {
  const { toast } = useToast();
  const [equipments, setEquipments] = useState({
    imprimantes: [],
    ecrans: [],
    lecteurs: [],
    afficheurs: [],
    bucs: [],
    carrosseries: [],
    alimentations: [],
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState(null);
  const [currentType, setCurrentType] = useState('imprimantes');
  const [formData, setFormData] = useState({
    reference: '',
    modele: '',
    marque: '',
    statut: 'Disponible',
    description: '',
  });
  const [searchTerms, setSearchTerms] = useState({
    imprimantes: '',
    ecrans: '',
    lecteurs: '',
    afficheurs: '',
    bucs: '',
    carrosseries: '',
    alimentations: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [modeleOptions, setModeleOptions] = useState([]);

  const syncStatutsDepuisTerminaux = async () => {
    const { data: allTerminaux } = await supabase
      .from('terminaux')
      .select('imprimante_reference, lecteur_reference, ecran_reference, afficheur_reference, buc_reference, carrosserie_reference, alimentation_reference');

    if (!allTerminaux?.length) return;

    const typeConfigs = [
      { field: 'imprimante_reference',  table: 'equipments_imprimantes' },
      { field: 'lecteur_reference',     table: 'equipments_lecteurs' },
      { field: 'ecran_reference',       table: 'equipments_ecrans' },
      { field: 'afficheur_reference',   table: 'equipments_afficheurs' },
      { field: 'buc_reference',         table: 'equipments_bucs' },
      { field: 'carrosserie_reference', table: 'equipments_carrosseries' },
      { field: 'alimentation_reference', table: 'equipments_alimentations' },
    ];

    const ops = [];
    for (const { field, table } of typeConfigs) {
      const assignedRefs = allTerminaux.map(t => t[field]).filter(Boolean);
      if (assignedRefs.length > 0) {
        // Assignés au terminal → En service (seulement si encore Disponible)
        ops.push(
          supabase.from(table).update({ statut: 'En service' }).in('reference', assignedRefs).eq('statut', 'Disponible')
        );
      }
    }
    if (ops.length > 0) await Promise.all(ops);
  };

  const loadEquipments = async () => {
    setIsLoading(true);

    try {
      await syncStatutsDepuisTerminaux();

      const [mRes, ...eResults] = await Promise.all([
        supabase.from('modeles_sous_ensembles').select('id, nom, sous_ensemble').order('nom'),
        ...Object.entries(EQUIPMENT_TYPES).map(([, config]) =>
          supabase.from(config.table).select('*').order('reference', { ascending: true })
        ),
      ]);

      if (!mRes.error) setModeleOptions(mRes.data || []);

      Object.keys(EQUIPMENT_TYPES).forEach((type, i) => {
        const { data, error } = eResults[i];
        if (error) {
          // Table absente ou cache de schéma PostgREST pas encore rafraîchi
          // (juste après la création de la table) : on n'affiche pas d'erreur
          // bloquante et on laisse la liste vide pour ce type.
          if (isMissingTableError(error)) {
            console.warn(`[EquipmentManager] Table ${EQUIPMENT_TYPES[type].table} indisponible :`, error.message);
            setEquipments((prev) => ({ ...prev, [type]: [] }));
          } else {
            toast({ title: `Erreur chargement ${EQUIPMENT_TYPES[type].label.toLowerCase()}`, description: error.message, variant: 'destructive' });
          }
        } else {
          setEquipments((prev) => ({ ...prev, [type]: data || [] }));
        }
      });
    } catch (error) {
      toast({ title: 'Erreur de chargement', description: 'Impossible de charger les équipements', variant: 'destructive' });
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadEquipments();
  }, []);

  const showReadOnlyToast = () => {
    toast({
      title: 'Lecture seule',
      description: readOnlyMessage || 'La gestion des équipements est en lecture seule sur cet écran.',
      variant: 'destructive',
    });
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetFormData = () => {
    setFormData({ reference: '', modele: '', marque: '', statut: 'Disponible', description: '' });
  };

  const handleSubmit = async () => {
    if (!canManage) { showReadOnlyToast(); return; }

    if (!formData.reference || !formData.modele || !formData.marque) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires (Référence, Modèle, Marque).',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const table = EQUIPMENT_TYPES[currentType].table;

    try {
      let error;
      if (currentEquipment) {
        ({ error } = await supabase.from(table).update(formData).eq('id', currentEquipment.id));
      } else {
        ({ error } = await supabase.from(table).insert(formData));
      }

      if (error) {
        toast({ title: "Erreur d'enregistrement", description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: 'Succès',
          description: `${EQUIPMENT_TYPES[currentType].singular} ${currentEquipment ? 'modifié' : 'ajouté'} avec succès.`,
          className: 'bg-green-500 text-white',
        });
        setIsDialogOpen(false);
        setCurrentEquipment(null);
        resetFormData();
        loadEquipments();
      }
    } catch {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite", variant: 'destructive' });
    }

    setIsLoading(false);
  };

  const openDialog = (equipment = null, type = currentType) => {
    if (!canManage) { showReadOnlyToast(); return; }
    setCurrentType(type);
    setCurrentEquipment(equipment);
    setFormData(equipment ? { ...equipment } : { reference: '', modele: '', marque: '', statut: 'Disponible', description: '' });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id, type) => {
    if (!canManage) { showReadOnlyToast(); return; }

    setIsLoading(true);
    const table = EQUIPMENT_TYPES[type].table;

    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        toast({ title: 'Erreur de suppression', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Succès', description: `${EQUIPMENT_TYPES[type].singular} supprimé.`, className: 'bg-red-500 text-white' });
        loadEquipments();
      }
    } catch {
      toast({ title: 'Erreur', description: "Une erreur inattendue s'est produite", variant: 'destructive' });
    }

    setIsLoading(false);
  };

  const handleSearchChange = (type, value) => {
    setSearchTerms((prev) => ({ ...prev, [type]: value }));
  };

  const getFilteredEquipments = (type) => {
    const term = searchTerms[type].toLowerCase();
    return equipments[type].filter((eq) =>
      Object.values(eq).some((v) => String(v).toLowerCase().includes(term))
    );
  };

  const EXPORT_HEADERS = ['reference', 'modele', 'marque', 'statut', 'description'];

  const handleExportType = (type) => {
    const config = EQUIPMENT_TYPES[type];
    const rows = equipments[type] || [];
    if (!rows.length) {
      toast({ title: 'Export', description: `Aucun ${config.singular.toLowerCase()} à exporter.`, variant: 'destructive' });
      return;
    }
    const csv = [
      EXPORT_HEADERS.join(','),
      ...rows.map((r) => EXPORT_HEADERS.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.table}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Export réussi', description: `${rows.length} ${config.label.toLowerCase()} exporté(s) au format CSV.`, className: 'bg-green-500 text-white' });
  };

  const handleImportType = (type, file) => {
    if (!canManage) { showReadOnlyToast(); return; }
    if (!file) return;
    const config = EQUIPMENT_TYPES[type];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsLoading(true);
        const text = event.target.result;
        const lines = text.split('\n').filter((line) => line.trim() !== '');
        if (lines.length < 2) throw new Error('Fichier CSV vide ou en-têtes manquants.');

        const headers = lines[0].trim().split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
        const required = ['reference', 'modele', 'marque'];
        if (!required.every((r) => headers.includes(r))) {
          throw new Error(`En-têtes requis : ${required.join(', ')}. Présents : ${headers.join(', ')}`);
        }

        const dataToUpsert = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i]; });
          if (!obj.reference || !obj.modele || !obj.marque) return null;
          return {
            reference: obj.reference,
            modele: obj.modele,
            marque: obj.marque,
            statut: STATUS_OPTIONS.includes(obj.statut) ? obj.statut : 'Disponible',
            description: obj.description || null,
          };
        }).filter(Boolean);

        if (!dataToUpsert.length) throw new Error('Aucune ligne valide trouvée dans le fichier.');

        const { error } = await supabase.from(config.table).upsert(dataToUpsert, { onConflict: 'reference' });
        if (error) throw error;
        toast({ title: 'Import réussi', description: `${dataToUpsert.length} ${config.label.toLowerCase()} importé(s)/mis à jour.`, className: 'bg-green-500 text-white' });
        loadEquipments();
      } catch (err) {
        toast({ title: "Erreur d'import", description: err.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-6">
      {readOnlyMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {readOnlyMessage}
        </div>
      ) : null}

      <Card className="relative overflow-hidden shadow-xl glassmorphism">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold text-primary">Gestion de sous-ensembles</CardTitle>
          <CardDescription>Gérez les imprimantes, écrans, lecteurs, afficheur client, BUC, carrosseries et alimentations disponibles pour les terminaux.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="imprimantes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="imprimantes" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Imprimantes
          </TabsTrigger>
          <TabsTrigger value="ecrans" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Écrans
          </TabsTrigger>
          <TabsTrigger value="lecteurs" className="flex items-center gap-2">
            <Scan className="h-4 w-4" />
            Lecteurs
          </TabsTrigger>
          <TabsTrigger value="afficheurs" className="flex items-center gap-2">
            <Tv className="h-4 w-4" />
            Afficheur client
          </TabsTrigger>
          <TabsTrigger value="bucs" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            BUC
          </TabsTrigger>
          <TabsTrigger value="carrosseries" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Carrosseries
          </TabsTrigger>
          <TabsTrigger value="alimentations" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Alimentation
          </TabsTrigger>
        </TabsList>

        {Object.keys(EQUIPMENT_TYPES).map((type) => (
          <TabsContent key={type} value={type}>
            <EquipmentTable
              type={type}
              config={EQUIPMENT_TYPES[type]}
              allEquipments={equipments[type]}
              filteredEquipments={getFilteredEquipments(type)}
              hasData={equipments[type].length > 0}
              searchTerm={searchTerms[type]}
              onSearchChange={handleSearchChange}
              onOpenDialog={openDialog}
              onDelete={handleDelete}
              onExport={handleExportType}
              onImport={handleImportType}
              isLoading={isLoading}
              canManage={canManage}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) resetFormData();
        }}
      >
        <DialogContent className="sm:max-w-md glassmorphism">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-primary">
              {EQUIPMENT_TYPES[currentType].icon}
              {currentEquipment ? 'Modifier' : 'Ajouter'} {EQUIPMENT_TYPES[currentType].singular}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reference" className="text-right">Référence</Label>
              <Input id="reference" name="reference" value={formData.reference} onChange={handleInputChange} className="col-span-3" disabled={isLoading} placeholder="Ex: IMP-001" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Modèle</Label>
              <div className="col-span-3">
                {modeleOptions.filter(m => m.sous_ensemble === EQUIPMENT_TYPES[currentType].sousEnsemble).length > 0 ? (
                  <Select
                    value={formData.modele}
                    onValueChange={v => setFormData(prev => ({ ...prev, modele: v }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un modèle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {modeleOptions
                        .filter(m => m.sous_ensemble === EQUIPMENT_TYPES[currentType].sousEnsemble)
                        .map(m => (
                          <SelectItem key={m.id} value={m.nom}>{m.nom}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    name="modele"
                    value={formData.modele}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    placeholder="Ex: LaserJet Pro (aucun modèle défini)"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="marque" className="text-right">Marque</Label>
              <Input id="marque" name="marque" value={formData.marque} onChange={handleInputChange} className="col-span-3" disabled={isLoading} placeholder="Ex: HP" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="statut" className="text-right">Statut</Label>
              <select
                id="statut"
                name="statut"
                value={formData.statut}
                onChange={handleInputChange}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                disabled={isLoading}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Input id="description" name="description" value={formData.description} onChange={handleInputChange} className="col-span-3" disabled={isLoading} placeholder="Description optionnelle" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button" onClick={resetFormData} disabled={isLoading}>
                Annuler
              </Button>
            </DialogClose>
            <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={isLoading || !canManage}>
              {isLoading ? 'Enregistrement...' : currentEquipment ? 'Sauvegarder' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipmentManager;
