import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/Combobox';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, Download, Edit, FileUp, HelpCircle,
  ImagePlus, Layers, ListChecks, Package, Plus, Search, Trash2, ArrowUpCircle, ArrowDownCircle, Wrench, X,
} from 'lucide-react';

const SOUS_ENSEMBLE_LABELS = {
  imprimante: 'Imprimante',
  lecteur: 'Lecteur',
  ecran: 'Écran',
  afficheur: 'Afficheur client',
  buc: 'BUC',
  carrosserie: 'Carrosserie',
};

const DEFAULT_PIECE = { nom: '', reference: '', prix_unitaire_ht: 0, sous_ensemble: 'imprimante', type_terminal: 'tous', commentaire: '', photo_url: '', description_aide: '' };
const DEFAULT_MODELE = { nom: '', sous_ensemble: 'imprimante', type_terminal: 'tous' };

const statusBadge = (qty, seuil) => {
  if (qty === 0) return <Badge className="bg-red-100 text-red-800">Rupture</Badge>;
  if (qty <= seuil) return <Badge className="bg-yellow-100 text-yellow-800">Stock faible</Badge>;
  return <Badge className="bg-green-100 text-green-800">Disponible</Badge>;
};

const formatPrice = (value) => Number(value || 0).toLocaleString('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const PiecesSousEnsemblesTab = ({ canManage = true }) => {
  const { toast } = useToast();
  const [pieces, setPieces] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [stockPieces, setStockPieces] = useState([]);
  const [pannes, setPannes] = useState([]);
  const [codesPannes, setCodesPannes] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [modelePieces, setModelePieces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState({ sous_ensemble: '__all__', type_terminal: '__all__' });
  const [search, setSearch] = useState('');

  // Filtres dédiés au tab Stock Pièces
  const [stockFilters, setStockFilters] = useState({
    sous_ensemble: '__all__',
    type_terminal: '__all__',
    etat:          '__all__', // __all__ | rupture | faible | dispo
  });
  const [stockSearch, setStockSearch] = useState('');

  const [isPieceOpen, setIsPieceOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState(null);
  const [pieceForm, setPieceForm] = useState(DEFAULT_PIECE);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpPiece, setHelpPiece] = useState(null);
  const [newPanne, setNewPanne] = useState('');
  const [newPannePoids, setNewPannePoids] = useState(3);
  const [panneSelectKey, setPanneSelectKey] = useState(0);
  const [newProc, setNewProc] = useState({ description: '', image_url: '' });
  const [editingPanneId, setEditingPanneId] = useState(null);
  const [editingPanneText, setEditingPanneText] = useState('');
  const [editingPannePoids, setEditingPannePoids] = useState(3);
  const [editingProcId, setEditingProcId] = useState(null);
  const [editingProcData, setEditingProcData] = useState({ description: '', image_url: '' });
  const [editingProcFile, setEditingProcFile] = useState(null);
  const [editingProcPreview, setEditingProcPreview] = useState(null);
  const [newProcFile, setNewProcFile] = useState(null);
  const [newProcPreview, setNewProcPreview] = useState(null);

  const [panneChecksMap, setPanneChecksMap] = useState({});
  const [expandedPanneCheckId, setExpandedPanneCheckId] = useState(null);
  const [newCheckForms, setNewCheckForms] = useState({});

  const [isModeleOpen, setIsModeleOpen] = useState(false);
  const [editingModele, setEditingModele] = useState(null);
  const [modeleForm, setModeleForm] = useState(DEFAULT_MODELE);

  const [isCompoOpen, setIsCompoOpen] = useState(false);
  const [selectedModele, setSelectedModele] = useState(null);
  const [addToModele, setAddToModele] = useState({ piece_id: '', quantite: 1 });
  const [selectedCompoPiece, setSelectedCompoPiece] = useState(null);

  const [isStockOpen, setIsStockOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ piece_id: '', type: 'entree', quantite: 1, motif: '' });

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [pRes, mRes, sRes, cpRes] = await Promise.all([
      supabase.from('pieces_sous_ensembles').select('*').order('nom'),
      supabase.from('modeles_sous_ensembles').select('*').order('nom'),
      supabase.from('stock_pieces').select('*, piece:pieces_sous_ensembles(nom, reference)').order('updated_at', { ascending: false }),
      supabase.from('codes_pannes').select('id, code, libelle').order('code'),
    ]);
    if (!pRes.error) setPieces(pRes.data || []);
    if (!mRes.error) setModeles(mRes.data || []);
    if (!sRes.error) setStockPieces(sRes.data || []);
    if (!cpRes.error) setCodesPannes(cpRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadHelp = useCallback(async (pieceId) => {
    const [pnRes, prRes] = await Promise.all([
      supabase.from('pieces_pannes').select('*').eq('piece_id', pieceId).order('created_at'),
      supabase.from('pieces_procedures').select('*').eq('piece_id', pieceId).order('ordre'),
    ]);
    if (!pnRes.error) {
      setPannes(pnRes.data || []);
      const panneIds = (pnRes.data || []).map(p => p.id);
      if (panneIds.length > 0) {
        const { data: checks } = await supabase
          .from('pieces_pannes_checks')
          .select('*, piece:pieces_sous_ensembles(id, nom)')
          .in('panne_id', panneIds)
          .order('ordre');
        const map = {};
        for (const c of (checks || [])) {
          if (!map[c.panne_id]) map[c.panne_id] = [];
          map[c.panne_id].push(c);
        }
        setPanneChecksMap(map);
      } else {
        setPanneChecksMap({});
      }
    }
    if (!prRes.error) setProcedures(prRes.data || []);
  }, []);

  const loadCompo = useCallback(async (modeleId) => {
    const { data } = await supabase
      .from('modeles_pieces')
      .select('*, piece:pieces_sous_ensembles(id, nom, reference, photo_url)')
      .eq('modele_id', modeleId);
    setModelePieces(data || []);
  }, []);

  const stockById = useMemo(() => stockPieces.reduce((a, s) => { a[s.piece_id] = s; return a; }, {}), [stockPieces]);

  // Liste fusionnée : TOUTES les pièces du catalogue + leur ligne de stock si elle existe
  // (sinon quantité = 0, seuil = 0). Trié par nom pour cohérence avec le catalogue.
  const stockRows = useMemo(() => {
    return [...pieces]
      .sort((a, b) => String(a.nom ?? '').localeCompare(String(b.nom ?? ''), 'fr', { sensitivity: 'base' }))
      .map((p) => {
        const stock = stockById[p.id];
        return {
          id:             stock?.id ?? `no-stock-${p.id}`,
          piece_id:       p.id,
          piece:          { nom: p.nom, reference: p.reference },
          quantite:       stock?.quantite ?? 0,
          seuil_alerte:   stock?.seuil_alerte ?? 0,
          hasStock:       !!stock,
          // Attributs catalogue conservés pour les filtres
          sous_ensemble:  p.sous_ensemble,
          type_terminal:  p.type_terminal,
        };
      });
  }, [pieces, stockById]);

  // Application des filtres du tab Stock
  const filteredStockRows = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();
    return stockRows
      .filter(s => stockFilters.sous_ensemble === '__all__' || s.sous_ensemble === stockFilters.sous_ensemble)
      .filter(s => stockFilters.type_terminal === '__all__' || s.type_terminal === 'tous' || s.type_terminal === stockFilters.type_terminal)
      .filter(s => {
        if (stockFilters.etat === '__all__') return true;
        if (stockFilters.etat === 'rupture') return s.quantite === 0;
        if (stockFilters.etat === 'faible')  return s.quantite > 0 && s.quantite <= s.seuil_alerte;
        if (stockFilters.etat === 'dispo')   return s.quantite > s.seuil_alerte;
        return true;
      })
      .filter(s => !term
        || String(s.piece?.nom ?? '').toLowerCase().includes(term)
        || String(s.piece?.reference ?? '').toLowerCase().includes(term));
  }, [stockRows, stockFilters, stockSearch]);

  const hasActiveStockFilter =
    stockFilters.sous_ensemble !== '__all__' ||
    stockFilters.type_terminal !== '__all__' ||
    stockFilters.etat !== '__all__' ||
    stockSearch.trim() !== '';

  const resetStockFilters = () => {
    setStockFilters({ sous_ensemble: '__all__', type_terminal: '__all__', etat: '__all__' });
    setStockSearch('');
  };

  const filteredPieces = useMemo(() =>
    pieces
      .filter(p => filters.sous_ensemble === '__all__' || p.sous_ensemble === filters.sous_ensemble)
      .filter(p => filters.type_terminal === '__all__' || p.type_terminal === 'tous' || p.type_terminal === filters.type_terminal)
      .filter(p => !search || p.nom.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase())),
    [pieces, filters, search]
  );

  const showOk = (msg) => toast({ title: msg, className: 'bg-green-500 text-white' });
  const showErr = (msg) => toast({ title: 'Erreur', description: msg, variant: 'destructive' });

  const resetPhotoState = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // --- PIECES CRUD ---
  const uploadPiecePhoto = () => {
    if (!photoFile) return Promise.resolve(pieceForm.photo_url);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier image.'));
      reader.readAsDataURL(photoFile);
    });
  };

  const savePiece = async () => {
    if (!pieceForm.nom.trim() || !pieceForm.reference.trim()) { showErr('Nom et référence requis.'); return; }
    setIsLoading(true);
    try {
      const photo_url = await uploadPiecePhoto();
      const dataToSave = {
        ...pieceForm,
        prix_unitaire_ht: Number(pieceForm.prix_unitaire_ht) || 0,
        photo_url,
      };
      const { error } = editingPiece
        ? await supabase.from('pieces_sous_ensembles').update(dataToSave).eq('id', editingPiece.id)
        : await supabase.from('pieces_sous_ensembles').insert(dataToSave);
      if (error) { showErr(error.message); } else {
        showOk(`Pièce ${editingPiece ? 'modifiée' : 'ajoutée'}.`);
        setIsPieceOpen(false);
        resetPhotoState();
        load();
      }
    } catch (err) {
      showErr(err.message);
    }
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
    await supabase.from('pieces_pannes').insert({ piece_id: helpPiece.id, description: newPanne.trim(), poids: newPannePoids });
    setNewPanne(''); setNewPannePoids(3); loadHelp(helpPiece.id);
  };

  const addPanneFromCode = async (libelle) => {
    if (!libelle) return;
    await supabase.from('pieces_pannes').insert({ piece_id: helpPiece.id, description: libelle, poids: newPannePoids });
    setPanneSelectKey(k => k + 1);
    loadHelp(helpPiece.id);
  };

  const delPanne = async (id) => { await supabase.from('pieces_pannes').delete().eq('id', id); loadHelp(helpPiece.id); };

  const savePanneEdit = async () => {
    if (!editingPanneText.trim()) return;
    await supabase.from('pieces_pannes').update({ description: editingPanneText.trim(), poids: editingPannePoids }).eq('id', editingPanneId);
    setEditingPanneId(null); setEditingPanneText(''); setEditingPannePoids(3);
    loadHelp(helpPiece.id);
  };

  const addPanneCheck = async (panneId) => {
    const form = newCheckForms[panneId] || {};
    if (!form.description_verification?.trim()) return;
    const checks = panneChecksMap[panneId] || [];
    const { error } = await supabase.from('pieces_pannes_checks').insert({
      panne_id: panneId,
      piece_id: (form.piece_id && form.piece_id !== '__none__') ? form.piece_id : null,
      description_verification: form.description_verification.trim(),
      ordre: checks.length,
    });
    if (error) { showErr(error.message); return; }
    setNewCheckForms(prev => ({ ...prev, [panneId]: { description_verification: '', piece_id: '' } }));
    loadHelp(helpPiece.id);
  };

  const delPanneCheck = async (checkId) => {
    await supabase.from('pieces_pannes_checks').delete().eq('id', checkId);
    loadHelp(helpPiece.id);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erreur lecture fichier.'));
    reader.readAsDataURL(file);
  });

  const addProc = async () => {
    if (!newProc.description.trim()) return;
    let image_url = newProc.image_url || null;
    if (newProcFile) image_url = await fileToBase64(newProcFile);
    await supabase.from('pieces_procedures').insert({ piece_id: helpPiece.id, ordre: procedures.length + 1, description: newProc.description, image_url });
    setNewProc({ description: '', image_url: '' });
    if (newProcPreview) URL.revokeObjectURL(newProcPreview);
    setNewProcFile(null); setNewProcPreview(null);
    loadHelp(helpPiece.id);
  };

  const delProc = async (id) => { await supabase.from('pieces_procedures').delete().eq('id', id); loadHelp(helpPiece.id); };

  const saveProcEdit = async () => {
    if (!editingProcData.description.trim()) return;
    let image_url = editingProcData.image_url || null;
    if (editingProcFile) image_url = await fileToBase64(editingProcFile);
    await supabase.from('pieces_procedures').update({ description: editingProcData.description.trim(), image_url }).eq('id', editingProcId);
    setEditingProcId(null); setEditingProcData({ description: '', image_url: '' });
    if (editingProcPreview) URL.revokeObjectURL(editingProcPreview);
    setEditingProcFile(null); setEditingProcPreview(null);
    loadHelp(helpPiece.id);
  };

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

  const openCompo = async (modele) => { setSelectedModele(modele); setSelectedCompoPiece(null); setIsCompoOpen(true); await loadCompo(modele.id); };

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
    const headers = ['Nom', 'Référence', 'Prix unitaire HT', 'Sous-ensemble', 'Type terminal', 'Commentaire'];
    const rows = filteredPieces.map(p => [
      p.nom,
      p.reference,
      p.prix_unitaire_ht ?? 0,
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
    const csv = 'Nom,Référence,Prix unitaire HT,Sous-ensemble,Type terminal,Commentaire\n' +
      '"Exemple capteur","CAP-001","12500","imprimante","tous","Optionnel"';
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
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headerCols = lines[0].split(delimiter).map(c => c.trim().toLowerCase());
      const hasPriceColumn = headerCols.some(c => c.includes('prix'));
      const parsed = []; const errors = [];
      lines.slice(1).forEach((line, i) => {
        const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        const [nom, reference, third, fourth, fifth, sixth] = cols;
        const prixRaw = hasPriceColumn ? third : '0';
        const seRaw = hasPriceColumn ? fourth : third;
        const typeRaw = hasPriceColumn ? fifth : fourth;
        const commentaire = hasPriceColumn ? sixth : fifth;
        const rowNum = i + 2;
        const rowErrors = [];
        if (!nom) rowErrors.push('Nom requis');
        if (!reference) rowErrors.push('Référence requise');
        const parsedPrice = Number(String(prixRaw || '0').replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) rowErrors.push(`Prix HT invalide : "${prixRaw}"`);
        const seKey = SE_REVERSE[seRaw?.toLowerCase()] || (VALID_SE.includes(seRaw?.toLowerCase()) ? seRaw?.toLowerCase() : null);
        if (!seKey) rowErrors.push(`Sous-ensemble invalide : "${seRaw}"`);
        const typeVal = typeRaw === 'Tous' || typeRaw === 'tous' ? 'tous' : ['2020', '2031'].includes(typeRaw) ? typeRaw : 'tous';
        if (rowErrors.length) { errors.push(`Ligne ${rowNum} : ${rowErrors.join(', ')}`); }
        parsed.push({ nom, reference, prix_unitaire_ht: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0, sous_ensemble: seKey || 'imprimante', type_terminal: typeVal, commentaire: commentaire || '', _errors: rowErrors });
      });
      setImportRows(parsed);
      setImportErrors(errors);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const executeImport = async () => {
    const rawValid = importRows.filter(r => r._errors.length === 0).map(({ _errors, ...r }) => r);
    // Dédupliquer par référence (garde la dernière occurrence) pour éviter "ON CONFLICT DO UPDATE ... row a second time"
    const seen = new Map();
    rawValid.forEach(r => seen.set(r.reference, r));
    const validRows = [...seen.values()];
    if (!validRows.length) { showErr('Aucune ligne valide à importer.'); return; }
    setIsImporting(true);

    const CHUNK = 50;
    let imported = 0;
    const failedRefs = [];

    for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK);
      const { error: chunkErr } = await supabase
        .from('pieces_sous_ensembles')
        .upsert(chunk, { onConflict: 'reference', ignoreDuplicates: false });
      if (!chunkErr) {
        imported += chunk.length;
      } else {
        // Réessayer ligne par ligne pour identifier les lignes rejetées
        for (const row of chunk) {
          const { error: rowErr } = await supabase
            .from('pieces_sous_ensembles')
            .upsert([row], { onConflict: 'reference', ignoreDuplicates: false });
          if (rowErr) failedRefs.push(row.reference);
          else imported++;
        }
      }
    }

    setIsImporting(false);

    if (imported > 0) {
      showOk(`${imported} pièce(s) importée(s) ou mise(s) à jour.`);
      setIsImportOpen(false); setImportRows([]); setImportErrors([]);
      load();
    }
    if (failedRefs.length) {
      showErr(`${failedRefs.length} ligne(s) rejetée(s) par la base de données : ${failedRefs.slice(0, 5).join(', ')}${failedRefs.length > 5 ? `… (+${failedRefs.length - 5})` : ''}`);
    }
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
                      <Button onClick={() => { setPieceForm(DEFAULT_PIECE); setEditingPiece(null); resetPhotoState(); setIsPieceOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Ajouter une pièce</Button>
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
                    <TableHead className="text-right">Prix unitaire HT</TableHead>
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
                        <TableCell className="text-right font-medium">{formatPrice(p.prix_unitaire_ht)} FCFA</TableCell>
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" title="Aide réparation" className="h-7 w-7 text-primary" onClick={() => openHelp(p)}><HelpCircle className="h-4 w-4" /></Button>
                            {canManage && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => { setPieceForm({ ...DEFAULT_PIECE, ...p, prix_unitaire_ht: p.prix_unitaire_ht ?? 0 }); setEditingPiece(p); resetPhotoState(); setIsPieceOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deletePiece(p.id)}><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
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
                    <Select value={helpPiece?.id || ''} onValueChange={async (v) => { const found = pieces.find(p => p.id === v); if (found) { setHelpPiece(found); await loadHelp(found.id); } }}>
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
                              <div key={p.id} className="rounded-md border border-amber-200 bg-amber-50 text-sm">
                                <div className="flex items-start justify-between px-3 py-2">
                                  {editingPanneId === p.id ? (
                                    <div className="flex flex-1 flex-wrap items-center gap-2">
                                      <Select value={editingPanneText} onValueChange={setEditingPanneText}>
                                        <SelectTrigger className="flex-1 h-7 text-xs min-w-0 border-amber-300 bg-white">
                                          <SelectValue placeholder="Choisir un code panne…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {codesPannes.map(c => (
                                            <SelectItem key={c.id} value={c.libelle}>
                                              <span className="font-mono font-semibold text-amber-700">{c.code}</span>&nbsp;—&nbsp;{c.libelle}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-xs text-muted-foreground">Poids</span>
                                        {[1,2,3,4,5].map(n => (
                                          <button key={n} onClick={() => setEditingPannePoids(n)} className={`h-5 w-5 rounded text-[10px] font-bold border transition-colors ${editingPannePoids === n ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}`}>{n}</button>
                                        ))}
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-green-600" onClick={savePanneEdit} disabled={!editingPanneText.trim()}><Check className="h-3 w-3" /></Button>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground" onClick={() => { setEditingPanneId(null); setEditingPanneText(''); }}><X className="h-3 w-3" /></Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="flex-1 truncate">{p.description}</span>
                                        <span title={`Poids : ${p.poids || 3}/5`} className={`shrink-0 h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center ${(p.poids || 3) >= 4 ? 'bg-red-100 text-red-700' : (p.poids || 3) === 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{p.poids || 3}</span>
                                      </div>
                                      <div className="flex items-center gap-0.5 ml-2 shrink-0">
                                        <button
                                          title="Étapes de vérification"
                                          onClick={() => setExpandedPanneCheckId(prev => prev === p.id ? null : p.id)}
                                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-amber-700 hover:bg-amber-200 transition-colors"
                                        >
                                          <ListChecks className="h-3 w-3" />
                                          {(panneChecksMap[p.id] || []).length}
                                          {expandedPanneCheckId === p.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </button>
                                        {canManage && (
                                          <>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-400 hover:text-blue-600" onClick={() => { setEditingPanneId(p.id); setEditingPanneText(p.description); setEditingPannePoids(p.poids || 3); }}><Edit className="h-3 w-3" /></Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600" onClick={() => delPanne(p.id)}><Trash2 className="h-3 w-3" /></Button>
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                {expandedPanneCheckId === p.id && (
                                  <div className="border-t border-amber-200 bg-amber-50/80 px-3 pb-3 pt-2 space-y-2">
                                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                                      <ListChecks className="h-3 w-3" /> Étapes de vérification
                                    </p>
                                    {(panneChecksMap[p.id] || []).length === 0 && (
                                      <p className="text-xs text-muted-foreground italic">Aucune vérification définie.</p>
                                    )}
                                    <div className="space-y-1">
                                      {(panneChecksMap[p.id] || []).map(c => (
                                        <div key={c.id} className="flex items-center gap-2 rounded bg-white/80 border border-amber-100 px-2.5 py-1.5 text-xs">
                                          <span className="flex-1">{c.description_verification}</span>
                                          {c.piece && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{c.piece.nom}</span>}
                                          {canManage && (
                                            <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 text-red-400 hover:text-red-600" onClick={() => delPanneCheck(c.id)}>
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    {canManage && (
                                      <div className="flex gap-1.5 pt-1">
                                        <Input
                                          value={newCheckForms[p.id]?.description_verification || ''}
                                          onChange={e => setNewCheckForms(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), description_verification: e.target.value } }))}
                                          placeholder="Ex: Vérifier l'alignement du rouleau..."
                                          className="flex-1 h-7 text-xs"
                                          onKeyDown={e => e.key === 'Enter' && addPanneCheck(p.id)}
                                        />
                                        <Select
                                          value={newCheckForms[p.id]?.piece_id || '__none__'}
                                          onValueChange={v => setNewCheckForms(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), piece_id: v === '__none__' ? '' : v } }))}
                                        >
                                          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Pièce (opt.)" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">Aucune</SelectItem>
                                            {pieces.map(pc => <SelectItem key={pc.id} value={pc.id}>{pc.nom}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                        <Button size="icon" className="h-7 w-7 shrink-0" onClick={() => addPanneCheck(p.id)}>
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {canManage && codesPannes.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Ajouter un type de panne</p>
                              <div className="flex items-center gap-2">
                                <Select key={panneSelectKey} onValueChange={addPanneFromCode}>
                                  <SelectTrigger className="flex-1 h-8 text-xs bg-white border-amber-200 hover:border-amber-400 transition-colors">
                                    <SelectValue placeholder="Sélectionner un code panne…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {codesPannes.map(c => (
                                      <SelectItem key={c.id} value={c.libelle}>
                                        <span className="font-mono font-semibold text-amber-700">{c.code}</span>&nbsp;—&nbsp;{c.libelle}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex shrink-0 items-center gap-1">
                                  {[1,2,3,4,5].map(n => (
                                    <button key={n} onClick={() => setNewPannePoids(n)} className={`h-6 w-6 rounded text-xs font-bold border transition-colors ${newPannePoids === n ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 text-amber-600 hover:bg-amber-100'}`}>{n}</button>
                                  ))}
                                </div>
                              </div>
                              <p className="text-right text-[10px] text-amber-500 font-medium">
                                Priorité&nbsp;: {newPannePoids <= 2 ? 'Faible' : newPannePoids === 3 ? 'Moyenne' : newPannePoids === 4 ? 'Élevée' : 'Critique'}
                              </p>
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
                                  {canManage && (
                                    <div className="flex items-center gap-0.5">
                                      {editingProcId === p.id ? (
                                        <>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={saveProcEdit}><Check className="h-3 w-3" /></Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => { setEditingProcId(null); setEditingProcData({ description: '', image_url: '' }); }}><X className="h-3 w-3" /></Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-600" onClick={() => { setEditingProcId(p.id); setEditingProcData({ description: p.description, image_url: p.image_url || '' }); }}><Edit className="h-3 w-3" /></Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => delProc(p.id)}><Trash2 className="h-3 w-3" /></Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {editingProcId === p.id ? (
                                  <div className="space-y-2">
                                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={editingProcData.description} onChange={e => setEditingProcData(d => ({ ...d, description: e.target.value }))} placeholder="Description de l'étape..." autoFocus />
                                    {(editingProcPreview || editingProcData.image_url) && (
                                      <div className="relative">
                                        <img src={editingProcPreview || editingProcData.image_url} alt="aperçu" className="max-h-36 w-full rounded border object-contain bg-muted/30" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                        <button type="button" onClick={() => { setEditingProcData(d => ({ ...d, image_url: '' })); if (editingProcPreview) URL.revokeObjectURL(editingProcPreview); setEditingProcFile(null); setEditingProcPreview(null); }} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-red-500 hover:bg-red-50 border border-red-200 shadow-sm"><X className="h-3 w-3" /></button>
                                      </div>
                                    )}
                                    <Label htmlFor={`proc-edit-photo-${editingProcId}`} className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                                      <ImagePlus className="h-3.5 w-3.5" />
                                      {editingProcFile ? editingProcFile.name : 'Importer une photo'}
                                      <input id={`proc-edit-photo-${editingProcId}`} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (editingProcPreview) URL.revokeObjectURL(editingProcPreview); setEditingProcFile(f); setEditingProcPreview(URL.createObjectURL(f)); setEditingProcData(d => ({ ...d, image_url: '' })); e.target.value = ''; }} />
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      <span className="shrink-0 text-xs text-muted-foreground">ou URL :</span>
                                      <Input value={editingProcData.image_url} onChange={e => { setEditingProcData(d => ({ ...d, image_url: e.target.value })); if (editingProcPreview) URL.revokeObjectURL(editingProcPreview); setEditingProcFile(null); setEditingProcPreview(null); }} placeholder="https://..." className="flex-1 text-xs" disabled={!!editingProcFile} />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm">{p.description}</p>
                                    {p.image_url && <img src={p.image_url} alt={`Étape ${i + 1}`} className="max-h-56 rounded border object-contain w-full" />}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                          {canManage && (
                            <div className="rounded-md border border-dashed p-4 space-y-3">
                              <p className="text-sm font-medium text-muted-foreground">Ajouter une étape</p>
                              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} value={newProc.description} onChange={e => setNewProc(p => ({ ...p, description: e.target.value }))} placeholder="Description de l'étape..." />
                              {(newProcPreview || newProc.image_url) && (
                                <div className="relative">
                                  <img src={newProcPreview || newProc.image_url} alt="aperçu" className="max-h-36 w-full rounded border object-contain bg-muted/30" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                  <button type="button" onClick={() => { setNewProc(p => ({ ...p, image_url: '' })); if (newProcPreview) URL.revokeObjectURL(newProcPreview); setNewProcFile(null); setNewProcPreview(null); }} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-red-500 hover:bg-red-50 border border-red-200 shadow-sm"><X className="h-3 w-3" /></button>
                                </div>
                              )}
                              <Label htmlFor="proc-new-photo-tab" className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                                <ImagePlus className="h-3.5 w-3.5" />
                                {newProcFile ? newProcFile.name : 'Importer une photo'}
                                <input id="proc-new-photo-tab" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (newProcPreview) URL.revokeObjectURL(newProcPreview); setNewProcFile(f); setNewProcPreview(URL.createObjectURL(f)); setNewProc(p => ({ ...p, image_url: '' })); e.target.value = ''; }} />
                              </Label>
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 text-xs text-muted-foreground">ou URL :</span>
                                <Input value={newProc.image_url} onChange={e => { setNewProc(p => ({ ...p, image_url: e.target.value })); if (newProcPreview) URL.revokeObjectURL(newProcPreview); setNewProcFile(null); setNewProcPreview(null); }} placeholder="https://..." className="flex-1 text-xs" disabled={!!newProcFile} />
                              </div>
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
                <Card
                  onClick={() => setStockFilters(f => ({ ...f, etat: f.etat === 'rupture' ? '__all__' : 'rupture' }))}
                  className={`cursor-pointer border-red-200 bg-red-50 transition-all hover:shadow-md ${stockFilters.etat === 'rupture' ? 'ring-2 ring-red-500' : ''}`}
                >
                  <CardContent className="p-4">
                    <p className="text-sm text-red-700 font-medium">Ruptures de stock</p>
                    <p className="text-2xl font-bold text-red-800">{stockRows.filter(s => s.quantite === 0).length}</p>
                  </CardContent>
                </Card>
                <Card
                  onClick={() => setStockFilters(f => ({ ...f, etat: f.etat === 'faible' ? '__all__' : 'faible' }))}
                  className={`cursor-pointer border-yellow-200 bg-yellow-50 transition-all hover:shadow-md ${stockFilters.etat === 'faible' ? 'ring-2 ring-yellow-500' : ''}`}
                >
                  <CardContent className="p-4">
                    <p className="text-sm text-yellow-700 font-medium">Stock faible</p>
                    <p className="text-2xl font-bold text-yellow-800">{stockRows.filter(s => s.quantite > 0 && s.quantite <= s.seuil_alerte).length}</p>
                  </CardContent>
                </Card>
                <Card
                  onClick={() => setStockFilters(f => ({ ...f, etat: f.etat === 'dispo' ? '__all__' : 'dispo' }))}
                  className={`cursor-pointer border-green-200 bg-green-50 transition-all hover:shadow-md ${stockFilters.etat === 'dispo' ? 'ring-2 ring-green-500' : ''}`}
                >
                  <CardContent className="p-4">
                    <p className="text-sm text-green-700 font-medium">Disponibles</p>
                    <p className="text-2xl font-bold text-green-800">{stockRows.filter(s => s.quantite > s.seuil_alerte).length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filtres */}
              <div className="flex flex-wrap items-end gap-3 pt-4">
                <div className="space-y-1">
                  <Label>Sous-ensemble</Label>
                  <Select value={stockFilters.sous_ensemble} onValueChange={v => setStockFilters(f => ({ ...f, sous_ensemble: v }))}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      {Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Type terminal</Label>
                  <Select value={stockFilters.type_terminal} onValueChange={v => setStockFilters(f => ({ ...f, type_terminal: v }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      <SelectItem value="2020">2020</SelectItem>
                      <SelectItem value="2031">2031</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>État</Label>
                  <Select value={stockFilters.etat} onValueChange={v => setStockFilters(f => ({ ...f, etat: v }))}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      <SelectItem value="rupture">Rupture</SelectItem>
                      <SelectItem value="faible">Stock faible</SelectItem>
                      <SelectItem value="dispo">Disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label>Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-10 pr-9" placeholder="Nom, référence..." value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
                    {stockSearch && (
                      <button
                        type="button"
                        onClick={() => setStockSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {hasActiveStockFilter && (
                  <Button variant="ghost" size="sm" onClick={resetStockFilters} className="text-xs">
                    <X className="mr-1 h-3 w-3" /> Réinitialiser
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableCaption>
                  {filteredStockRows.length === 0
                    ? 'Aucune pièce ne correspond aux filtres.'
                    : `${filteredStockRows.length} pièce(s)${hasActiveStockFilter ? ` sur ${stockRows.length}` : ''}.`}
                </TableCaption>
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
                  {filteredStockRows.map(s => (
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
      <Dialog open={isPieceOpen} onOpenChange={(open) => { if (!open) resetPhotoState(); setIsPieceOpen(open); }}>
        <DialogContent className="sm:max-w-lg relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <DialogHeader><DialogTitle className="text-primary">{editingPiece ? 'Modifier la pièce' : 'Ajouter une pièce'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            {[
              { label: 'Nom *', key: 'nom', placeholder: 'Ex: Capteur papier' },
              { label: 'Référence *', key: 'reference', placeholder: 'Ex: CAP-PAP-001' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right">{label}</Label>
                <Input className="col-span-3" value={pieceForm[key]} onChange={e => setPieceForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
              </div>
            ))}

            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Prix HT</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pieceForm.prix_unitaire_ht}
                  onChange={e => setPieceForm(f => ({ ...f, prix_unitaire_ht: e.target.value }))}
                  placeholder="0"
                />
                <span className="shrink-0 text-sm text-muted-foreground">FCFA</span>
              </div>
            </div>

            {/* Photo — upload ou URL */}
            <div className="grid grid-cols-4 items-start gap-3">
              <Label className="pt-2 text-right">Photo</Label>
              <div className="col-span-3 space-y-2">
                {(photoPreview || pieceForm.photo_url) && (
                  <div className="relative">
                    <img
                      src={photoPreview || pieceForm.photo_url}
                      alt="Aperçu"
                      className="w-full max-h-36 rounded-md border object-contain bg-muted/30"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => { setPieceForm(f => ({ ...f, photo_url: '' })); resetPhotoState(); }}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-red-500 hover:bg-red-50 border border-red-200 shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Label
                  htmlFor="piece-photo-upload"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  {photoFile ? photoFile.name : 'Importer une photo'}
                  <input
                    id="piece-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (photoPreview) URL.revokeObjectURL(photoPreview);
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                      setPieceForm(f => ({ ...f, photo_url: '' }));
                      e.target.value = '';
                    }}
                  />
                </Label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-muted-foreground">ou URL :</span>
                  <Input
                    className="flex-1 text-xs"
                    value={pieceForm.photo_url}
                    onChange={e => { setPieceForm(f => ({ ...f, photo_url: e.target.value })); resetPhotoState(); }}
                    placeholder="https://..."
                    disabled={!!photoFile}
                  />
                </div>
              </div>
            </div>

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
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[88vh] relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35 z-10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <DialogHeader className="relative shrink-0 px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <HelpCircle className="h-5 w-5 text-primary" />
              Aide à la Réparation — {helpPiece?.nom}
            </DialogTitle>
          </DialogHeader>
          {helpPiece && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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
                      {editingPanneId === p.id ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Select value={editingPanneText} onValueChange={setEditingPanneText}>
                            <SelectTrigger className="flex-1 h-7 text-xs min-w-0 border-amber-300 bg-white">
                              <SelectValue placeholder="Choisir un code panne…" />
                            </SelectTrigger>
                            <SelectContent>
                              {codesPannes.map(c => (
                                <SelectItem key={c.id} value={c.libelle}>
                                  <span className="font-mono font-semibold text-amber-700">{c.code}</span>&nbsp;—&nbsp;{c.libelle}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-muted-foreground">Poids</span>
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => setEditingPannePoids(n)} className={`h-5 w-5 rounded text-[10px] font-bold border transition-colors ${editingPannePoids === n ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}`}>{n}</button>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-green-600" onClick={savePanneEdit} disabled={!editingPanneText.trim()}><Check className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground" onClick={() => { setEditingPanneId(null); setEditingPanneText(''); }}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1">{p.description}</span>
                          {canManage && (
                            <div className="flex items-center gap-0.5 ml-2 shrink-0">
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-400 hover:text-blue-600" onClick={() => { setEditingPanneId(p.id); setEditingPanneText(p.description); }}><Edit className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600" onClick={() => delPanne(p.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {canManage && codesPannes.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Ajouter un type de panne</p>
                    <div className="flex items-center gap-2">
                      <Select key={panneSelectKey} onValueChange={addPanneFromCode}>
                        <SelectTrigger className="flex-1 h-8 text-xs bg-white border-amber-200 hover:border-amber-400 transition-colors">
                          <SelectValue placeholder="Sélectionner un code panne…" />
                        </SelectTrigger>
                        <SelectContent>
                          {codesPannes.map(c => (
                            <SelectItem key={c.id} value={c.libelle}>
                              <span className="font-mono font-semibold text-amber-700">{c.code}</span>&nbsp;—&nbsp;{c.libelle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex shrink-0 items-center gap-1">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setNewPannePoids(n)} className={`h-6 w-6 rounded text-xs font-bold border transition-colors ${newPannePoids === n ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 text-amber-600 hover:bg-amber-100'}`}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <p className="text-right text-[10px] text-amber-500 font-medium">
                      Priorité&nbsp;: {newPannePoids <= 2 ? 'Faible' : newPannePoids === 3 ? 'Moyenne' : newPannePoids === 4 ? 'Élevée' : 'Critique'}
                    </p>
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
                        {canManage && (
                          <div className="flex items-center gap-0.5">
                            {editingProcId === p.id ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-green-600" onClick={saveProcEdit}><Check className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => { setEditingProcId(null); setEditingProcData({ description: '', image_url: '' }); }}><X className="h-3 w-3" /></Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-400 hover:text-blue-600" onClick={() => { setEditingProcId(p.id); setEditingProcData({ description: p.description, image_url: p.image_url || '' }); }}><Edit className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600" onClick={() => delProc(p.id)}><Trash2 className="h-3 w-3" /></Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {editingProcId === p.id ? (
                        <div className="space-y-2">
                          <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={editingProcData.description} onChange={e => setEditingProcData(d => ({ ...d, description: e.target.value }))} placeholder="Description de l'étape..." autoFocus />
                          <Input value={editingProcData.image_url} onChange={e => setEditingProcData(d => ({ ...d, image_url: e.target.value }))} placeholder="URL image optionnelle (https://...)" className="text-sm" />
                          {editingProcData.image_url && <img src={editingProcData.image_url} alt="aperçu" className="max-h-36 rounded border object-contain w-full" />}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm">{p.description}</p>
                          {p.image_url && <img src={p.image_url} alt={`Étape ${i + 1}`} className="max-h-48 rounded border object-contain" />}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {canManage && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label className="text-sm font-medium">Ajouter une étape</Label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} value={newProc.description} onChange={e => setNewProc(p => ({ ...p, description: e.target.value }))} placeholder="Description de l'étape..." />
                    {(newProcPreview || newProc.image_url) && (
                      <div className="relative">
                        <img src={newProcPreview || newProc.image_url} alt="aperçu" className="max-h-36 w-full rounded border object-contain bg-muted/30" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <button type="button" onClick={() => { setNewProc(p => ({ ...p, image_url: '' })); if (newProcPreview) URL.revokeObjectURL(newProcPreview); setNewProcFile(null); setNewProcPreview(null); }} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-red-500 hover:bg-red-50 border border-red-200 shadow-sm"><X className="h-3 w-3" /></button>
                      </div>
                    )}
                    <Label htmlFor="proc-new-photo-dialog" className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                      <ImagePlus className="h-3.5 w-3.5" />
                      {newProcFile ? newProcFile.name : 'Importer une photo'}
                      <input id="proc-new-photo-dialog" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (newProcPreview) URL.revokeObjectURL(newProcPreview); setNewProcFile(f); setNewProcPreview(URL.createObjectURL(f)); setNewProc(p => ({ ...p, image_url: '' })); e.target.value = ''; }} />
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-muted-foreground">ou URL :</span>
                      <Input value={newProc.image_url} onChange={e => { setNewProc(p => ({ ...p, image_url: e.target.value })); if (newProcPreview) URL.revokeObjectURL(newProcPreview); setNewProcFile(null); setNewProcPreview(null); }} placeholder="https://..." className="flex-1 text-xs" disabled={!!newProcFile} />
                    </div>
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
        <DialogContent className="sm:max-w-md relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <DialogHeader><DialogTitle className="text-primary">{editingModele ? 'Modifier le modèle' : 'Créer un modèle'}</DialogTitle></DialogHeader>
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
        <DialogContent className="sm:max-w-2xl relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="relative px-6 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-primary flex items-center gap-2">
                <Layers className="h-5 w-5" /> Composition : {selectedModele?.nom}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex border-t" style={{ minHeight: 300, maxHeight: 420 }}>
            {/* Liste gauche */}
            <div className="w-1/2 border-r overflow-y-auto">
              {modelePieces.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucune pièce.</p>
              ) : modelePieces.map(mp => (
                <button
                  key={mp.id}
                  className={`w-full text-left px-4 py-2.5 border-b transition-colors hover:bg-muted/40 ${selectedCompoPiece?.id === mp.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                  onClick={() => setSelectedCompoPiece(mp)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{mp.piece?.nom}</p>
                      <p className="text-xs text-muted-foreground font-mono">{mp.piece?.reference}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">×{mp.quantite}</Badge>
                      {canManage && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600"
                          onClick={e => { e.stopPropagation(); removePieceModele(mp.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {/* Aperçu droite */}
            <div className="w-1/2 flex flex-col items-center justify-center p-4 bg-muted/10">
              {!selectedCompoPiece ? (
                <div className="text-center text-muted-foreground">
                  <Package className="mx-auto h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Sélectionnez une pièce</p>
                </div>
              ) : (
                <div className="text-center space-y-3 w-full">
                  {selectedCompoPiece.piece?.photo_url ? (
                    <img src={selectedCompoPiece.piece.photo_url} alt={selectedCompoPiece.piece.nom}
                      className="max-h-44 object-contain mx-auto rounded border bg-white p-2" />
                  ) : (
                    <div className="h-32 w-full rounded border bg-muted/30 flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm">{selectedCompoPiece.piece?.nom}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedCompoPiece.piece?.reference}</p>
                    <Badge variant="outline" className="mt-1 text-xs">Qté : {selectedCompoPiece.quantite}</Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
          {canManage && (
            <div className="border-t px-4 py-3 space-y-2 relative">
              <Label className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Ajouter une pièce</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Combobox
                    options={pieces
                      .filter(p => !selectedModele || p.sous_ensemble === selectedModele.sous_ensemble || p.type_terminal === 'tous')
                      .map(p => ({ value: p.id, label: `${p.nom} (${p.reference})` }))}
                    value={addToModele.piece_id}
                    onSelect={(v) => setAddToModele(a => ({ ...a, piece_id: v }))}
                    placeholder="Sélectionner une pièce..."
                    searchPlaceholder="Rechercher par nom ou référence..."
                    emptyText="Aucune pièce trouvée."
                  />
                </div>
                <Input type="number" min={1} className="w-20" value={addToModele.quantite}
                  onChange={e => setAddToModele(a => ({ ...a, quantite: e.target.value }))} />
                <Button size="sm" onClick={addPieceModele}><Plus className="mr-1 h-4 w-4" /> Ajouter</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG STOCK MOUVEMENT ===== */}
      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent className="sm:max-w-md relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <DialogHeader><DialogTitle className="text-primary">Mouvement de stock</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Pièce</Label>
              <div className="col-span-3">
                <Combobox
                  options={pieces.map(p => ({ value: p.id, label: `${p.nom} (${p.reference})` }))}
                  value={stockForm.piece_id}
                  onSelect={(v) => setStockForm(f => ({ ...f, piece_id: v }))}
                  placeholder="Sélectionner..."
                  searchPlaceholder="Rechercher par nom ou référence..."
                  emptyText="Aucune pièce trouvée."
                />
              </div>
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
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileUp className="h-5 w-5 text-primary" /> Importer des pièces depuis CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Instructions */}
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Format attendu (colonnes CSV) :</p>
              <p className="font-mono text-xs">Nom, Référence, Prix unitaire HT, Sous-ensemble, Type terminal, Commentaire</p>
              <p className="text-xs mt-1">Valeurs Sous-ensemble : <span className="font-mono">imprimante | lecteur | ecran | afficheur | buc | carrosserie</span> (ou leur libellé français)</p>
              <p className="text-xs">Valeurs Type terminal : <span className="font-mono">tous | 2020 | 2031</span></p>
              <p className="text-xs">Les anciens fichiers sans colonne prix restent acceptés, avec un prix HT à 0.</p>
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
                        <TableHead>Prix HT</TableHead>
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
                          <TableCell className="text-xs">{formatPrice(r.prix_unitaire_ht)} FCFA</TableCell>
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
