import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Trash2, Printer, Monitor, Scan, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

const EquipmentManager = () => {
  const { toast } = useToast();
  const [equipments, setEquipments] = useState({
    imprimantes: [],
    ecrans: [],
    lecteurs: []
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState(null);
  const [currentType, setCurrentType] = useState('imprimantes');
  const [formData, setFormData] = useState({
    reference: '',
    modele: '',
    marque: '',
    statut: 'Disponible',
    description: ''
  });
  const [searchTerms, setSearchTerms] = useState({
    imprimantes: '',
    ecrans: '',
    lecteurs: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const equipmentTypes = {
    imprimantes: { 
      label: 'Imprimantes', 
      icon: <Printer className="h-5 w-5" />, 
      table: 'equipments_imprimantes',
      color: 'bg-blue-100 text-blue-800'
    },
    ecrans: { 
      label: 'Écrans', 
      icon: <Monitor className="h-5 w-5" />, 
      table: 'equipments_ecrans',
      color: 'bg-green-100 text-green-800'
    },
    lecteurs: { 
      label: 'Lecteurs', 
      icon: <Scan className="h-5 w-5" />, 
      table: 'equipments_lecteurs',
      color: 'bg-purple-100 text-purple-800'
    }
  };

  const statusOptions = ['Disponible', 'En service', 'En panne', 'En maintenance', 'Hors service'];

  const loadEquipments = async () => {
    setIsLoading(true);
    try {
      for (const [type, config] of Object.entries(equipmentTypes)) {
        const { data, error } = await supabase
          .from(config.table)
          .select('*')
          .order('reference', { ascending: true });
        
        if (error) {
          toast({ 
            title: `Erreur chargement ${config.label.toLowerCase()}`, 
            description: error.message, 
            variant: 'destructive' 
          });
        } else {
          setEquipments(prev => ({ ...prev, [type]: data || [] }));
        }
      }
    } catch (error) {
      toast({ 
        title: 'Erreur de chargement', 
        description: 'Impossible de charger les équipements', 
        variant: 'destructive' 
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadEquipments();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetFormData = () => {
    setFormData({
      reference: '',
      modele: '',
      marque: '',
      statut: 'Disponible',
      description: ''
    });
  };

  const handleSubmit = async () => {
    if (!formData.reference || !formData.modele || !formData.marque) {
      toast({ 
        title: 'Erreur', 
        description: 'Veuillez remplir tous les champs obligatoires (Référence, Modèle, Marque).', 
        variant: 'destructive' 
      });
      return;
    }

    setIsLoading(true);
    const table = equipmentTypes[currentType].table;
    
    try {
      let error;
      if (currentEquipment) {
        const { error: updateError } = await supabase
          .from(table)
          .update(formData)
          .eq('id', currentEquipment.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from(table)
          .insert(formData);
        error = insertError;
      }

      if (error) {
        toast({ 
          title: 'Erreur d\'enregistrement', 
          description: error.message, 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Succès', 
          description: `${equipmentTypes[currentType].label.slice(0, -1)} ${currentEquipment ? 'modifié' : 'ajouté'} avec succès.`, 
          className: "bg-green-500 text-white" 
        });
        setIsDialogOpen(false);
        setCurrentEquipment(null);
        resetFormData();
        loadEquipments();
      }
    } catch (error) {
      toast({ 
        title: 'Erreur', 
        description: 'Une erreur inattendue s\'est produite', 
        variant: 'destructive' 
      });
    }
    setIsLoading(false);
  };

  const openDialog = (equipment = null, type = currentType) => {
    setCurrentType(type);
    setCurrentEquipment(equipment);
    if (equipment) {
      setFormData({ ...equipment });
    } else {
      resetFormData();
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id, type) => {
    setIsLoading(true);
    const table = equipmentTypes[type].table;
    
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) {
        toast({ 
          title: 'Erreur de suppression', 
          description: error.message, 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Succès', 
          description: `${equipmentTypes[type].label.slice(0, -1)} supprimé.`, 
          className: "bg-red-500 text-white" 
        });
        loadEquipments();
      }
    } catch (error) {
      toast({ 
        title: 'Erreur', 
        description: 'Une erreur inattendue s\'est produite', 
        variant: 'destructive' 
      });
    }
    setIsLoading(false);
  };

  const getFilteredEquipments = (type) => {
    const searchTerm = searchTerms[type].toLowerCase();
    return equipments[type].filter(equipment =>
      Object.values(equipment).some(val =>
        String(val).toLowerCase().includes(searchTerm)
      )
    );
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Disponible': return 'bg-green-100 text-green-800';
      case 'En service': return 'bg-blue-100 text-blue-800';
      case 'En panne': return 'bg-red-100 text-red-800';
      case 'En maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Hors service': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const EquipmentTable = ({ type }) => {
    const filteredEquipments = getFilteredEquipments(type);
    const config = equipmentTypes[type];

    return (
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              {config.icon}
              <div>
                <CardTitle className="text-xl text-primary">{config.label}</CardTitle>
                <CardDescription>Gérez les {config.label.toLowerCase()} disponibles</CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => openDialog(null, type)} 
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white"
              disabled={isLoading}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Rechercher dans les ${config.label.toLowerCase()}...`}
              value={searchTerms[type]}
              onChange={(e) => setSearchTerms(prev => ({ ...prev, [type]: e.target.value }))}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && equipments[type].length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chargement...</p>
          ) : (
            <Table>
              <TableCaption>
                {filteredEquipments.length === 0 
                  ? `Aucun ${config.label.toLowerCase().slice(0, -1)} trouvé.` 
                  : `Liste de ${filteredEquipments.length} ${config.label.toLowerCase()}.`
                }
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
                {filteredEquipments.map((equipment, index) => (
                  <motion.tr
                    key={equipment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <TableCell className="font-medium">{equipment.reference}</TableCell>
                    <TableCell>{equipment.modele}</TableCell>
                    <TableCell>{equipment.marque}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(equipment.statut)}>
                        {equipment.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>{equipment.description || 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openDialog(equipment, type)} 
                        className="text-blue-500 hover:text-blue-700"
                        disabled={isLoading}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700"
                            disabled={isLoading}
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
                              onClick={() => handleDelete(equipment.id, type)}
                              disabled={isLoading}
                            >
                              {isLoading ? 'Suppression...' : 'Supprimer'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Gestion des Équipements</CardTitle>
          <CardDescription>Gérez les imprimantes, écrans et lecteurs disponibles pour les terminaux.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="imprimantes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
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
        </TabsList>

        <TabsContent value="imprimantes">
          <EquipmentTable type="imprimantes" />
        </TabsContent>
        <TabsContent value="ecrans">
          <EquipmentTable type="ecrans" />
        </TabsContent>
        <TabsContent value="lecteurs">
          <EquipmentTable type="lecteurs" />
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) resetFormData(); }}>
        <DialogContent className="sm:max-w-md glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary flex items-center gap-2">
              {equipmentTypes[currentType].icon}
              {currentEquipment ? 'Modifier' : 'Ajouter'} {equipmentTypes[currentType].label.slice(0, -1)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reference" className="text-right">Référence</Label>
              <Input 
                id="reference" 
                name="reference" 
                value={formData.reference} 
                onChange={handleInputChange} 
                className="col-span-3" 
                disabled={isLoading}
                placeholder="Ex: IMP-001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="modele" className="text-right">Modèle</Label>
              <Input 
                id="modele" 
                name="modele" 
                value={formData.modele} 
                onChange={handleInputChange} 
                className="col-span-3" 
                disabled={isLoading}
                placeholder="Ex: LaserJet Pro"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="marque" className="text-right">Marque</Label>
              <Input 
                id="marque" 
                name="marque" 
                value={formData.marque} 
                onChange={handleInputChange} 
                className="col-span-3" 
                disabled={isLoading}
                placeholder="Ex: HP"
              />
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
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Input 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                className="col-span-3" 
                disabled={isLoading}
                placeholder="Description optionnelle"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button" onClick={resetFormData} disabled={isLoading}>
                Annuler
              </Button>
            </DialogClose>
            <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : (currentEquipment ? 'Sauvegarder' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipmentManager; 