import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, History, MapPin, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import {
  REQUEST_STATUS,
  formatDisplayDate,
  formatDisplayDateTime,
  getRequestStatusBadgeClass,
  isMissingSupabaseTableError,
  normalizeText,
} from '@/lib/guichetiereSpace';
import { buildRegionOptions, fetchRegions } from '@/lib/regions';

const defaultRequestForm = {
  requested_region: '',
  requested_agence_nom: '',
  requested_terminal_reference: '',
  commentaire: '',
};

const MesPointsVenteMobiPage = () => {
  const { guichetiereInfo } = useOutletContext();
  const { toast } = useToast();
  const [pointsVente, setPointsVente] = useState([]);
  const [regions, setRegions] = useState([]);
  const [agences, setAgences] = useState([]);
  const [terminaux, setTerminaux] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPointVente, setSelectedPointVente] = useState(null);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);

  const loadData = useCallback(async () => {
    if (!guichetiereInfo?.matricule) return;

    setIsLoading(true);

    const [
      { data: pointsData, error: pointsError },
      { data: regionsData, error: regionsError },
      { data: agencesData, error: agencesError },
      { data: terminauxData, error: terminauxError },
      { data: requestsData, error: requestsError },
    ] = await Promise.all([
      supabase
        .from('points_vente_mobi')
        .select('*')
        .eq('guichetiereMatricule', guichetiereInfo.matricule)
        .order('created_at', { ascending: false }),
      fetchRegions(),
      supabase.from('agences').select('id, nom, codePDV, region').order('nom', { ascending: true }),
      supabase.from('terminaux_mobi').select('id, reference, modele, statut').order('reference', { ascending: true }),
      supabase
        .from('points_vente_mobi_change_requests')
        .select('*')
        .eq('guichetiere_matricule', guichetiereInfo.matricule)
        .order('created_at', { ascending: false }),
    ]);

    if (pointsError) {
      toast({ title: 'Erreur chargement points de vente', description: pointsError.message, variant: 'destructive' });
      setPointsVente([]);
    } else {
      setPointsVente(pointsData || []);
    }

    if (regionsError) {
      toast({ title: 'Erreur chargement régions', description: regionsError.message, variant: 'destructive' });
      setRegions([]);
    } else {
      setRegions(regionsData || []);
    }

    if (agencesError) {
      toast({ title: 'Erreur chargement agences', description: agencesError.message, variant: 'destructive' });
      setAgences([]);
    } else {
      setAgences(agencesData || []);
    }

    if (terminauxError) {
      toast({ title: 'Erreur chargement terminaux', description: terminauxError.message, variant: 'destructive' });
      setTerminaux([]);
    } else {
      setTerminaux(terminauxData || []);
    }

    if (requestsError) {
      if (!isMissingSupabaseTableError(requestsError, 'points_vente_mobi_change_requests')) {
        toast({
          title: 'Erreur chargement demandes',
          description: requestsError.message,
          variant: 'destructive',
        });
      }
      setRequests([]);
    } else {
      setRequests(requestsData || []);
    }

    setIsLoading(false);
  }, [guichetiereInfo?.matricule, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activePoints = useMemo(
    () => pointsVente.filter((pointVente) => pointVente.statut === 'Actif'),
    [pointsVente]
  );

  const regionOptions = buildRegionOptions(regions);
  const agenceOptions = useMemo(
    () =>
      agences
        .filter(
          (agence) =>
            !requestForm.requested_region ||
            normalizeText(agence.region) === normalizeText(requestForm.requested_region)
        )
        .map((agence) => ({
          value: agence.nom,
          label: `${agence.nom}${agence.codePDV ? ` • ${agence.codePDV}` : ''}`,
        })),
    [agences, requestForm.requested_region]
  );

  const terminalOptions = useMemo(
    () =>
      terminaux
        .filter((terminal) => terminal.statut === 'Actif')
        .map((terminal) => ({
          value: terminal.reference,
          label: `${terminal.reference}${terminal.modele ? ` • ${terminal.modele}` : ''}`,
        })),
    [terminaux]
  );

  const openDialog = (pointVente) => {
    setSelectedPointVente(pointVente);
    setRequestForm({
      requested_region: pointVente.region || '',
      requested_agence_nom: pointVente.agenceNom || '',
      requested_terminal_reference: pointVente.terminalReference || '',
      commentaire: '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPointVente || !guichetiereInfo?.matricule) return;

    if (
      normalizeText(requestForm.requested_region) === normalizeText(selectedPointVente.region) &&
      normalizeText(requestForm.requested_agence_nom) === normalizeText(selectedPointVente.agenceNom) &&
      normalizeText(requestForm.requested_terminal_reference) === normalizeText(selectedPointVente.terminalReference)
    ) {
      toast({
        title: 'Aucune modification',
        description: 'Veuillez modifier au moins une information avant d’envoyer la demande.',
      });
      return;
    }

    const hasPendingRequest = requests.some(
      (request) =>
        request.point_vente_uid === selectedPointVente.pointVenteUid &&
        request.statut === REQUEST_STATUS.PENDING
    );

    if (hasPendingRequest) {
      toast({
        title: 'Demande déjà en attente',
        description: 'Une demande de modification est déjà en cours pour ce point de vente.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const payload = {
      point_vente_uid: selectedPointVente.pointVenteUid,
      code_point_vente: selectedPointVente.codePointVente,
      guichetiere_matricule: guichetiereInfo.matricule,
      guichetiere_nom: guichetiereInfo.nomComplet,
      current_region: selectedPointVente.region,
      current_agence_nom: selectedPointVente.agenceNom,
      current_terminal_reference: selectedPointVente.terminalReference,
      requested_region: requestForm.requested_region,
      requested_agence_nom: requestForm.requested_agence_nom,
      requested_terminal_reference: requestForm.requested_terminal_reference,
      commentaire: requestForm.commentaire?.trim() || null,
      statut: REQUEST_STATUS.PENDING,
    };

    const { error } = await supabase.from('points_vente_mobi_change_requests').insert(payload);

    if (error) {
      if (isMissingSupabaseTableError(error, 'points_vente_mobi_change_requests')) {
        toast({
          title: 'Table Supabase manquante',
          description:
            "La table 'points_vente_mobi_change_requests' n'existe pas encore dans Supabase. Exécutez d'abord le SQL de création puis rechargez la page.",
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Erreur d’envoi',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Demande envoyée',
        description: 'La demande de modification a été transmise à l’exploitation.',
        className: 'bg-green-500 text-white',
      });
      setIsDialogOpen(false);
      setSelectedPointVente(null);
      setRequestForm(defaultRequestForm);
      loadData();
    }

    setIsLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <MapPin className="mr-3 h-8 w-8" />
            Mes Points de Vente Mobi
          </CardTitle>
          <CardDescription>
            Consultez vos affectations actives, leur historique et envoyez une demande de modification à
            l’exploitation.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Affectations actives</p>
              <p className="text-2xl font-bold">{activePoints.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <History className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Historique total</p>
              <p className="text-2xl font-bold">{pointsVente.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Send className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">Demandes en attente</p>
              <p className="text-2xl font-bold">
                {requests.filter((request) => request.statut === REQUEST_STATUS.PENDING).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Affectations actives</CardTitle>
          <CardDescription>Demandez une évolution si votre point de vente doit être réaffecté.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {activePoints.length === 0 ? 'Aucune affectation active trouvée.' : `${activePoints.length} affectation(s) active(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Point de vente</TableHead>
                <TableHead>Région</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Terminal</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activePoints.map((pointVente) => (
                <TableRow key={pointVente.id}>
                  <TableCell>{pointVente.codePointVente}</TableCell>
                  <TableCell>{pointVente.region}</TableCell>
                  <TableCell>{pointVente.agenceNom}</TableCell>
                  <TableCell>{pointVente.terminalReference}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openDialog(pointVente)}>
                      Demander une modification
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Mes demandes de modification</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {requests.length === 0 ? 'Aucune demande envoyée.' : `${requests.length} demande(s) enregistrée(s).`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Point de vente</TableHead>
                <TableHead>Nouvelle agence souhaitée</TableHead>
                <TableHead>Nouveau terminal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Traitement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.code_point_vente}</TableCell>
                  <TableCell>{request.requested_agence_nom || 'Aucune'}</TableCell>
                  <TableCell>{request.requested_terminal_reference || 'Aucun'}</TableCell>
                  <TableCell>
                    <Badge className={getRequestStatusBadgeClass(request.statut)}>{request.statut}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal text-xs text-muted-foreground">
                    {request.commentaire_traitement || request.commentaire || 'En attente de traitement'}
                    <div>{formatDisplayDateTime(request.date_traitement)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Historique des affectations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {pointsVente.length === 0 ? 'Aucun historique disponible.' : `${pointsVente.length} version(s) d’affectation.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Point de vente</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Terminal</TableHead>
                <TableHead>Début validité</TableHead>
                <TableHead>Fin validité</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pointsVente.map((pointVente) => (
                <TableRow key={pointVente.id}>
                  <TableCell>{pointVente.codePointVente}</TableCell>
                  <TableCell>{pointVente.agenceNom}</TableCell>
                  <TableCell>{pointVente.terminalReference}</TableCell>
                  <TableCell>{formatDisplayDate(pointVente.dateDebutValidite)}</TableCell>
                  <TableCell>{formatDisplayDate(pointVente.dateFinValidite)}</TableCell>
                  <TableCell>
                    <Badge className={pointVente.statut === 'Actif' ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-100 text-slate-700'}>
                      {pointVente.statut}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl glassmorphism">
          <DialogHeader>
            <DialogTitle className="text-primary">Demander une modification d’affectation</DialogTitle>
            <DialogDescription>
              {selectedPointVente
                ? `Point de vente ${selectedPointVente.codePointVente} • ${selectedPointVente.agenceNom}`
                : 'Demande de modification'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Région souhaitée</Label>
              <Select
                value={requestForm.requested_region}
                onValueChange={(value) =>
                  setRequestForm((prev) => ({
                    ...prev,
                    requested_region: value,
                    requested_agence_nom: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une région" />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agence souhaitée</Label>
              <Select
                value={requestForm.requested_agence_nom}
                onValueChange={(value) =>
                  setRequestForm((prev) => ({
                    ...prev,
                    requested_agence_nom: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une agence" />
                </SelectTrigger>
                <SelectContent>
                  {agenceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Terminal mobi souhaité</Label>
              <Select
                value={requestForm.requested_terminal_reference}
                onValueChange={(value) =>
                  setRequestForm((prev) => ({
                    ...prev,
                    requested_terminal_reference: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un terminal" />
                </SelectTrigger>
                <SelectContent>
                  {terminalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="commentaire-point-vente">Commentaire</Label>
              <Textarea
                id="commentaire-point-vente"
                rows={4}
                value={requestForm.commentaire}
                onChange={(event) =>
                  setRequestForm((prev) => ({ ...prev, commentaire: event.target.value }))
                }
                placeholder="Précisez la raison de cette demande..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleSubmitRequest} disabled={isLoading}>
              {isLoading ? 'Envoi...' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MesPointsVenteMobiPage;
