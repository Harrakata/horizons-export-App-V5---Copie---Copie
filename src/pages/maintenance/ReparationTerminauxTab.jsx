import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle2, HelpCircle, Package2, Wrench, ArrowRight, FlaskConical, ChevronDown, ChevronRight, Sparkles, CheckCheck, Search, X } from 'lucide-react';

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
  const [pieceSearch, setPieceSearch] = useState('');

  const [expandedItems, setExpandedItems] = useState(new Set());
  const [itemPiecesCache, setItemPiecesCache] = useState({});
  const [loadingExpandIds, setLoadingExpandIds] = useState(new Set());
  // { [itemId]: { [pieceId]: 'nettoyage' | 'remplacement' } }
  const [treatedPieces, setTreatedPieces] = useState({});

  const EQUIP_TABLE_MAP = {
    imprimante: 'equipments_imprimantes',
    lecteur: 'equipments_lecteurs',
    ecran: 'equipments_ecrans',
    afficheur: 'equipments_afficheurs',
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    const [sRes, pRes, spRes] = await Promise.all([
      supabase.from('stock_defectueux').select('*, agence:agences(nom)').neq('statut', 'repare').order('date_entree', { ascending: false }),
      supabase.from('pieces_sous_ensembles').select('*').order('nom'),
      supabase.from('stock_pieces').select('*, piece:pieces_sous_ensembles(nom, reference)'),
    ]);

    let stockData = sRes.data || [];

    if (!sRes.error && stockData.length > 0) {
      // Step 1: get modele name (string) from equipment tables per reference
      const byType = {};
      for (const item of stockData) {
        const type = item.type_sous_ensemble;
        if (!byType[type]) byType[type] = [];
        if (item.reference_sous_ensemble) byType[type].push(item.reference_sous_ensemble);
      }
      const refToModeleNom = {};
      await Promise.all(
        Object.entries(byType).map(async ([type, refs]) => {
          const table = EQUIP_TABLE_MAP[type];
          if (!table || refs.length === 0) return;
          const { data } = await supabase.from(table).select('reference, modele').in('reference', refs);
          for (const eq of (data || [])) refToModeleNom[eq.reference] = eq.modele;
        })
      );

      // Step 2: resolve modele name → modeles_sous_ensembles.id
      const uniqueNoms = [...new Set(Object.values(refToModeleNom).filter(Boolean))];
      const nomToId = {};
      if (uniqueNoms.length > 0) {
        const { data: modeles } = await supabase
          .from('modeles_sous_ensembles')
          .select('id, nom')
          .in('nom', uniqueNoms);
        for (const m of (modeles || [])) nomToId[m.nom] = m.id;
      }

      stockData = stockData.map(item => {
        if (item.modele_id) return item;
        const nom = refToModeleNom[item.reference_sous_ensemble];
        return { ...item, modele_id: nom ? (nomToId[nom] ?? null) : null };
      });
    }

    if (!sRes.error) { setStock(stockData); setItemPiecesCache({}); }
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

  const pieceSearchLower = pieceSearch.trim().toLowerCase();

  // Auto-expand items whose cached pieces match the search, and trigger load for uncached ones
  useEffect(() => {
    if (!pieceSearchLower) return;
    filteredStock.forEach(item => {
      const cached = itemPiecesCache[item.id];
      if (cached === undefined) {
        // trigger load so we can search inside
        toggleExpand(item);
      } else if (cached.some(mp =>
        mp.piece?.nom?.toLowerCase().includes(pieceSearchLower) ||
        mp.piece?.reference?.toLowerCase().includes(pieceSearchLower)
      )) {
        setExpandedItems(prev => { const n = new Set(prev); n.add(item.id); return n; });
      }
    });
  }, [pieceSearchLower]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTreatedPieces(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  };

  const markRepare = async (itemId) => {
    const item = stock.find(s => s.id === itemId) || selectedItem;
    const { error } = await supabase.from('stock_defectueux').update({ statut: 'repare', date_sortie: new Date().toISOString() }).eq('id', itemId);
    if (error) { showErr(error.message); return; }
    const table = item?.type_sous_ensemble ? EQUIP_TABLE_MAP[item.type_sous_ensemble] : null;
    if (table && item?.reference_sous_ensemble) {
      await supabase.from(table).update({ statut: 'Disponible' }).eq('reference', item.reference_sous_ensemble);
    }
    showOk('Sous-ensemble marqué Réparé — statut remis à Disponible.');
    setSelectedItem(null);
    load();
  };

  const toggleExpand = useCallback(async (item) => {
    const id = item.id;
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      next.add(id);
      return next;
    });
    if (itemPiecesCache[id] !== undefined) return;
    if (!item.modele_id) {
      setItemPiecesCache(prev => ({ ...prev, [id]: [] }));
      return;
    }
    setLoadingExpandIds(prev => new Set(prev).add(id));
    const { data } = await supabase
      .from('modeles_pieces')
      .select('*, piece:pieces_sous_ensembles(id, nom, reference, description_aide)')
      .eq('modele_id', item.modele_id);
    setItemPiecesCache(prev => ({ ...prev, [id]: data || [] }));
    setLoadingExpandIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [itemPiecesCache]);

  const markNettoye = async (piece, item) => {
    const { error } = await supabase.from('stock_pieces_mouvements').insert({
      piece_id: piece.id,
      type: 'nettoyage',
      quantite: 0,
      motif: `Nettoyage sur ${item.reference_sous_ensemble}`,
      stock_defectueux_id: item.id,
    });
    if (error) { showErr(error.message); return; }
    setTreatedPieces(prev => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), [piece.id]: 'nettoyage' },
    }));
    showOk(`Pièce "${piece.nom}" marquée comme Nettoyée.`);
  };

  const openReplace = (piece, item = null) => {
    if (item) setSelectedItem(item);
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
    setTreatedPieces(prev => ({
      ...prev,
      [selectedItem.id]: { ...(prev[selectedItem.id] || {}), [replacingPiece.id]: 'remplacement' },
    }));
    showOk('Pièce remplacée — stock mis à jour.');
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
      <Card className="relative overflow-hidden shadow-xl glassmorphism">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
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
        <div className="lg:col-span-2">
          <Card className="relative overflow-hidden shadow-lg">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardHeader className="relative pb-3">
              <CardTitle className="flex items-center gap-2 text-xl text-primary">
                <Package2 className="h-5 w-5" /> Sous-ensembles à traiter
              </CardTitle>
              <CardDescription>Filtre par type, terminal ou pièce détachée</CardDescription>
              <div className="flex flex-wrap gap-2 pt-1">
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
              <div className="relative pt-1">
                <Search className="absolute left-2.5 top-[calc(0.25rem+0.5rem)] h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher une pièce détachée..."
                  value={pieceSearch}
                  onChange={e => setPieceSearch(e.target.value)}
                  className="pl-8 pr-7 h-8 text-xs"
                />
                {pieceSearch && (
                  <button
                    className="absolute right-2 top-[calc(0.25rem+0.5rem)] text-muted-foreground hover:text-foreground"
                    onClick={() => setPieceSearch('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredStock.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {isLoading ? 'Chargement...' : 'Aucun sous-ensemble à traiter.'}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredStock.map(item => {
                    const isExpanded = expandedItems.has(item.id);
                    const cachedPieces = itemPiecesCache[item.id];
                    const isLoadingExpand = loadingExpandIds.has(item.id);
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <div key={item.id} className={isSelected ? 'border-l-4 border-primary bg-primary/10' : ''}>
                        <div className="flex items-stretch">
                          <button
                            className="flex-1 text-left px-4 py-3 transition-colors hover:bg-muted/50"
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
                          <button
                            className="px-3 flex items-center justify-center hover:bg-muted/50 transition-colors text-muted-foreground"
                            title={isExpanded ? 'Réduire' : 'Voir les pièces'}
                            onClick={() => toggleExpand(item)}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 bg-muted/20 space-y-1.5">
                            {isLoadingExpand ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">Chargement des pièces...</p>
                            ) : !cachedPieces || cachedPieces.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">
                                {!item.modele_id ? 'Aucun modèle associé.' : 'Aucune pièce référencée.'}
                              </p>
                            ) : (
                              <>
                                {pieceSearchLower && !cachedPieces.some(mp =>
                                  mp.piece?.nom?.toLowerCase().includes(pieceSearchLower) ||
                                  mp.piece?.reference?.toLowerCase().includes(pieceSearchLower)
                                ) ? (
                                  <p className="text-xs text-muted-foreground py-1 text-center italic">Aucune pièce ne correspond à la recherche.</p>
                                ) : null}
                                {cachedPieces
                                  .filter(mp => !pieceSearchLower ||
                                    mp.piece?.nom?.toLowerCase().includes(pieceSearchLower) ||
                                    mp.piece?.reference?.toLowerCase().includes(pieceSearchLower)
                                  )
                                  .map(mp => {
                                  const sp = stockPiecesById[mp.piece?.id];
                                  const pieceAction = treatedPieces[item.id]?.[mp.piece?.id];
                                  return (
                                    <div key={mp.id} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${pieceAction ? 'bg-green-50 border-green-200' : 'bg-background'}`}>
                                      <span className="flex-1 font-medium truncate">{mp.piece?.nom}</span>
                                      {pieceAction && (
                                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pieceAction === 'nettoyage' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {pieceAction === 'nettoyage' ? '✓ Nettoyée' : '✓ Remplacée'}
                                        </span>
                                      )}
                                      {sp && !pieceAction && (
                                        <span className={`text-xs font-mono shrink-0 ${sp.quantite === 0 ? 'text-red-600' : sp.quantite <= (sp.seuil_alerte || 2) ? 'text-yellow-600' : 'text-green-700'}`}>
                                          ×{sp.quantite}
                                        </span>
                                      )}
                                      {mp.piece && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary shrink-0" title="Aide à la réparation" onClick={() => loadPieceHelp(mp.piece)}>
                                          <HelpCircle className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                      {canManage && mp.piece && !pieceAction && (
                                        <>
                                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-green-700 border-green-300 shrink-0" onClick={() => markNettoye(mp.piece, item)}>
                                            <Sparkles className="mr-1 h-3 w-3" />Nettoyée
                                          </Button>
                                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0" onClick={() => openReplace(mp.piece, item)}>
                                            <ArrowRight className="mr-1 h-3 w-3" />Remplacer
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                                {canManage && item.statut !== 'a_tester' && item.statut !== 'repare' && (
                                  <div className="pt-1.5 border-t border-dashed border-muted-foreground/20">
                                    {Object.keys(treatedPieces[item.id] || {}).length > 0 ? (
                                      <Button
                                        size="sm"
                                        className="w-full h-7 text-xs bg-yellow-500 hover:bg-yellow-600 text-white"
                                        onClick={() => markATester(item.id)}
                                      >
                                        <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                                        Passer en test ({Object.keys(treatedPieces[item.id]).length} pièce{Object.keys(treatedPieces[item.id]).length > 1 ? 's' : ''} traitée{Object.keys(treatedPieces[item.id]).length > 1 ? 's' : ''})
                                      </Button>
                                    ) : (
                                      <p className="text-[10px] text-center text-muted-foreground italic">
                                        Traitez au moins une pièce pour passer en test.
                                      </p>
                                    )}
                                  </div>
                                )}
                                {item.statut === 'a_tester' && (
                                  <div className="pt-1.5 border-t border-dashed border-muted-foreground/20">
                                    <p className="text-[10px] text-center text-yellow-700 font-medium">En attente de test — sélectionnez pour marquer Réparé</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Détail droite */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedItem ? (
            <Card className="relative overflow-hidden flex items-center justify-center py-20">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
              <div className="text-center text-muted-foreground">
                <Package2 className="mx-auto h-12 w-12 mb-3 opacity-30" />
                <p>Sélectionnez un sous-ensemble pour commencer.</p>
              </div>
            </Card>
          ) : (
            <>
              <Card className="relative overflow-hidden shadow-lg">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                <CardHeader className="relative pb-3">
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
                      <Button
                        size="sm"
                        variant="outline"
                        className={Object.keys(treatedPieces[selectedItem.id] || {}).length > 0 ? 'bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600' : 'text-yellow-700 border-yellow-300'}
                        onClick={() => markATester(selectedItem.id)}
                      >
                        <FlaskConical className="mr-2 h-4 w-4" />
                        Passer en test
                        {Object.keys(treatedPieces[selectedItem.id] || {}).length > 0 && (
                          <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-[10px] font-bold">
                            {Object.keys(treatedPieces[selectedItem.id]).length}
                          </span>
                        )}
                      </Button>
                    )}
                    {canManage && selectedItem.statut === 'a_tester' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => markRepare(selectedItem.id)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marquer Réparé
                      </Button>
                    )}
                  </div>

                  {/* Pièces traitées dans la session */}
                  {Object.keys(treatedPieces[selectedItem.id] || {}).length > 0 && (
                    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary/80 flex items-center gap-1.5">
                        <CheckCheck className="h-3.5 w-3.5" /> Pièces traitées cette session
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(treatedPieces[selectedItem.id]).map(([pieceId, action]) => {
                          const piece = itemPieces.find(mp => String(mp.piece?.id) === String(pieceId))?.piece
                            || (itemPiecesCache[selectedItem.id] || []).find(mp => String(mp.piece?.id) === String(pieceId))?.piece;
                          return (
                            <div key={pieceId} className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs shadow-sm border border-white">
                              <span className="font-medium truncate">{piece?.nom || `Pièce #${pieceId}`}</span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${action === 'nettoyage' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {action === 'nettoyage' ? '✓ Nettoyée' : '✓ Remplacée'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pièces du modèle */}
              {(itemPieces.length > 0 || selectedItem.modele_id) && (
                <Card className="relative overflow-hidden shadow-lg">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                  <CardHeader className="relative py-2 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm text-primary">
                      <Wrench className="h-3.5 w-3.5" /> Pièces du modèle
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                    {itemPieces.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucune pièce référencée.</p>
                    ) : itemPieces.map(mp => {
                      const sp = stockPiecesById[mp.piece?.id];
                      return (
                        <div key={mp.id} className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-1.5 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{mp.piece?.nom}</span>
                            <span className="ml-2 font-mono text-muted-foreground">{mp.piece?.reference}</span>
                          </div>
                          <span className="text-muted-foreground shrink-0">×{mp.quantite}</span>
                          {sp ? (
                            <span className={`font-semibold shrink-0 ${sp.quantite === 0 ? 'text-red-600' : sp.quantite <= (sp.seuil_alerte || 2) ? 'text-yellow-600' : 'text-green-700'}`}>
                              Stock: {sp.quantite}
                            </span>
                          ) : <span className="text-muted-foreground shrink-0">Non suivi</span>}
                          {mp.piece && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary shrink-0" title="Aide réparation" onClick={() => loadPieceHelp(mp.piece)}>
                              <HelpCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canManage && mp.piece && (
                            <>
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-green-700 border-green-300 shrink-0" onClick={() => markNettoye(mp.piece, selectedItem)}>
                                <Sparkles className="mr-1 h-3 w-3" />Nettoyée
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0" onClick={() => openReplace(mp.piece)}>
                                <ArrowRight className="mr-1 h-3 w-3" />Remplacer
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
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
