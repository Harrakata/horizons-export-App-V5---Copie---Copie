import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, History, MapPin, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const ALL_FILTER_VALUE = '__all__';

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatDisplayDate = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('fr-FR');
};

const getStatusBadgeClass = (status) =>
  status === 'Actif'
    ? 'border-green-200 bg-green-50 text-green-700'
    : 'border-slate-200 bg-slate-100 text-slate-700';

const PointsVenteMobiChefPage = () => {
  const { nomAgence, chefDetails } = useOutletContext();
  const { toast } = useToast();
  const [pointsVente, setPointsVente] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedActivePointUid, setSelectedActivePointUid] = useState('');
  const [historyPointUidFilter, setHistoryPointUidFilter] = useState(ALL_FILTER_VALUE);
  const [historyStatusFilter, setHistoryStatusFilter] = useState(ALL_FILTER_VALUE);

  const loadData = useCallback(async () => {
    if (!nomAgence) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from('points_vente_mobi')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erreur de chargement',
        description: "Impossible de charger les points de vente mobi de l'agence.",
        variant: 'destructive',
      });
      setPointsVente([]);
    } else {
      setPointsVente(data || []);
    }

    setIsLoading(false);
  }, [nomAgence, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agencePoints = useMemo(
    () =>
      pointsVente.filter((pointVente) => {
        const matchesAgencyName = normalizeText(pointVente.agenceNom) === normalizeText(nomAgence);
        const matchesAgencyCode =
          chefDetails?.codePDV &&
          normalizeText(pointVente.agenceCodePDV) === normalizeText(chefDetails.codePDV);

        return matchesAgencyName || matchesAgencyCode;
      }),
    [chefDetails?.codePDV, nomAgence, pointsVente]
  );

  const activePoints = useMemo(
    () =>
      agencePoints
        .filter((pointVente) => pointVente.statut === 'Actif')
        .sort((firstPoint, secondPoint) => firstPoint.codePointVente.localeCompare(secondPoint.codePointVente)),
    [agencePoints]
  );

  useEffect(() => {
    const fallbackUid = activePoints[0]?.pointVenteUid || '';

    if (!selectedActivePointUid && fallbackUid) {
      setSelectedActivePointUid(fallbackUid);
      return;
    }

    if (
      selectedActivePointUid &&
      !activePoints.some((pointVente) => pointVente.pointVenteUid === selectedActivePointUid)
    ) {
      setSelectedActivePointUid(fallbackUid);
    }
  }, [activePoints, selectedActivePointUid]);

  const activePointOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: 'Tous les points actifs' },
      ...activePoints.map((pointVente) => ({
        value: pointVente.pointVenteUid,
        label: `${pointVente.codePointVente} • ${pointVente.terminalReference || 'Sans terminal'}`,
      })),
    ],
    [activePoints]
  );

  const filteredActivePoints = useMemo(() => {
    const searchValue = normalizeText(activeSearchTerm);

    return activePoints.filter((pointVente) =>
      !searchValue ||
      [
        pointVente.codePointVente,
        pointVente.region,
        pointVente.agenceNom,
        pointVente.terminalReference,
        pointVente.guichetiereNom,
        pointVente.guichetiereMatricule,
      ].some((value) => normalizeText(value).includes(searchValue))
    );
  }, [activePoints, activeSearchTerm]);

  const filteredHistory = useMemo(() => {
    const searchValue = normalizeText(historySearchTerm);

    return agencePoints
      .filter((pointVente) => historyPointUidFilter === ALL_FILTER_VALUE || pointVente.pointVenteUid === historyPointUidFilter)
      .filter((pointVente) => historyStatusFilter === ALL_FILTER_VALUE || pointVente.statut === historyStatusFilter)
      .filter((pointVente) =>
        !searchValue ||
        [
          pointVente.codePointVente,
          pointVente.region,
          pointVente.agenceNom,
          pointVente.terminalReference,
          pointVente.guichetiereNom,
          pointVente.guichetiereMatricule,
          pointVente.statut,
        ].some((value) => normalizeText(value).includes(searchValue))
      )
      .sort((firstPoint, secondPoint) => {
        const secondDate = secondPoint.dateDebutValidite || secondPoint.created_at || '';
        const firstDate = firstPoint.dateDebutValidite || firstPoint.created_at || '';
        return new Date(secondDate) - new Date(firstDate);
      });
  }, [agencePoints, historyPointUidFilter, historySearchTerm, historyStatusFilter]);

  const selectedActivePoint =
    activePoints.find((pointVente) => pointVente.pointVenteUid === selectedActivePointUid) || null;

  const selectedActivePointHistory = useMemo(() => {
    if (!selectedActivePoint) return [];

    return agencePoints
      .filter((pointVente) => pointVente.pointVenteUid === selectedActivePoint.pointVenteUid)
      .sort((firstPoint, secondPoint) => {
        const secondDate = secondPoint.dateDebutValidite || secondPoint.created_at || '';
        const firstDate = firstPoint.dateDebutValidite || firstPoint.created_at || '';
        return new Date(secondDate) - new Date(firstDate);
      });
  }, [agencePoints, selectedActivePoint]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <MapPin className="mr-3 h-8 w-8" />
            Point de Vente Mobi
          </CardTitle>
          <CardDescription>
            Points de vente mobi rattachés à {nomAgence}, avec l’historique complet de leurs changements.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Points actifs</p>
              <p className="text-2xl font-bold">{activePoints.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <History className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Versions historiques</p>
              <p className="text-2xl font-bold">{agencePoints.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <Building2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Inactifs</p>
              <p className="text-2xl font-bold">{agencePoints.filter((pointVente) => pointVente.statut === 'Inactif').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Points de vente actifs de l’agence</CardTitle>
              <CardDescription>
                Cliquez sur un point de vente pour consulter son historique détaillé.
              </CardDescription>
            </div>

            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={activeSearchTerm}
                onChange={(event) => setActiveSearchTerm(event.target.value)}
                placeholder="Rechercher un point actif..."
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && agencePoints.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Chargement des points de vente mobi...</p>
          ) : (
            <Table>
              <TableCaption>
                {filteredActivePoints.length === 0
                  ? 'Aucun point de vente mobi actif pour cette agence.'
                  : `${filteredActivePoints.length} point(s) de vente mobi actif(s) affiché(s).`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point de vente</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Terminal Mobi</TableHead>
                  <TableHead>Guichetière</TableHead>
                  <TableHead>Début validité</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivePoints.map((pointVente, index) => (
                  <motion.tr
                    key={pointVente.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                      pointVente.pointVenteUid === selectedActivePointUid ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedActivePointUid(pointVente.pointVenteUid)}
                  >
                    <TableCell className="font-medium">{pointVente.codePointVente}</TableCell>
                    <TableCell>{pointVente.region || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.terminalReference || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.terminalModele || 'Sans modèle'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.guichetiereNom || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.guichetiereMatricule || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDisplayDate(pointVente.dateDebutValidite)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(pointVente.statut)}>
                        {pointVente.statut}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedActivePoint && (
        <Card className="shadow-xl glassmorphism">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Historique du point actif sélectionné</CardTitle>
            <CardDescription>
              {selectedActivePoint.codePointVente} • {selectedActivePoint.terminalReference || 'Sans terminal'} • {selectedActivePoint.guichetiereNom || 'Sans guichetière'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>
                {selectedActivePointHistory.length === 0
                  ? 'Aucune version historique trouvée pour ce point de vente.'
                  : `${selectedActivePointHistory.length} version(s) pour ${selectedActivePoint.codePointVente}.`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point de vente</TableHead>
                  <TableHead>Terminal Mobi</TableHead>
                  <TableHead>Guichetière</TableHead>
                  <TableHead>Début validité</TableHead>
                  <TableHead>Fin validité</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedActivePointHistory.map((pointVente, index) => (
                  <motion.tr
                    key={pointVente.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <TableCell className="font-medium">{pointVente.codePointVente}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.terminalReference || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.terminalModele || 'Sans modèle'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.guichetiereNom || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.guichetiereMatricule || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDisplayDate(pointVente.dateDebutValidite)}</TableCell>
                    <TableCell>{formatDisplayDate(pointVente.dateFinValidite)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(pointVente.statut)}>
                        {pointVente.statut}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xl glassmorphism">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">Historique global de l’agence</CardTitle>
              <CardDescription>
                Filtrez l’historique des changements sur les points de vente mobi rattachés à votre agence.
              </CardDescription>
            </div>

            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearchTerm}
                onChange={(event) => setHistorySearchTerm(event.target.value)}
                placeholder="Rechercher dans l’historique..."
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Point de vente actif</p>
              <Select value={historyPointUidFilter} onValueChange={setHistoryPointUidFilter} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les points actifs" />
                </SelectTrigger>
                <SelectContent>
                  {activePointOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Statut</p>
              <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Tous les statuts</SelectItem>
                  <SelectItem value="Actif">Actif</SelectItem>
                  <SelectItem value="Inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && agencePoints.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Chargement de l’historique...</p>
          ) : (
            <Table>
              <TableCaption>
                {filteredHistory.length === 0
                  ? 'Aucune ligne historique trouvée pour les filtres actuels.'
                  : `${filteredHistory.length} ligne(s) historique(s) affichée(s).`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point de vente</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Terminal Mobi</TableHead>
                  <TableHead>Guichetière</TableHead>
                  <TableHead>Début validité</TableHead>
                  <TableHead>Fin validité</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((pointVente, index) => (
                  <motion.tr
                    key={pointVente.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <TableCell className="font-medium">{pointVente.codePointVente}</TableCell>
                    <TableCell>{pointVente.region || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.terminalReference || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.terminalModele || 'Sans modèle'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{pointVente.guichetiereNom || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{pointVente.guichetiereMatricule || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDisplayDate(pointVente.dateDebutValidite)}</TableCell>
                    <TableCell>{formatDisplayDate(pointVente.dateFinValidite)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(pointVente.statut)}>
                        {pointVente.statut}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PointsVenteMobiChefPage;
