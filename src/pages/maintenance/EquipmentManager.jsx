import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Edit, Monitor, PlusCircle, Printer, Scan, Search, Trash2, Tv } from 'lucide-react';
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

const EQUIPMENT_TYPES = {
  imprimantes: {
    label: 'Imprimantes',
    singular: 'Imprimante',
    icon: <Printer className="h-5 w-5" />,
    table: 'equipments_imprimantes',
  },
  ecrans: {
    label: 'Écrans',
    singular: 'Écran',
    icon: <Monitor className="h-5 w-5" />,
    table: 'equipments_ecrans',
  },
  lecteurs: {
    label: 'Lecteurs',
    singular: 'Lecteur',
    icon: <Scan className="h-5 w-5" />,
    table: 'equipments_lecteurs',
  },
  afficheurs: {
    label: 'Afficheurs client',
    singular: 'Afficheur client',
    icon: <Tv className="h-5 w-5" />,
    table: 'equipments_afficheurs',
  },
};

const EquipmentTable = ({ type, config, filteredEquipments, hasData, searchTerm, onSearchChange, onOpenDialog, onDelete, isLoading, canManage }) => (
  <Card className="relative overflow-hidden shadow-lg">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
    <CardHeader className="relative">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          {config.icon}
          <div>
            <CardTitle className="text-xl text-primary">{config.label}</CardTitle>
            <CardDescription>Gérez les {config.label.toLowerCase()} disponibles</CardDescription>
          </div>
        </div>
        <Button
          onClick={() => onOpenDialog(null, type)}
          className="bg-gradient-to-r from-primary to-blue-600 text-white hover:from-primary/90 hover:to-blue-600/90"
          disabled={isLoading || !canManage}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
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

const EquipmentManager = ({ canManage = true, readOnlyMessage = '' }) => {
  const { toast } = useToast();
  const [equipments, setEquipments] = useState({
    imprimantes: [],
    ecrans: [],
    lecteurs: [],
    afficheurs: [],
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
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadEquipments = async () => {
    setIsLoading(true);

    try {
      for (const [type, config] of Object.entries(EQUIPMENT_TYPES)) {
        const { data, error } = await supabase
          .from(config.table)
          .select('*')
          .order('reference', { ascending: true });

        if (error) {
          toast({
            title: `Erreur chargement ${config.label.toLowerCase()}`,
            description: error.message,
            variant: 'destructive',
          });
        } else {
          setEquipments((prev) => ({ ...prev, [type]: data || [] }));
        }
      }
    } catch (error) {
      toast({
        title: 'Erreur de chargement',
        description: 'Impossible de charger les équipements',
        variant: 'destructive',
      });
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
          <CardTitle className="text-2xl font-bold text-primary">Gestion des Équipements</CardTitle>
          <CardDescription>Gérez les imprimantes, écrans, lecteurs et afficheurs client disponibles pour les terminaux.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="imprimantes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
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
            Afficheurs client
          </TabsTrigger>
        </TabsList>

        {Object.keys(EQUIPMENT_TYPES).map((type) => (
          <TabsContent key={type} value={type}>
            <EquipmentTable
              type={type}
              config={EQUIPMENT_TYPES[type]}
              filteredEquipments={getFilteredEquipments(type)}
              hasData={equipments[type].length > 0}
              searchTerm={searchTerms[type]}
              onSearchChange={handleSearchChange}
              onOpenDialog={openDialog}
              onDelete={handleDelete}
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
              <Label htmlFor="modele" className="text-right">Modèle</Label>
              <Input id="modele" name="modele" value={formData.modele} onChange={handleInputChange} className="col-span-3" disabled={isLoading} placeholder="Ex: LaserJet Pro" />
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
