import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePageState } from '@/hooks/usePageState';
import { motion } from 'framer-motion';
import { Building2, History, MapPin, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import KpiStatCard from '@/components/analytics/KpiStatCard';

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
  const [activeSearchTerm, setActiveSearchTerm] = usePageState('chef-points-vente-mobi', 'activeSearchTerm', '');
  const [pageSize, setPageSize] = usePageState('chef-points-vente-mobi', 'pageSize', '10');
  const [selectedActivePointUid, setSelectedActivePointUid] = useState('');
  const [historyDialogUid, setHistoryDialogUid] = useState(null);

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

  const displayedActivePoints = useMemo(
    () => (pageSize === 'all' ? filteredActivePoints : filteredActivePoints.slice(0, Number(pageSize))),
    [filteredActivePoints, pageSize]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
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
        <KpiStatCard
          icon={MapPin}
          label="Points actifs"
          value={activePoints.length}
          helper="Affectations actives rattachées à votre agence."
          tone="primary"
        />
        <KpiStatCard
          icon={History}
          label="Versions historiques"
          value={agencePoints.length}
          helper="Historique complet des évolutions du parc de points de vente."
          tone="blue"
        />
        <KpiStatCard
          icon={Building2}
          label="Inactifs"
          value={agencePoints.filter((pointVente) => pointVente.statut === 'Inactif').length}
          helper="Versions clôturées ou anciennes sur votre agence."
          tone="emerald"
        />
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

            <div className="flex w-full items-center gap-2 md:max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={activeSearchTerm}
                  onChange={(event) => setActiveSearchTerm(event.target.value)}
                  placeholder="Rechercher un point actif..."
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue placeholder="Afficher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 lignes</SelectItem>
                  <SelectItem value="10">10 lignes</SelectItem>
                  <SelectItem value="20">20 lignes</SelectItem>
                  <SelectItem value="50">50 lignes</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
                </SelectContent>
              </Select>
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
                  : `${displayedActivePoints.length} / ${filteredActivePoints.length} point(s) de vente mobi actif(s) affiché(s).`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point de vente</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Terminal Mobi</TableHead>
                  <TableHead>Guichetière</TableHead>
                  <TableHead>Début validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedActivePoints.map((pointVente, index) => (
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
                    <TableCell>
                      <button
                        onClick={(e) => { e.stopPropagation(); setHistoryDialogUid(pointVente.pointVenteUid); }}
                        title="Voir l'historique"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog Historique PDV ───────────────────────────────────────── */}
      {(() => {
        const dialogPdv = historyDialogUid
          ? agencePoints.find((p) => p.pointVenteUid === historyDialogUid)
          : null;
        const dialogHistory = historyDialogUid
          ? agencePoints
              .filter((p) => p.pointVenteUid === historyDialogUid)
              .sort((a, b) => {
                const da = a.dateDebutValidite || a.created_at || '';
                const db = b.dateDebutValidite || b.created_at || '';
                return new Date(db) - new Date(da);
              })
          : [];

        return (
          <Dialog open={!!historyDialogUid} onOpenChange={(open) => { if (!open) setHistoryDialogUid(null); }}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <History className="h-5 w-5" />
                  Historique — {dialogPdv?.codePointVente ?? ''}
                </DialogTitle>
                <DialogDescription>
                  {dialogPdv
                    ? `${dialogPdv.terminalReference || 'Sans terminal'} · ${dialogPdv.guichetiereNom || 'Sans guichetière'}`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              <Table>
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
                  {dialogHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Aucun historique pour ce point de vente.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dialogHistory.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.codePointVente}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{p.terminalReference || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{p.terminalModele || ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{p.guichetiereNom || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{p.guichetiereMatricule || ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDisplayDate(p.dateDebutValidite)}</TableCell>
                        <TableCell>{formatDisplayDate(p.dateFinValidite)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadgeClass(p.statut)}>
                            {p.statut}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TableCaption className="mt-0 pb-1 text-xs">
                {dialogHistory.length} version(s) pour ce point de vente.
              </TableCaption>
            </DialogContent>
          </Dialog>
        );
      })()}

    </motion.div>
  );
};

export default PointsVenteMobiChefPage;
