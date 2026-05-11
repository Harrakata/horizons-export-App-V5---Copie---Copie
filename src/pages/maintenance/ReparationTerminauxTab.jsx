import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle2, HelpCircle, Package2, Wrench, ArrowRight, FlaskConical } from 'lucide-react';

const SOUS_ENSEMBLE_LABELS = {
  imprimante: 'Imprimante',
  lecteur: 'Lecteur',
  ecran: 'Écran',
  afficheur: 'Afficheur client',
};

const STATUT_CONFIG = {
  defectueux: { label: 'Défectueux', cls: 'bg-red-100 text-red-800' },
  assigne: { label: 'Assigné', cls: 'bg-blue-100 text-blue-800' },
  a_tester: { label: 'À tester', cls: 'bg-yellow-100 text-yellow-800' },
  repare: { label: 'Réparé', cls: 'bg-green-100 text-green-800' },
};

const StatutBadge = ({ statut }) => {
  const cfg = STATUT_CONFIG[statut] || { label: statut, cls: 'bg-gray-100 text-gray-800' };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
};

const ReparationTerminauxTab = ({ canManage = true }) => {
  const { toast } = useToast();
  const [stock, setStock] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [stockPieces, setStockPieces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [itemPieces, setItemPieces] = useState([]);
  const [pannes, setPannes] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [selectedPieceHelp, setSelectedPieceHelp] = useState(null);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [replacingPiece, setReplacingPiece] = useState(null);
  const [replacePieceId, setReplacePieceId] = useState('');

  const [filterType, setFilterType] = useState('__all__');
  const [filterTerminal, setFilterTerminal] = useState('__all__');

  const load = useCallback(async () => {
    setIsLoading(true);
    const [sRes, pRes, spRes] = await Promise.all([
      supabase.from('stock_defectueux').select('*, agence:agences(nom)').neq('statut', 'repare').order('date_entree', { ascending: false }),
      supabase.from('pieces_sous_ensembles').select('*').order('nom'),
      supabase.from('stock_pieces').select('*, piece:pieces_sous_ensembles(nom, reference)'),
    ]);
    if (!sRes.error) setStock(sRes.data || []);
    if (!pRes.error) setPieces(pRes.data || []);
    if (!spRes.error) setStockPieces(spRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stockPiecesById = useMemo(() => stockPieces.reduce((a, s) => { a[s.piece_id] = s; return a; }, {}), [stockPieces]);

  const filteredStock = useMemo(() =>
    stock
      .filter(s => filterType === '__all__' || s.type_sous_ensemble === filterType)
      .filter(s => filterTerminal === '__all__' || s.type_terminal === filterTerminal),
    [stock, filterType, filterTerminal]
  );

  const loadItemDetail = useCallback(async (item) => {
    setSelectedItem(item);
    if (!item.modele_id) { setItemPieces([]); return; }
    const { data } = await supabase
      .from('modeles_pieces')
      .select('*, piece:pieces_sous_ensembles(id, nom, reference, description_aide)')
      .eq('modele_id', item.modele_id);
    setItemPieces(data || []);
  }, []);

  const loadPieceHelp = useCallback(async (piece) => {
    setSelectedPieceHelp(piece);
    const [pnRes, prRes] = await Promise.all([
      supabase.from('pieces_pannes').select('*').eq('piece_id', piece.id).order('created_at'),
      supabase.from('pieces_procedures').select('*').eq('piece_id', piece.id).order('ordre'),
    ]);
    if (!pnRes.error) setPannes(pnRes.data || []);
    if (!prRes.error) setProcedures(prRes.data || []);
    setIsHelpOpen(true);
  }, []);

  const showOk = (msg) => toast({ title: msg, className: 'bg-green-500 text-white' });
  const showErr = (msg) => toast({ title: 'Erreur', description: msg, variant: 'destructive' });
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  const markATester = async (itemId) => {
    const { error } = await supabase.from('stock_defectueux').update({ statut: 'a_tester' }).eq('id', itemId);
    if (error) { showErr(error.message); return; }
    showOk('Sous-ensemble passé à "À tester".');
    setSelectedItem(prev => prev ? { ...prev, statut: 'a_tester' } : prev);
    setStock(prev => prev.map(s => s.id === itemId ? { ...s, statut: 'a_tester' } : s));
  };

  const markRepare = async (itemId) => {
    const { error } = await supabase.from('stock_defectueux').update({ statut: 'repare', date_sortie: new Date().toISOString() }).eq('id', itemId);
    if (error) { showErr(error.message); return; }
    showOk('Sous-ensemble marqué Réparé — disponible pour réaffectation.');
    setSelectedItem(null);
    load();
  };

  const openReplace = (piece) => {
    setReplacingPiece(piece);
    setReplacePieceId('');
    setIsReplaceOpen(true);
  };

  const confirmReplace = async () => {
    if (!replacePieceId || !replacingPiece || !selectedItem) return;
    const existing = stockPiecesById[replacePieceId];
    if (!existing || existing.quantite < 1) { showErr('Stock insuffisant pour cette pièce.'); return; }
    setIsLoading(true);
    const newQty = existing.quantite - 1;
    const { error: stockError } = await supabase.from('stock_pieces').update({ quantite: newQty, updated_at: new Date().toISOString() }).eq('piece_id', replacePieceId);
    if (stockError) { showErr(stockError.message); setIsLoading(false); return; }
    await supabase.from('stock_pieces_mouvements').insert({
      piece_id: replacePieceId, type: 'sortie', quantite: 1,
      motif: `Remplacement sur ${selectedItem.reference_sous_ensemble}`,
      stock_defectueux_id: selectedItem.id,
    });
    if (selectedItem.statut !== 'a_tester' && selectedItem.statut !== 'repare') {
      await supabase.from('stock_defectueux').update({ statut: 'a_tester' }).eq('id', selectedItem.id);
      setSelectedItem(prev => prev ? { ...prev, statut: 'a_tester' } : prev);
      setStock(prev => prev.map(s => s.id === selectedItem.id ? { ...s, statut: 'a_tester' } : s));
    }
    showOk('Pièce remplacée — stock mis à jour. Sous-ensemble passé à "À tester".');
    setIsReplaceOpen(false);
    load();
    setIsLoading(false);
  };

  const compatiblePieces = useMemo(() => {
    if (!replacingPiece || !selectedItem) return [];
    return pieces.filter(p =>
      (p.sous_ensemble === selectedItem.type_sous_ensemble || p.type_terminal === 'tous') &&
      (stockPiecesById[p.id]?.quantite || 0) > 0
    );
  }, [pieces, replacingPiece, selectedItem, stockPiecesById]);

  return (
    <div className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Wrench className="h-6 w-6" /> Réparation des Sous-ensembles
          </CardTitle>
          <CardDescription>
            Sélectionnez un sous-ensemble défectueux pour voir ses pièces et lancer la procédure de réparation.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Liste gauche */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tous les types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les types</SelectItem>
                {Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTerminal} onValueChange={setFilterTerminal}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Terminal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous</SelectItem>
                <SelectItem value="2020">2020</SelectItem>
                <SelectItem value="2031">2031</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredStock.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {isLoading ? 'Chargement...' : 'Aucun sous-ensemble à traiter.'}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredStock.map(item => (
                    <button
                      key={item.id}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${selectedItem?.id === item.id ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
                      onClick={() => loadItemDetail(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm font-mono">{item.reference_sous_ensemble}</span>
                        <StatutBadge statut={item.statut} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{SOUS_ENSEMBLE_LABELS[item.type_sous_ensemble] || item.type_sous_ensemble}</Badge>
                        {item.type_terminal && <span>• {item.type_terminal}</span>}
                        {item.agence?.nom && <span>• {item.agence.nom}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Entré le {formatDate(item.date_entree)}</div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Détail droite */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedItem ? (
            <Card className="flex items-center justify-center py-20">
              <div className="text-center text-muted-foreground">
                <Package2 className="mx-auto h-12 w-12 mb-3 opacity-30" />
                <p>Sélectionnez un sous-ensemble pour commencer.</p>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg font-mono">{selectedItem.reference_sous_ensemble}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {SOUS_ENSEMBLE_LABELS[selectedItem.type_sous_ensemble]} — {selectedItem.type_terminal || 'N/A'} — {selectedItem.agence?.nom || 'N/A'}
                      </p>
                    </div>
                    <StatutBadge statut={selectedItem.statut} />
                  </div>
                  {selectedItem.commentaire && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 mt-2">
                      <AlertTriangle className="inline h-4 w-4 mr-1" /> {selectedItem.commentaire}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {canManage && selectedItem.statut !== 'repare' && selectedItem.statut !== 'a_tester' && (
                      <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300" onClick={() => markATester(selectedItem.id)}>
                        <FlaskConical className="mr-2 h-4 w-4" /> Marquer À tester
                      </Button>
                    )}
                    {canManage && selectedItem.statut === 'a_tester' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => markRepare(selectedItem.id)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marquer Réparé
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pièces du modèle */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pièces du modèle</CardTitle>
                  {!selectedItem.modele_id && (
                    <p className="text-sm text-muted-foreground">Aucun modèle associé à ce sous-ensemble.</p>
                  )}
                </CardHeader>
                {itemPieces.length > 0 && (
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pièce</TableHead>
                          <TableHead>Référence</TableHead>
                          <TableHead>Qté modèle</TableHead>
                          <TableHead>Stock dispo</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemPieces.map(mp => {
                          const sp = stockPiecesById[mp.piece?.id];
                          return (
                            <TableRow key={mp.id}>
                              <TableCell className="font-medium">{mp.piece?.nom}</TableCell>
                              <TableCell className="font-mono text-sm">{mp.piece?.reference}</TableCell>
                              <TableCell>{mp.quantite}</TableCell>
                              <TableCell>
                                {sp ? (
                                  <span className={sp.quantite === 0 ? 'text-red-600 font-bold' : sp.quantite <= sp.seuil_alerte ? 'text-yellow-600 font-semibold' : 'text-green-700'}>
                                    {sp.quantite}
                                  </span>
                                ) : <span className="text-muted-foreground text-xs">Non suivi</span>}
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                {mp.piece && (
                                  <Button variant="ghost" size="icon" title="Aide réparation" className="text-primary" onClick={() => loadPieceHelp(mp.piece)}>
                                    <HelpCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                {canManage && mp.piece && (
                                  <Button size="sm" variant="outline" className="text-xs" onClick={() => openReplace(mp.piece)}>
                                    <ArrowRight className="mr-1 h-3 w-3" /> Remplacer
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Dialog aide réparation */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Aide à la Réparation — {selectedPieceHelp?.nom}
            </DialogTitle>
          </DialogHeader>
          {selectedPieceHelp && (
            <div className="space-y-6 py-2">
              {selectedPieceHelp.description_aide && (
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Description</Label>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{selectedPieceHelp.description_aide}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Types de pannes
                </Label>
                {pannes.length === 0 && <p className="text-sm text-muted-foreground">Aucune panne renseignée.</p>}
                {pannes.map(p => (
                  <div key={p.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{p.description}</div>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Procédure de réparation</Label>
                {procedures.length === 0 && <p className="text-sm text-muted-foreground">Aucune procédure.</p>}
                {procedures.map((p, i) => (
                  <div key={p.id} className="rounded-md border p-3 space-y-2">
                    <span className="font-medium text-primary text-sm">Étape {i + 1}</span>
                    <p className="text-sm">{p.description}</p>
                    {p.image_url && <img src={p.image_url} alt={`Étape ${i + 1}`} className="max-h-48 rounded border object-contain" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog remplacement pièce */}
      <Dialog open={isReplaceOpen} onOpenChange={setIsReplaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remplacer la pièce — {replacingPiece?.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez la pièce de remplacement dans le stock disponible. La quantité sera décrémentée de 1.
            </p>
            <div className="space-y-1">
              <Label>Pièce de remplacement</Label>
              <Select value={replacePieceId} onValueChange={setReplacePieceId}>
                <SelectTrigger><SelectValue placeholder="Choisir une pièce..." /></SelectTrigger>
                <SelectContent>
                  {compatiblePieces.length === 0 && <SelectItem value="__none__" disabled>Aucune pièce compatible en stock</SelectItem>}
                  {compatiblePieces.map(p => {
                    const sp = stockPiecesById[p.id];
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom} ({p.reference}) — Stock : {sp?.quantite || 0}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {replacePieceId && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Le sous-ensemble passera automatiquement à l'état <strong>À tester</strong> après remplacement.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplaceOpen(false)}>Annuler</Button>
            <Button onClick={confirmReplace} disabled={!replacePieceId || isLoading}>
              {isLoading ? 'Traitement...' : 'Confirmer le remplacement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReparationTerminauxTab;
