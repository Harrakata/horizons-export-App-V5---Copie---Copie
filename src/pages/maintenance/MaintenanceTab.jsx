import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/Combobox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';

const MaintenanceTab = ({ technicien }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
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
  const [agences, setAgences] = useState([]);
  const [terminaux, setTerminaux] = useState([]);
  const [codesPannes, setCodesPannes] = useState([]);
  const [codesInterventions, setCodesInterventions] = useState([]);
  const [piecesRechange, setPiecesRechange] = useState([]);

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

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Charger les agences
      const { data: agencesData, error: agencesError } = await supabase
        .from('agences')
        .select('id, nom, nbreTerminaux')
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
        toast({ title: 'Erreur', description: 'Impossible de charger les codes d\'interventions', variant: 'destructive' });
      } else {
        setCodesInterventions(interventionsData || []);
      }

      // Charger les pièces de rechange
      const { data: piecesData, error: piecesError } = await supabase
        .from('pieces_rechange')
        .select('*')
        .eq('stock_disponible', 0, false) // Stock > 0
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

  const handleChange = (field) => (value) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  // Préparer les options pour les Combobox
  const agencesOptions = agences.map(a => ({
    value: String(a.id),
    label: `${a.nom} (${a.nbreTerminaux} terminaux)`
  }));

  const terminauxOptions = terminaux.map(t => ({
    value: String(t.id),
    label: `${t.reference} - ${t.type_terminal} - ${t.position || 'Position non définie'}`
  }));

  const sousEnsemblesOptions = getSousEnsembles();

  const codesPannesOptions = codesPannes.map(c => ({
    value: c.code,
    label: `${c.code} - ${c.libelle}`
  }));

  const codesInterventionsOptions = codesInterventions.map(c => ({
    value: c.code,
    label: `${c.code} - ${c.libelle}`
  }));

  const piecesRechangeOptions = piecesRechange.map(p => ({
    value: p.nom,
    label: `${p.nom} - Stock: ${p.stock_disponible}`
  }));

  const saveIntervention = async (interventionData) => {
    try {
      // Préparer les données pour l'insertion
      const dataToInsert = {
        terminal_id: parseInt(interventionData.terminal),
        technicien_id: technicien?.id,
        type_intervention: interventionData.typeIntervention,
        sous_ensemble: interventionData.sousEnsemble,
        commentaire: interventionData.commentaire,
        equipement_remplace: interventionData.remplace === 'oui',
        reference_remplacement: interventionData.remplacement || null,
        statut: 'Terminée'
      };

      // Ajouter les références selon le type d'intervention
      if (interventionData.typeIntervention === 'curative') {
        const codePanne = codesPannes.find(p => p.code === interventionData.code);
        if (codePanne) {
          dataToInsert.code_panne_id = codePanne.id;
        }
      } else {
        const codeIntervention = codesInterventions.find(i => i.code === interventionData.code);
        if (codeIntervention) {
          dataToInsert.code_intervention_id = codeIntervention.id;
        }
        const piece = piecesRechange.find(p => p.nom === interventionData.piece);
        if (piece) {
          dataToInsert.piece_remplacee_id = piece.id;
        }
      }

      const { error } = await supabase
        .from('interventions_maintenance')
        .insert([dataToInsert]);

      if (error) {
        toast({ title: 'Erreur', description: 'Impossible d\'enregistrer l\'intervention', variant: 'destructive' });
        console.error('Erreur sauvegarde:', error);
        return false;
      }

      toast({ 
        title: 'Succès', 
        description: 'Intervention enregistrée avec succès', 
        className: "bg-green-500 text-white" 
      });
      return true;
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
      console.error('Erreur:', error);
      return false;
    }
  };

  const finish = async () => {
    const success = await saveIntervention({ ...form, technicien });
    if (success) {
    setRecap({ ...form, technicien });
    }
  };

  const resetForm = () => {
    setForm({
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
    setRecap(null);
    setStep(1);
  };

  if (recap) {
    const selectedAgence = agences.find(a => String(a.id) === recap.agence);
    const selectedTerminal = terminaux.find(t => String(t.id) === recap.terminal);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4"
      >
        <Card className="shadow-lg glassmorphism">
        <CardHeader>
            <CardTitle className="text-xl text-green-600">✅ Intervention Terminée</CardTitle>
            <CardDescription>Récapitulatif de l'intervention de maintenance</CardDescription>
        </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Agence :</strong> {selectedAgence?.nom}</div>
              <div><strong>Terminal :</strong> {selectedTerminal?.reference}</div>
              <div><strong>Sous-ensemble :</strong> {recap.sousEnsemble}</div>
              <div><strong>Type :</strong> {recap.typeIntervention === 'curative' ? 'Curative' : 'Préventive'}</div>
              
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
      className="mt-4"
    >
      <Card className="shadow-lg glassmorphism">
      <CardHeader>
          <CardTitle className="text-xl text-primary">Fiche de Maintenance</CardTitle>
          <CardDescription>
            Étape {step} sur 2 - Remplissez les informations de l'intervention avec recherche intégrée
          </CardDescription>
      </CardHeader>
        <CardContent className="space-y-6">
        {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-primary">Sélection du Terminal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label>Équipement remplacé ?</Label>
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
                      <Input 
                        value={form.remplacement} 
                        onChange={(e) => handleChange('remplacement')(e.target.value)}
                        placeholder="Référence du nouvel équipement installé"
                        disabled={isLoading}
                      />
              </div>
            )}
                </div>
              </div>
          </div>
        )}
      </CardContent>
        
      <CardFooter className="flex justify-between">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isLoading}>
              ← Retour
            </Button>
          )}
          
          {step === 1 && (
            <Button 
              onClick={() => setStep(2)} 
              disabled={!form.sousEnsemble || isLoading}
              className="ml-auto bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              Suivant →
            </Button>
          )}
          
          {step === 2 && (
            <Button 
              onClick={finish}
              disabled={!form.code || (form.remplace === 'oui' && !form.remplacement) || isLoading}
              className="ml-auto bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              {isLoading ? 'Enregistrement...' : 'Terminer l\'intervention'}
            </Button>
          )}
      </CardFooter>
    </Card>
    </motion.div>
  );
};

export default MaintenanceTab;
