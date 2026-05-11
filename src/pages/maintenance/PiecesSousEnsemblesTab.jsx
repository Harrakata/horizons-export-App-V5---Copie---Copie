import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertTriangle, BookOpen, Download, Edit, FileUp, HelpCircle, Layers, Package,
  Plus, Search, Trash2, ArrowUpCircle, ArrowDownCircle, Wrench, X,
} from 'lucide-react';

const SOUS_ENSEMBLE_LABELS = {
  imprimante: 'Imprimante',
  lecteur: 'Lecteur',
  ecran: 'Écran',
  afficheur: 'Afficheur client',
};

const DEFAULT_PIECE = { nom: '', reference: '', sous_ensemble: 'imprimante', type_terminal: 'tous', commentaire: '', photo_url: '', description_aide: '' };
const DEFAULT_MODELE = { nom: '', sous_ensemble: 'imprimante', type_terminal: 'tous' };

const statusBadge = (qty, seuil) => {
  if (qty === 0) return <Badge className="bg-red-100 text-red-800">Rupture</Badge>;
  if (qty <= seuil) return <Badge className="bg-yellow-100 text-yellow-800">Stock faible</Badge>;
  return <Badge className="bg-green-100 text-green-800">Disponible</Badge>;
};

const PiecesSousEnsemblesTab = ({ canManage = true }) => {
  const { toast } = useToast();
  const [pieces, setPieces] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [stockPieces, setStockPieces] = useState([]);
  const [pannes, setPannes] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [modelePieces, setModelePieces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState({ sous_ensemble: '__all__', type_terminal: '__all__' });
  const [search, setSearch] = useState('');

  const [isPieceOpen, setIsPieceOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState(null);
  const [pieceForm, setPieceForm] = useState(DEFAULT_PIECE);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpPiece, setHelpPiece] = useState(null);
  const [newPanne, setNewPanne] = useState('');
  const [newProc, setNewProc] = useState({ description: '', image_url: '' });

  const [isModeleOpen, setIsModeleOpen] = useState(false);
  const [editingModele, setEditingModele] = useState(null);
  const [modeleForm, setModeleForm] = useState(DEFAULT_MODELE);

  const [isCompoOpen, setIsCompoOpen] = useState(false);
  const [selectedModele, setSelectedModele] = useState(null);
  const [addToModele, setAddToModele] = useState({ piece_id: '', quantite: 1 });

  const [isStockOpen, setIsStockOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ piece_id: '', type: 'entree', quantite: 1, motif: '' });

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [pRes, mRes, sRes] = await Promise.all([
      supabase.from('pieces_sous_ensembles').select('*').order('nom'),
      supabase.from('modeles_sous_ensembles').select('*').order('nom'),
      supabase.from('stock_pieces').select('*, piece:pieces_sous_ensembles(nom, reference)').order('updated_at', { ascending: false }),
    ]);
    if (!pRes.error) setPieces(pRes.data || []);
    if (!mRes.error) setModeles(mRes.data || []);
    if (!sRes.error) setStockPieces(sRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadHelp = useCallback(async (pieceId) => {
    const [pnRes, prRes] = await Promise.all([
      supabase.from('pieces_pannes').select('*').eq('piece_id', pieceId).order('created_at'),
      supabase.from('pieces_procedures').select('*').eq('piece_id', pieceId).order('ordre'),
    ]);
    if (!pnRes.error) setPannes(pnRes.data || []);
    if (!prRes.error) setProcedures(prRes.data || []);
  }, []);

  const loadCompo = useCallback(async (modeleId) => {
    const { data } = await supabase
      .from('modeles_pieces')
      .select('*, piece:pieces_sous_ensembles(id, nom, reference)')
      .eq('modele_id', modeleId);
    setModelePieces(data || []);
  }, []);

  const stockById = useMemo(() => stockPieces.reduce((a, s) => { a[s.piece_id] = s; return a; }, {}), [stockPieces]);

  const filteredPieces = useMemo(() =>
    pieces
      .filter(p => filters.sous_ensemble === '__all__' || p.sous_ensemble === filters.sous_ensemble)
      .filter(p => filters.type_terminal === '__all__' || p.type_terminal === 'tous' || p.type_terminal === filters.type_terminal)
      .filter(p => !search || p.nom.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase())),
    [pieces, filters, search]
  );

  const showOk = (msg) => toast({ title: msg, className: 'bg-green-500 text-white' });
  const showErr = (msg) => toast({ title: 'Erreur', description: msg, variant: 'destructive' });

  // --- PIECES CRUD ---
  const savePiece = async () => {
    if (!pieceForm.nom.trim() || !pieceForm.reference.trim()) { showErr('Nom et référence requis.'); return; }
    setIsLoading(true);
    const { error } = editingPiece
      ? await supabase.from('pieces_sous_ensembles').update(pieceForm).eq('id', editingPiece.id)
      : await supabase.from('pieces_sous_ensembles').insert(pieceForm);
    if (error) { showErr(error.message); } else { showOk(`Pièce ${editingPiece ? 'modifiée' : 'ajoutée'}.`); setIsPieceOpen(false); load(); }
    setIsLoading(false);
  };

  const deletePiece = async (id) => {
    if (!window.confirm('Supprimer cette pièce ?')) return;
    await supabase.from('pieces_sous_ensembles').delete().eq('id', id);
    showOk('Pièce supprimée.'); load();
  };

  // --- AIDE REPARATION ---
  const openHelp = async (piece) => { setHelpPiece(piece); setIsHelpOpen(true); await loadHelp(piece.id); };

  const savePanneDescription = async () => {
    await supabase.from('pieces_sous_ensembles').update({ description_aide: helpPiece.description_aide }).eq('id', helpPiece.id);
    showOk('Description sauvegardée.'); load();
  };

  const addPanne = async () => {
    if (!newPanne.trim()) return;
    await supabase.from('pieces_pannes').insert({ piece_id: helpPiece.id, description: newPanne.trim() });
    setNewPanne(''); loadHelp(helpPiece.id);
  };

  const delPanne = async (id) => { await supabase.from('pieces_pannes').delete().eq('id', id); loadHelp(helpPiece.id); };

  const addProc = async () => {
    if (!newProc.description.trim()) return;
    await supabase.from('pieces_procedures').insert({ piece_id: helpPiece.id, ordre: procedures.length + 1, ...newProc });
    setNewProc({ description: '', image_url: '' }); loadHelp(helpPiece.id);
  };

  const delProc = async (id) => { await supabase.from('pieces_procedures').delete().eq('id', id); loadHelp(helpPiece.id); };

  // --- MODELES CRUD ---
  const saveModele = async () => {
    if (!modeleForm.nom.trim()) { showErr('Nom requis.'); return; }
    const { error } = editingModele
      ? await supabase.from('modeles_sous_ensembles').update(modeleForm).eq('id', editingModele.id)
      : await supabase.from('modeles_sous_ensembles').insert(modeleForm);
    if (error) { showErr(error.message); } else { showOk('Modèle sauvegardé.'); setIsModeleOpen(false); load(); }
  };

  const deleteModele = async (id) => {
    if (!window.confirm('Supprimer ce modèle ?')) return;
    await supabase.from('modeles_sous_ensembles').delete().eq('id', id); load();
  };

  const openCompo = async (modele) => { setSelectedModele(modele); setIsCompoOpen(true); await loadCompo(modele.id); };

  const addPieceModele = async () => {
    if (!addToModele.piece_id || !selectedModele) return;
    const { error } = await supabase.from('modeles_pieces').upsert(
      { modele_id: selectedModele.id, piece_id: addToModele.piece_id, quantite: Number(addToModele.quantite) || 1 },
      { onConflict: 'modele_id,piece_id' }
    );
    if (error) { showErr(error.message); return; }
    setAddToModele({ piece_id: '', quantite: 1 }); loadCompo(selectedModele.id);
  };

  const removePieceModele = async (id) => { await supabase.from('modeles_pieces').delete().eq('id', id); loadCompo(selectedModele.id); };

  // --- STOCK ---
  const saveMouvement = async () => {
    if (!stockForm.piece_id || stockForm.quantite < 1) { showErr('Pièce et quantité requises.'); return; }
    const qty = Number(stockForm.quantite);
    const existing = stockById[stockForm.piece_id];
    if (stockForm.type === 'sortie' && existing && existing.quantite < qty) { showErr('Stock insuffisant.'); return; }
    setIsLoading(true);
    const newQty = stockForm.type === 'entree' ? (existing?.quantite || 0) + qty : Math.max(0, (existing?.quantite || 0) - qty);
    const { error } = await supabase.from('stock_pieces').upsert(
      { piece_id: stockForm.piece_id, quantite: newQty, seuil_alerte: existing?.seuil_alerte || 5, updated_at: new Date().toISOString() },
      { onConflict: 'piece_id' }
    );
    if (!error) {
      await supabase.from('stock_pieces_mouvements').insert({ piece_id: stockForm.piece_id, type: stockForm.type, quantite: qty, motif: stockForm.motif });
      showOk('Mouvement enregistré.');
      setIsStockOpen(false);
      setStockForm({ piece_id: '', type: 'entree', quantite: 1, motif: '' });
      load();
    } else { showErr(error.message); }
    setIsLoading(false);
  };

  // --- EXPORT CSV ---
  const exportCSV = () => {
    const headers = ['Nom', 'Référence', 'Sous-ensemble', 'Type terminal', 'Commentaire'];
    const rows = filteredPieces.map(p => [
      p.nom,
      p.reference,
      SOUS_ENSEMBLE_LABELS[p.sous_ensemble] || p.sous_ensemble,
      p.type_terminal === 'tous' ? 'Tous' : p.type_terminal,
      p.commentaire || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pieces_catalogue.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const csv = 'Nom,Référence,Sous-ensemble,Type terminal,Commentaire\n' +
      '"Exemple capteur","CAP-001","imprimante","tous","Optionnel"';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modele_import_pieces.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // --- IMPORT CSV ---
  const VALID_SE = Object.keys(SOUS_ENSEMBLE_LABELS);
  const SE_REVERSE = Object.fromEntries(
    Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => [v.toLowerCase(), k])
  );

  const parseImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result.replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { showErr('Fichier vide ou sans données.'); return; }
      const parsed = []; const errors = [];
      lines.slice(1).forEach((line, i) => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        const [nom, reference, seRaw, typeRaw, commentaire] = cols;
        const rowNum = i + 2;
        const rowErrors = [];
        if (!nom) rowErrors.push('Nom requis');
        if (!reference) rowErrors.push('Référence requise');
        const seKey = SE_REVERSE[seRaw?.toLowerCase()] || (VALID_SE.includes(seRaw?.toLowerCase()) ? seRaw?.toLowerCase() : null);
        if (!seKey) rowErrors.push(`Sous-ensemble invalide : "${seRaw}"`);
        const typeVal = typeRaw === 'Tous' || typeRaw === 'tous' ? 'tous' : ['2020', '2031'].includes(typeRaw) ? typeRaw : 'tous';
        if (rowErrors.length) { errors.push(`Ligne ${rowNum} : ${rowErrors.join(', ')}`); }
        parsed.push({ nom, reference, sous_ensemble: seKey || 'imprimante', type_terminal: typeVal, commentaire: commentaire || '', _errors: rowErrors });
      });
      setImportRows(parsed);
      setImportErrors(errors);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const executeImport = async () => {
    const validRows = importRows.filter(r => r._errors.length === 0).map(({ _errors, ...r }) => r);
    if (!validRows.length) { showErr('Aucune ligne valide à importer.'); return; }
    setIsImporting(true);
    const { error } = await supabase.from('pieces_sous_ensembles').insert(validRows);
    if (error) { showErr(error.message); } else {
      showOk(`${validRows.length} pièce(s) importée(s).`);
      setIsImportOpen(false); setImportRows([]); setImportErrors([]);
      load();
    }
    setIsImporting(false);
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden shadow-xl glassmorphism">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Package className="h-6 w-6" /> Pièces de Sous-ensembles
          </CardTitle>
          <CardDescription>Catalogue de pièces, modèles de composition et stock de rechange.</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="catalogue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalogue" className="flex items-center gap-2"><Package className="h-4 w-4" /> Catalogue Pièces</TabsTrigger>
          <TabsTrigger value="aide" className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Aide Réparation</TabsTrigger>
          <TabsTrigger value="modeles" className="flex items-center gap-2"><Layers className="h-4 w-4" /> Modèles</TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Stock Pièces</TabsTrigger>
        </TabsList>

        {/* ===== CATALOGUE ===== */}
        <TabsContent value="catalogue">
          <Card className="relative overflow-hidden shadow-lg">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl text-primary">
                    <Package className="h-5 w-5" /> Catalogue Pièces
                  </CardTitle>
                  <CardDescription>Liste de toutes les pièces disponibles, filtrables par sous-ensemble et type de terminal.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Exporter</Button>
                  {canManage && (
                    <>
                      <Button variant="outline" onClick={() => { setImportRows([]); setImportErrors([]); setIsImportOpen(true); }}><FileUp className="mr-2 h-4 w-4" /> Importer</Button>
                      <Button onClick={() => { setPieceForm(DEFAULT_PIECE); setEditingPiece(null); setIsPieceOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Ajouter une pièce</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 pt-2">
                <div className="space-y-1">
                  <Label>Sous-ensemble</Label>
                  <Select value={filters.sous_ensemble} onValueChange={v => setFilters(f => ({ ...f, sous_ensemble: v }))}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      {Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Type terminal</Label>
                  <Select value={filters.type_terminal} onValueChange={v => setFilters(f => ({ ...f, type_terminal: v }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      <SelectItem value="2020">2020</SelectItem>
                      <SelectItem value="2031">2031</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label>Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Nom, référence..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableCaption>{filteredPieces.length === 0 ? 'Aucune pièce.' : `${filteredPieces.length} pièce(s).`}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Sous-ensemble</TableHead>
                    <TableHead>Type terminal</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPieces.map(p => {
                    const s = stockById[p.id];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nom}</TableCell>
                        <TableCell className="font-mono text-sm">{p.reference}</TableCell>
                        <TableCell><Badge variant="outline">{SOUS_ENSEMBLE_LABELS[p.sous_ensemble] || p.sous_ensemble}</Badge></TableCell>
                        <TableCell>{p.type_terminal === 'tous' ? 'Tous' : p.type_terminal}</TableCell>
                        <TableCell>
                          {s ? (
                            <div className="flex items-center gap-2">
                              <span className={s.quantite <= s.seuil_alerte ? 'font-bold text-red-600' : ''}>{s.quantite}</span>
                              {statusBadge(s.quantite, s.seuil_alerte)}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">Non géré</span>}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-muted-foreground text-sm">{p.commentaire || '—'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" title="Aide réparation" className="text-primary" onClick={() => openHelp(p)}><HelpCircle className="h-4 w-4" /></Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" className="text-blue-500" onClick={() => { setPieceForm({ ...p }); setEditingPiece(p); setIsPieceOpen(true); }}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deletePiece(p.id)}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== AIDE REPARATION ===== */}
        <TabsContent value="aide">
          <Card className="relative overflow-hidden shadow-lg">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-xl text-primary">
                <Wrench className="h-5 w-5" /> Aide à la Réparation
              </CardTitle>
              <CardDescription>Consultez la description, les types de pannes et les procédures de réparation par pièce.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Sélectionner une pièce</Label>
                    <Select value={helpPiece?.id || ''} onValueChange={async (v) => { const found = pieces.find(p => p.id === v); if (found) await openHelp(found); }}>
                      <SelectTrigger><SelectValue placeholder="Choisir une pièce..." /></SelectTrigger>
                      <SelectContent>
                        {pieces.map(p => <SelectItem key={p.id} value={p.id}>{p.nom} — {SOUS_ENSEMBLE_LABELS[p.sous_ensemble]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {helpPiece && (
                    <Card className="text-sm">
                      <CardContent className="p-4 space-y-1">
                        <p className="font-semibold text-primary">{helpPiece.nom}</p>
                        <p className="text-muted-foreground font-mono">{helpPiece.reference}</p>
                        <Badge variant="outline">{SOUS_ENSEMBLE_LABELS[helpPiece.sous_ensemble]}</Badge>
                        {helpPiece.photo_url && <img src={helpPiece.photo_url} alt={helpPiece.nom} className="w-full max-h-40 object-contain rounded border mt-2" />}
                        {helpPiece.commentaire && <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{helpPiece.commentaire}</p>}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <div className="lg:col-span-2 space-y-5">
                  {!helpPiece ? (
                    <div className="flex items-center justify-center py-20 text-center text-muted-foreground">
                      <div><HelpCircle className="mx-auto h-12 w-12 mb-3 opacity-30" /><p>Sélectionnez une pièce pour afficher son aide à la réparation.</p></div>
                    </div>
                  ) : (
                    <>
                      <Card className="relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                        <CardHeader className="relative pb-2"><CardTitle className="text-base">Description de la pièce</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" value={helpPiece.description_aide || ''} onChange={e => setHelpPiece(p => ({ ...p, description_aide: e.target.value }))} disabled={!canManage} placeholder="Description fonctionnelle de la pièce..." />
                          {canManage && <Button size="sm" variant="outline" onClick={savePanneDescription}>Sauvegarder la description</Button>}
                        </CardContent>
                      </Card>
                      <Card className="relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                        <CardHeader className="relative pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Types de pannes</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {pannes.length === 0 && <p className="text-sm text-muted-foreground">Aucune panne renseignée.</p>}
                          <div className="space-y-2">
                            {pannes.map(p => (
                              <div key={p.id} className="flex items-start justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                                <span>{p.description}</span>
                                {canManage && <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-red-400 ml-2" onClick={() => delPanne(p.id)}><Trash2 className="h-3 w-3" /></Button>}
                              </div>
                            ))}
                          </div>
                          {canManage && (
                            <div className="flex gap-2">
                              <Input value={newPanne} onChange={e => setNewPanne(e.target.value)} placeholder="Ex: Bourrage papier..." onKeyDown={e => e.key === 'Enter' && addPanne()} />
                              <Button size="sm" onClick={addPanne}><Plus className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                        <CardHeader className="relative pb-2"><CardTitle className="text-base">Procédure de réparation</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {procedures.length === 0 && <p className="text-sm text-muted-foreground">Aucune étape définie.</p>}
                          <div className="space-y-3">
                            {procedures.map((p, i) => (
                              <div key={p.id} className="rounded-md border p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-primary text-sm">Étape {i + 1}</span>
                                  {canManage && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => delProc(p.id)}><Trash2 className="h-3 w-3" /></Button>}
                                </div>
                                <p className="text-sm">{p.description}</p>
                                {p.image_url && <img src={p.image_url} alt={`Étape ${i + 1}`} className="max-h-56 rounded border object-contain w-full" />}
                              </div>
                            ))}
                          </div>
                          {canManage && (
                            <div className="rounded-md border border-dashed p-4 space-y-3">
                              <p className="text-sm font-medium text-muted-foreground">Ajouter une étape</p>
                              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} value={newProc.description} onChange={e => setNewProc(p => ({ ...p, description: e.target.value }))} placeholder="Description de l'étape..." />
                              <Input value={newProc.image_url} onChange={e => setNewProc(p => ({ ...p, image_url: e.target.value }))} placeholder="URL image optionnelle (https://...)" />
                              <Button size="sm" onClick={addProc}><Plus className="mr-2 h-4 w-4" /> Ajouter l'étape</Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MODELES ===== */}
        <TabsContent value="modeles">
          <Card className="relative overflow-hidden shadow-lg">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl text-primary">
                    <Layers className="h-5 w-5" /> Modèles de Composition
                  </CardTitle>
                  <CardDescription>Définissez les modèles de pièces associés à chaque type de sous-ensemble.</CardDescription>
                </div>
                {canManage && (
                  <Button onClick={() => { setModeleForm(DEFAULT_MODELE); setEditingModele(null); setIsModeleOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Créer un modèle
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableCaption>{modeles.length === 0 ? 'Aucun modèle.' : `${modeles.length} modèle(s).`}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Sous-ensemble</TableHead>
                    <TableHead>Type terminal</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modeles.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nom}</TableCell>
                      <TableCell><Badge variant="outline">{SOUS_ENSEMBLE_LABELS[m.sous_ensemble] || m.sous_ensemble}</Badge></TableCell>
                      <TableCell>{m.type_terminal === 'tous' ? 'Tous' : m.type_terminal}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => openCompo(m)}>Composition</Button>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" className="text-blue-500" onClick={() => { setModeleForm({ nom: m.nom, sous_ensemble: m.sous_ensemble, type_terminal: m.type_terminal }); setEditingModele(m); setIsModeleOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteModele(m.id)}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== STOCK ===== */}
        <TabsContent value="stock">
          <Card className="relative overflow-hidden shadow-lg">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl text-primary">
                    <BookOpen className="h-5 w-5" /> Stock Pièces
                  </CardTitle>
                  <CardDescription>Suivez les quantités disponibles et gérez les mouvements de stock de pièces détachées.</CardDescription>
                </div>
                {canManage && (
                  <Button onClick={() => setIsStockOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Mouvement de stock
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3 pt-2">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <p className="text-sm text-red-700 font-medium">Ruptures de stock</p>
                    <p className="text-2xl font-bold text-red-800">{stockPieces.filter(s => s.quantite === 0).length}</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4">
                    <p className="text-sm text-yellow-700 font-medium">Stock faible</p>
                    <p className="text-2xl font-bold text-yellow-800">{stockPieces.filter(s => s.quantite > 0 && s.quantite <= s.seuil_alerte).length}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <p className="text-sm text-green-700 font-medium">Disponibles</p>
                    <p className="text-2xl font-bold text-green-800">{stockPieces.filter(s => s.quantite > s.seuil_alerte).length}</p>
                  </CardContent>
                </Card>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableCaption>{stockPieces.length === 0 ? 'Aucun stock.' : `${stockPieces.length} pièce(s) suivie(s).`}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pièce</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Seuil alerte</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockPieces.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.piece?.nom || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{s.piece?.reference || '—'}</TableCell>
                      <TableCell className={s.quantite <= s.seuil_alerte ? 'font-bold text-red-600' : ''}>{s.quantite}</TableCell>
                      <TableCell>{s.seuil_alerte}</TableCell>
                      <TableCell>{statusBadge(s.quantite, s.seuil_alerte)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== DIALOG PIECE ===== */}
      <Dialog open={isPieceOpen} onOpenChange={setIsPieceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingPiece ? 'Modifier la pièce' : 'Ajouter une pièce'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            {[
              { label: 'Nom *', key: 'nom', placeholder: 'Ex: Capteur papier' },
              { label: 'Référence *', key: 'reference', placeholder: 'Ex: CAP-PAP-001' },
              { label: 'Photo URL', key: 'photo_url', placeholder: 'https://...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right">{label}</Label>
                <Input className="col-span-3" value={pieceForm[key]} onChange={e => setPieceForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
              </div>
            ))}
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Sous-ensemble</Label>
              <Select value={pieceForm.sous_ensemble} onValueChange={v => setPieceForm(f => ({ ...f, sous_ensemble: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Type terminal</Label>
              <Select value={pieceForm.type_terminal} onValueChange={v => setPieceForm(f => ({ ...f, type_terminal: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="2020">2020</SelectItem>
                  <SelectItem value="2031">2031</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-3">
              <Label className="pt-2 text-right">Commentaire</Label>
              <textarea className="col-span-3 rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} value={pieceForm.commentaire} onChange={e => setPieceForm(f => ({ ...f, commentaire: e.target.value }))} placeholder="Notes..." />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={savePiece} disabled={isLoading}>{isLoading ? 'Enregistrement...' : 'Sauvegarder'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG AIDE REPARATION ===== */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Aide à la Réparation — {helpPiece?.nom}
            </DialogTitle>
          </DialogHeader>
          {helpPiece && (
            <div className="space-y-6 py-2">
              {/* Description */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Description de la pièce</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={helpPiece.description_aide || ''}
                  onChange={e => setHelpPiece(p => ({ ...p, description_aide: e.target.value }))}
                  disabled={!canManage}
                  placeholder="Description fonctionnelle..."
                />
                {canManage && <Button size="sm" variant="outline" onClick={savePanneDescription}>Sauvegarder</Button>}
              </div>

              {/* Pannes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Types de pannes
                </Label>
                <div className="space-y-2">
                  {pannes.length === 0 && <p className="text-sm text-muted-foreground">Aucune panne renseignée.</p>}
                  {pannes.map(p => (
                    <div key={p.id} className="flex items-start justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                      <span>{p.description}</span>
                      {canManage && <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 shrink-0" onClick={() => delPanne(p.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  ))}
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Input value={newPanne} onChange={e => setNewPanne(e.target.value)} placeholder="Ex: Bourrage papier..." onKeyDown={e => e.key === 'Enter' && addPanne()} />
                    <Button size="sm" onClick={addPanne}><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>

              {/* Procédure */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Procédure de réparation</Label>
                <div className="space-y-3">
                  {procedures.length === 0 && <p className="text-sm text-muted-foreground">Aucune étape.</p>}
                  {procedures.map((p, i) => (
                    <div key={p.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-primary text-sm">Étape {i + 1}</span>
                        {canManage && <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400" onClick={() => delProc(p.id)}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                      <p className="text-sm">{p.description}</p>
                      {p.image_url && <img src={p.image_url} alt={`Étape ${i + 1}`} className="max-h-48 rounded border object-contain" />}
                    </div>
                  ))}
                </div>
                {canManage && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label className="text-sm font-medium">Ajouter une étape</Label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} value={newProc.description} onChange={e => setNewProc(p => ({ ...p, description: e.target.value }))} placeholder="Description de l'étape..." />
                    <Input value={newProc.image_url} onChange={e => setNewProc(p => ({ ...p, image_url: e.target.value }))} placeholder="URL image optionnelle..." />
                    <Button size="sm" onClick={addProc}><Plus className="mr-2 h-4 w-4" /> Ajouter</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG MODELE ===== */}
      <Dialog open={isModeleOpen} onOpenChange={setIsModeleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingModele ? 'Modifier le modèle' : 'Créer un modèle'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Nom *</Label>
              <Input className="col-span-3" value={modeleForm.nom} onChange={e => setModeleForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: HP LaserJet Standard" />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Sous-ensemble</Label>
              <Select value={modeleForm.sous_ensemble} onValueChange={v => setModeleForm(f => ({ ...f, sous_ensemble: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Type terminal</Label>
              <Select value={modeleForm.type_terminal} onValueChange={v => setModeleForm(f => ({ ...f, type_terminal: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="2020">2020</SelectItem>
                  <SelectItem value="2031">2031</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={saveModele}>{editingModele ? 'Mettre à jour' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG COMPOSITION ===== */}
      <Dialog open={isCompoOpen} onOpenChange={setIsCompoOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Composition : {selectedModele?.nom}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {modelePieces.length === 0 && <p className="text-sm text-muted-foreground">Aucune pièce.</p>}
            {modelePieces.map(mp => (
              <div key={mp.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm font-medium">{mp.piece?.nom} <span className="text-muted-foreground">({mp.piece?.reference})</span></span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Qté : {mp.quantite}</Badge>
                  {canManage && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removePieceModele(mp.id)}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              </div>
            ))}
            {canManage && (
              <div className="space-y-2 rounded-md border p-3">
                <Label className="font-semibold text-sm">Ajouter une pièce</Label>
                <Select value={addToModele.piece_id} onValueChange={v => setAddToModele(a => ({ ...a, piece_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une pièce..." /></SelectTrigger>
                  <SelectContent>
                    {pieces
                      .filter(p => !selectedModele || p.sous_ensemble === selectedModele.sous_ensemble || p.type_terminal === 'tous')
                      .map(p => <SelectItem key={p.id} value={p.id}>{p.nom} ({p.reference})</SelectItem>)
                    }
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="w-24 shrink-0">Quantité</Label>
                  <Input type="number" min={1} className="w-24" value={addToModele.quantite} onChange={e => setAddToModele(a => ({ ...a, quantite: e.target.value }))} />
                  <Button size="sm" onClick={addPieceModele}><Plus className="mr-1 h-4 w-4" /> Ajouter</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG STOCK MOUVEMENT ===== */}
      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Mouvement de stock</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Pièce</Label>
              <Select value={stockForm.piece_id} onValueChange={v => setStockForm(f => ({ ...f, piece_id: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{pieces.map(p => <SelectItem key={p.id} value={p.id}>{p.nom} ({p.reference})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Type</Label>
              <Select value={stockForm.type} onValueChange={v => setStockForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entree"><span className="flex items-center gap-1"><ArrowUpCircle className="h-3 w-3 text-green-600" /> Entrée</span></SelectItem>
                  <SelectItem value="sortie"><span className="flex items-center gap-1"><ArrowDownCircle className="h-3 w-3 text-red-600" /> Sortie</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Quantité</Label>
              <Input type="number" min={1} className="col-span-3" value={stockForm.quantite} onChange={e => setStockForm(f => ({ ...f, quantite: e.target.value }))} />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Motif</Label>
              <Input className="col-span-3" value={stockForm.motif} onChange={e => setStockForm(f => ({ ...f, motif: e.target.value }))} placeholder="Ex: Réapprovisionnement" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={saveMouvement} disabled={isLoading}>{isLoading ? 'Enregistrement...' : 'Valider'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG IMPORT ===== */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" /> Importer des pièces depuis CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Instructions */}
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Format attendu (colonnes CSV) :</p>
              <p className="font-mono text-xs">Nom, Référence, Sous-ensemble, Type terminal, Commentaire</p>
              <p className="text-xs mt-1">Valeurs Sous-ensemble : <span className="font-mono">imprimante | lecteur | ecran | afficheur</span> (ou leur libellé français)</p>
              <p className="text-xs">Valeurs Type terminal : <span className="font-mono">tous | 2020 | 2031</span></p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Télécharger le modèle
              </Button>
              <Label
                htmlFor="import-file"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <FileUp className="h-4 w-4" />
                Choisir un fichier CSV
                <input
                  id="import-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => { if (e.target.files[0]) parseImportFile(e.target.files[0]); e.target.value = ''; }}
                />
              </Label>
            </div>

            {/* Erreurs */}
            {importErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
                  <X className="h-4 w-4" /> {importErrors.length} erreur(s) détectée(s)
                </p>
                <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                  {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* Prévisualisation */}
            {importRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Prévisualisation — {importRows.filter(r => r._errors.length === 0).length} ligne(s) valide(s) sur {importRows.length}
                </p>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>État</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Sous-ensemble</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((r, i) => (
                        <TableRow key={i} className={r._errors.length ? 'bg-red-50' : ''}>
                          <TableCell>
                            {r._errors.length
                              ? <Badge className="bg-red-100 text-red-700 text-xs">Erreur</Badge>
                              : <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>}
                          </TableCell>
                          <TableCell className="text-sm">{r.nom || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.reference || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{SOUS_ENSEMBLE_LABELS[r.sous_ensemble] || r.sous_ensemble}</Badge></TableCell>
                          <TableCell className="text-xs">{r.type_terminal === 'tous' ? 'Tous' : r.type_terminal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button
              onClick={executeImport}
              disabled={isImporting || importRows.filter(r => r._errors.length === 0).length === 0}
            >
              {isImporting ? 'Importation...' : `Importer ${importRows.filter(r => r._errors.length === 0).length} pièce(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PiecesSousEnsemblesTab;
