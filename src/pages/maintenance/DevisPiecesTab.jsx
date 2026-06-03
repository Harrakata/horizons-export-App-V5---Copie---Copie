import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertTriangle,
  CalendarClock,
  Calculator,
  Download,
  FileText,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

const PERIOD_OPTIONS = [
  { value: '1', label: '1 mois' },
  { value: '3', label: '3 mois' },
  { value: '6', label: '6 mois' },
];

const SOUS_ENSEMBLE_LABELS = {
  imprimante: 'Imprimante',
  lecteur: 'Lecteur',
  ecran: 'Écran',
  afficheur: 'Afficheur client',
  buc: 'BUC',
  carrosserie: 'Carrosserie',
};

const moneyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('fr-FR');

const formatMoney = (value) => moneyFormatter.format(Number(value) || 0);
const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '-');
const formatTerminalType = (value) => (value === 'tous' ? 'Tous' : value || '-');

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const sanitizeFileName = (value) => String(value || 'devis-pieces')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9-_]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const makeExtraId = () => `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DevisPiecesTab = () => {
  const { toast } = useToast();
  const [periodMonths, setPeriodMonths] = useState('1');
  const [movements, setMovements] = useState([]);
  const [catalogPieces, setCatalogPieces] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quoteNumber] = useState(() => `DP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const [quoteMeta, setQuoteMeta] = useState({
    destinataire: '',
    objet: 'Devis des pièces consommées',
    validite: '30 jours',
    notes: '',
  });
  const [extraFields, setExtraFields] = useState([
    { id: makeExtraId(), libelle: 'Frais de transport', montant_ht: 0 },
  ]);

  const periodBounds = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - Number(periodMonths));
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [periodMonths]);

  const showErr = useCallback((description) => {
    toast({ title: 'Erreur', description, variant: 'destructive' });
  }, [toast]);

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    const [movementsRes, catalogRes] = await Promise.all([
      supabase
        .from('stock_pieces_mouvements')
        .select('id, piece_id, type, quantite, motif, created_at, piece:pieces_sous_ensembles(id, nom, reference, prix_unitaire_ht)')
        .eq('type', 'sortie')
        .gt('quantite', 0)
        .gte('created_at', periodBounds.start.toISOString())
        .lte('created_at', periodBounds.end.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('pieces_sous_ensembles')
        .select('id, nom, reference, prix_unitaire_ht, sous_ensemble, type_terminal, commentaire')
        .order('nom', { ascending: true }),
    ]);

    if (movementsRes.error) {
      showErr(movementsRes.error.message);
      setMovements([]);
    } else {
      setMovements(movementsRes.data || []);
    }

    if (catalogRes.error) {
      showErr(catalogRes.error.message);
      setCatalogPieces([]);
    } else {
      setCatalogPieces(catalogRes.data || []);
    }
    setIsLoading(false);
  }, [periodBounds.end, periodBounds.start, showErr]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const quoteLines = useMemo(() => {
    const grouped = new Map();
    movements.forEach((movement) => {
      const piece = movement.piece || {};
      const key = movement.piece_id || `movement-${movement.id}`;
      const quantity = Number(movement.quantite) || 0;
      const unitPrice = Number(piece.prix_unitaire_ht) || 0;
      const current = grouped.get(key) || {
        piece_id: movement.piece_id,
        nom: piece.nom || 'Pièce non renseignée',
        reference: piece.reference || '-',
        quantite: 0,
        prix_unitaire_ht: unitPrice,
        mouvements: 0,
      };
      current.quantite += quantity;
      current.mouvements += 1;
      current.prix_unitaire_ht = unitPrice;
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((line) => ({ ...line, montant_ht: line.quantite * line.prix_unitaire_ht }))
      .sort((first, second) => first.nom.localeCompare(second.nom, 'fr'));
  }, [movements]);

  const filteredCatalogPieces = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    if (!term) return catalogPieces;
    return catalogPieces.filter((piece) => [
      piece.nom,
      piece.reference,
      SOUS_ENSEMBLE_LABELS[piece.sous_ensemble] || piece.sous_ensemble,
      formatTerminalType(piece.type_terminal),
      piece.commentaire,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [catalogPieces, catalogSearch]);

  const extraLines = useMemo(() => extraFields
    .map((field) => ({
      ...field,
      libelle: field.libelle.trim(),
      montant_ht: Number(field.montant_ht) || 0,
    }))
    .filter((field) => field.libelle || field.montant_ht > 0), [extraFields]);

  const totalPiecesHt = useMemo(() => quoteLines.reduce((sum, line) => sum + line.montant_ht, 0), [quoteLines]);
  const totalExtrasHt = useMemo(() => extraLines.reduce((sum, line) => sum + line.montant_ht, 0), [extraLines]);
  const totalHt = totalPiecesHt + totalExtrasHt;
  const totalQuantity = useMemo(() => quoteLines.reduce((sum, line) => sum + line.quantite, 0), [quoteLines]);
  const hasMissingPrices = quoteLines.some((line) => line.prix_unitaire_ht <= 0);

  const addExtraField = () => {
    setExtraFields((current) => [...current, { id: makeExtraId(), libelle: '', montant_ht: 0 }]);
  };

  const updateExtraField = (id, key, value) => {
    setExtraFields((current) => current.map((field) => (
      field.id === id ? { ...field, [key]: value } : field
    )));
  };

  const removeExtraField = (id) => {
    setExtraFields((current) => current.filter((field) => field.id !== id));
  };

  const buildQuoteHtml = () => {
    const pieceRows = quoteLines.length
      ? quoteLines.map((line) => `
          <tr>
            <td>${escapeHtml(line.reference)}</td>
            <td>${escapeHtml(line.nom)}</td>
            <td class="right">${line.quantite}</td>
            <td class="right">${escapeHtml(formatMoney(line.prix_unitaire_ht))}</td>
            <td class="right">${escapeHtml(formatMoney(line.montant_ht))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="empty">Aucune pièce consommée sur cette période.</td></tr>';

    const extraRows = extraLines.map((line) => `
      <tr>
        <td>Frais</td>
        <td>${escapeHtml(line.libelle || 'Champ complémentaire')}</td>
        <td class="right">1</td>
        <td class="right">${escapeHtml(formatMoney(line.montant_ht))}</td>
        <td class="right">${escapeHtml(formatMoney(line.montant_ht))}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(quoteNumber)} - ${escapeHtml(quoteMeta.objet)}</title>
  <style>
    @page { margin: 18mm; }
    body { color: #111827; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; margin: 0; }
    h1 { color: #2563eb; font-size: 24px; margin: 0 0 6px; }
    h2 { font-size: 13px; letter-spacing: .08em; margin: 22px 0 8px; text-transform: uppercase; color: #6b7280; }
    .header { align-items: flex-start; border-bottom: 2px solid #2563eb; display: flex; justify-content: space-between; padding-bottom: 18px; }
    .meta { color: #4b5563; text-align: right; }
    .box { border: 1px solid #dbeafe; border-radius: 8px; margin-top: 16px; padding: 12px; }
    table { border-collapse: collapse; margin-top: 10px; width: 100%; }
    th { background: #eff6ff; color: #374151; font-size: 11px; letter-spacing: .06em; padding: 9px; text-align: left; text-transform: uppercase; }
    td { border-bottom: 1px solid #e5e7eb; padding: 9px; vertical-align: top; }
    .right { text-align: right; white-space: nowrap; }
    .empty { color: #6b7280; text-align: center; }
    .totals { margin-left: auto; margin-top: 16px; width: 320px; }
    .totals td { border-bottom: 0; padding: 6px 0; }
    .grand-total { color: #2563eb; font-size: 16px; font-weight: 700; }
    .notes { white-space: pre-wrap; }
    .muted { color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Devis pièces</h1>
      <div class="muted">${escapeHtml(quoteMeta.objet || 'Devis des pièces consommées')}</div>
    </div>
    <div class="meta">
      <strong>${escapeHtml(quoteNumber)}</strong><br />
      Date : ${escapeHtml(formatDate(new Date()))}<br />
      Validité : ${escapeHtml(quoteMeta.validite || '-')}
    </div>
  </div>

  <div class="box">
    <strong>Période :</strong> ${escapeHtml(formatDate(periodBounds.start))} au ${escapeHtml(formatDate(periodBounds.end))}<br />
    <strong>Destinataire :</strong> ${escapeHtml(quoteMeta.destinataire || '-')}
  </div>

  <h2>Pièces consommées</h2>
  <table>
    <thead>
      <tr>
        <th>Référence</th>
        <th>Désignation</th>
        <th class="right">Qté</th>
        <th class="right">Prix unitaire HT (€)</th>
        <th class="right">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${pieceRows}
      ${extraRows}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Total pièces HT</td><td class="right">${escapeHtml(formatMoney(totalPiecesHt))}</td></tr>
    <tr><td>Champs complémentaires HT (€)</td><td class="right">${escapeHtml(formatMoney(totalExtrasHt))}</td></tr>
    <tr class="grand-total"><td>Total HT</td><td class="right">${escapeHtml(formatMoney(totalHt))}</td></tr>
  </table>

  ${quoteMeta.notes ? `<h2>Notes</h2><div class="notes">${escapeHtml(quoteMeta.notes)}</div>` : ''}
</body>
</html>`;
  };

  const printQuote = () => {
    const printFrame = document.createElement('iframe');
    printFrame.title = 'Impression devis pièces';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';

    document.body.appendChild(printFrame);

    const printWindow = printFrame.contentWindow;
    const printDocument = printFrame.contentDocument || printWindow?.document;

    if (!printWindow || !printDocument) {
      printFrame.remove();
      showErr("Impossible de préparer l'impression.");
      return;
    }

    const cleanup = () => {
      setTimeout(() => printFrame.remove(), 500);
    };

    printWindow.onafterprint = cleanup;
    printDocument.open();
    printDocument.write(buildQuoteHtml());
    printDocument.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(cleanup, 1500);
    }, 100);
  };

  const downloadWordQuote = () => {
    const blob = new Blob(['\ufeff', buildQuoteHtml()], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(quoteNumber)}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden shadow-xl glassmorphism">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
                <Receipt className="h-6 w-6" /> Devis pièces
              </CardTitle>
              <CardDescription>
                Devis basé sur les pièces sorties du stock de maintenance sur la période sélectionnée.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadMovements} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Actualiser
              </Button>
              <Button variant="outline" onClick={downloadWordQuote}>
                <Download className="mr-2 h-4 w-4" /> Word
              </Button>
              <Button onClick={printQuote}>
                <Printer className="mr-2 h-4 w-4" /> Imprimer / PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-primary" /> Période
            </div>
            <p className="mt-2 text-lg font-semibold">{PERIOD_OPTIONS.find((p) => p.value === periodMonths)?.label}</p>
            <p className="text-xs text-muted-foreground">{formatDate(periodBounds.start)} au {formatDate(periodBounds.end)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-primary" /> Sorties
            </div>
            <p className="mt-2 text-lg font-semibold">{movements.length}</p>
            <p className="text-xs text-muted-foreground">{totalQuantity} pièce(s) consommée(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calculator className="h-4 w-4 text-primary" /> Pièces HT
            </div>
            <p className="mt-2 text-lg font-semibold text-primary">{formatMoney(totalPiecesHt)}</p>
            <p className="text-xs text-muted-foreground">{quoteLines.length} référence(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4 text-primary" /> Total devis HT
            </div>
            <p className="mt-2 text-lg font-semibold text-primary">{formatMoney(totalHt)}</p>
            <p className="text-xs text-muted-foreground">Hors TVA</p>
          </CardContent>
        </Card>
      </div>

      {hasMissingPrices && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Certaines pièces ont un prix HT à 0. Renseignez le prix en euros dans le catalogue pour fiabiliser le devis.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Paramètres du devis</CardTitle>
            <CardDescription>Période, destinataire et lignes complémentaires.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Période</Label>
              <Select value={periodMonths} onValueChange={setPeriodMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Destinataire</Label>
              <Input value={quoteMeta.destinataire} onChange={(e) => setQuoteMeta((m) => ({ ...m, destinataire: e.target.value }))} placeholder="Client, agence ou direction" />
            </div>
            <div className="grid gap-2">
              <Label>Objet</Label>
              <Input value={quoteMeta.objet} onChange={(e) => setQuoteMeta((m) => ({ ...m, objet: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Validité</Label>
              <Input value={quoteMeta.validite} onChange={(e) => setQuoteMeta((m) => ({ ...m, validite: e.target.value }))} placeholder="30 jours" />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={quoteMeta.notes} onChange={(e) => setQuoteMeta((m) => ({ ...m, notes: e.target.value }))} placeholder="Conditions, remarques..." />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Champs complémentaires HT (€)</Label>
                <Button variant="outline" size="sm" onClick={addExtraField}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
              </div>
              {extraFields.map((field) => (
                <div key={field.id} className="grid grid-cols-[1fr_120px_32px] items-center gap-2">
                  <Input value={field.libelle} onChange={(e) => updateExtraField(field.id, 'libelle', e.target.value)} placeholder="Frais de transport" />
                  <Input type="number" min={0} step="0.01" value={field.montant_ht} onChange={(e) => updateExtraField(field.id, 'montant_ht', e.target.value)} placeholder="0,00" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeExtraField(field.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-primary">Pièces consommées</CardTitle>
                <CardDescription>Sorties de stock regroupées par référence.</CardDescription>
              </div>
              <Badge variant="outline">{quoteNumber}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableCaption>{isLoading ? 'Chargement...' : `${quoteLines.length} référence(s) sur ${movements.length} mouvement(s).`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Pièce</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">Prix HT (€)</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Aucune pièce consommée sur cette période.
                    </TableCell>
                  </TableRow>
                ) : quoteLines.map((line) => (
                  <TableRow key={line.piece_id || `${line.reference}-${line.nom}`}>
                    <TableCell className="font-medium">{line.nom}</TableCell>
                    <TableCell className="font-mono text-sm">{line.reference}</TableCell>
                    <TableCell className="text-right">{line.quantite}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.prix_unitaire_ht)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(line.montant_ht)}</TableCell>
                  </TableRow>
                ))}
                {extraLines.map((line) => (
                  <TableRow key={line.id} className="bg-primary/5">
                    <TableCell className="font-medium">{line.libelle || 'Champ complémentaire'}</TableCell>
                    <TableCell className="text-muted-foreground">Frais</TableCell>
                    <TableCell className="text-right">1</TableCell>
                    <TableCell className="text-right">{formatMoney(line.montant_ht)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(line.montant_ht)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-semibold">Total HT</TableCell>
                  <TableCell className="text-right text-lg font-bold text-primary">{formatMoney(totalHt)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg text-primary">Catalogue des pièces</CardTitle>
              <CardDescription>Catalogue complet utilisé pour les prix unitaires HT du devis.</CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Rechercher une pièce..."
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-auto">
            <Table className="min-w-[900px]">
              <TableCaption>
                {isLoading ? 'Chargement...' : `${filteredCatalogPieces.length} pièce(s) affichée(s) sur ${catalogPieces.length}.`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-background">Pièce</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background">Référence</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-right">Prix unitaire HT (€)</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background">Sous-ensemble</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background">Type terminal</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background">Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCatalogPieces.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Aucune pièce dans le catalogue.
                    </TableCell>
                  </TableRow>
                ) : filteredCatalogPieces.map((piece) => (
                  <TableRow key={piece.id}>
                    <TableCell className="font-medium">{piece.nom || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{piece.reference || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(piece.prix_unitaire_ht)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{SOUS_ENSEMBLE_LABELS[piece.sous_ensemble] || piece.sous_ensemble || '-'}</Badge>
                    </TableCell>
                    <TableCell>{formatTerminalType(piece.type_terminal)}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{piece.commentaire || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevisPiecesTab;
