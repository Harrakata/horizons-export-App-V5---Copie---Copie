import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/Combobox';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import EquipmentManager from './EquipmentManager';

const ConfigurationTab = () => {
  const { toast } = useToast();
  const [agences, setAgences] = useState([]);
  const [equipments, setEquipments] = useState({
    imprimantes: [],
    ecrans: [],
    lecteurs: []
  });
  const [agenceId, setAgenceId] = useState('');
  const [terminaux, setTerminaux] = useState({}); // { agenceId: [terminal] }
  const [formData, setFormData] = useState({
    ref: '',
    type: '2020',
    position: '',
    ip: '',
    imprimante: '',
    lecteur: '',
    ecran: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const ipPool = ['192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.13'];

  // Charger les données depuis Supabase
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Charger les agences
        const { data: agencesData, error: agencesError } = await supabase
          .from('agences')
          .select('id, nom, nbreTerminaux')
          .order('nom', { ascending: true });
        
        if (agencesError) {
          toast({ title: 'Erreur chargement agences', description: agencesError.message, variant: 'destructive' });
        } else {
          setAgences(agencesData || []);
        }

        // Charger les équipements
        const equipmentTypes = [
          { key: 'imprimantes', table: 'equipments_imprimantes' },
          { key: 'ecrans', table: 'equipments_ecrans' },
          { key: 'lecteurs', table: 'equipments_lecteurs' }
        ];

        const equipmentData = {};
        for (const { key, table } of equipmentTypes) {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('statut', 'Disponible')
            .order('reference', { ascending: true });
          
          if (error) {
            toast({ title: `Erreur chargement ${key}`, description: error.message, variant: 'destructive' });
            equipmentData[key] = [];
          } else {
            equipmentData[key] = data || [];
          }
        }
        setEquipments(equipmentData);

      } catch (error) {
        toast({ title: 'Erreur de chargement', description: 'Impossible de charger les données', variant: 'destructive' });
      }
      setIsLoading(false);
    };

    loadData();
  }, [toast]);

  const handleAddTerminal = () => {
    if (!agenceId) return;
    const data = { ...formData, id: Date.now() };
    setTerminaux((prev) => ({
      ...prev,
      [agenceId]: prev[agenceId] ? [...prev[agenceId], data] : [data],
    }));
    setFormData({ ref: '', type: '2020', position: '', ip: '', imprimante: '', lecteur: '', ecran: '' });
  };

  // Préparer les données pour les Combobox
  const agencesOptions = agences.map(a => ({
    value: String(a.id),
    label: `${a.nom} (${a.nbreTerminaux} terminaux)`
  }));

  const typeOptions = [
    { value: '2020', label: '2020' },
    { value: '2032', label: '2032' }
  ];

  const ipOptions = ipPool.map(ip => ({
    value: ip,
    label: ip
  }));

  const imprimantesOptions = equipments.imprimantes.map(i => ({
    value: i.reference,
    label: `${i.reference} - ${i.marque} ${i.modele}`
  }));

  const lecteursOptions = equipments.lecteurs.map(l => ({
    value: l.reference,
    label: `${l.reference} - ${l.marque} ${l.modele}`
  }));

  const ecransOptions = equipments.ecrans.map(e => ({
    value: e.reference,
    label: `${e.reference} - ${e.marque} ${e.modele}`
  }));

  const selectedTerminaux = terminaux[agenceId] || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="terminaux" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="terminaux">Configuration Terminaux</TabsTrigger>
          <TabsTrigger value="equipements">Gestion Équipements</TabsTrigger>
        </TabsList>

        <TabsContent value="terminaux">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Configuration des terminaux</CardTitle>
              <CardDescription>Sélectionnez une agence et configurez ses terminaux avec recherche intégrée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agence</Label>
                  <Combobox
                    options={agencesOptions}
                    value={agenceId}
                    onSelect={setAgenceId}
                    placeholder="Choisir une agence"
                    searchPlaceholder="Rechercher une agence..."
                    emptyText="Aucune agence trouvée."
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type de terminal</Label>
                  <Combobox
                    options={typeOptions}
                    value={formData.type}
                    onSelect={(v) => setFormData(p => ({ ...p, type: v }))}
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
                    onChange={(e) => setFormData((p) => ({ ...p, ref: e.target.value }))} 
                    placeholder="Ex: TERM-001"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input 
                    value={formData.position} 
                    onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} 
                    placeholder="Ex: Guichet 1"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse IP</Label>
                  <Combobox
                    options={ipOptions}
                    value={formData.ip}
                    onSelect={(v) => setFormData(p => ({ ...p, ip: v }))}
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
                    onSelect={(v) => setFormData(p => ({ ...p, imprimante: v }))}
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
                    onSelect={(v) => setFormData(p => ({ ...p, lecteur: v }))}
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
                    onSelect={(v) => setFormData(p => ({ ...p, ecran: v }))}
                    placeholder="Choisir un écran"
                    searchPlaceholder="Rechercher un écran..."
                    emptyText="Aucun écran disponible."
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <Separator />
              
              <Button 
                onClick={handleAddTerminal} 
                disabled={!agenceId || !formData.ref || isLoading}
                className="bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90"
              >
                Ajouter le terminal
              </Button>
              
              {selectedTerminaux.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Terminaux configurés</h4>
                  <div className="space-y-2">
                    {selectedTerminaux.map((t) => (
                      <div key={t.id} className="p-3 border rounded-lg bg-muted/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{t.ref} - {t.type}</p>
                            <p className="text-sm text-muted-foreground">Position: {t.position}</p>
                            <p className="text-sm text-muted-foreground">IP: {t.ip}</p>
                          </div>
                          <div className="text-right text-sm">
                            {t.imprimante && <p>🖨️ {t.imprimante}</p>}
                            {t.lecteur && <p>📱 {t.lecteur}</p>}
                            {t.ecran && <p>🖥️ {t.ecran}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipements">
          <EquipmentManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigurationTab;
