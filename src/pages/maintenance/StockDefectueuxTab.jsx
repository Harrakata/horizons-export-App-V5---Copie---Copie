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
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { AlertTriangle, Package, UserCheck, Wrench, CheckCircle2, Search } from 'lucide-react';

const ALL = '__all__';

const SOUS_ENSEMBLE_LABELS = {
  imprimante: 'Imprimante',
  lecteur: 'Lecteur',
  ecran: 'Écran',
  afficheur: 'Afficheur client',
  buc: 'BUC',
  carrosserie: 'Carrosserie',
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

const StockDefectueuxTab = ({ canManage = true, technicienId = null }) => {
  const { toast } = useToast();
  const [stock, setStock] = useState([]);
  const [agences, setAgences] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // Filtres multi-select : tableaux de valeurs. Tableau vide = pas de filtre (tout afficher).
  const [filters, setFilters] = useState({ type_sous_ensemble: [], type_terminal: [], statut: [] });
  const [search, setSearch] = useState('');

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [assignForm, setAssignForm] = useState({ technicien_id: '', technicien_nom: '' });

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailMouvements, setDetailMouvements] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    let stockQuery = supabase
      .from('stock_defectueux')
      .select('*, agence:agences(nom, codePDV)')
      .order('date_entree', { ascending: false });

    if (technicienId) {
      stockQuery = stockQuery.eq('technicien_id', String(technicienId));
    }

    const [sRes, aRes, tRes] = await Promise.all([
      stockQuery,
      supabase.from('agences').select('id, nom, codePDV').eq('is_current', true).order('nom'),
      supabase.from('techniciens').select('id, nom, prenom, matricule').order('nom').limit(200),
    ]);
    if (!sRes.error) setStock(sRes.data || []);
    if (!aRes.error) setAgences(aRes.data || []);
    if (!tRes.error) setTechniciens(tRes.data || []);
    setIsLoading(false);
  }, [technicienId]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => ({
    total: stock.length,
    defectueux: stock.filter(s => s.statut === 'defectueux').length,
    assigne: stock.filter(s => s.statut === 'assigne').length,
    a_tester: stock.filter(s => s.statut === 'a_tester').length,
    repare: stock.filter(s => s.statut === 'repare').length,
  }), [stock]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return stock
      .filter(s => filters.type_sous_ensemble.length === 0 || filters.type_sous_ensemble.includes(s.type_sous_ensemble))
      .filter(s => filters.type_terminal.length === 0 || filters.type_terminal.includes(s.type_terminal))
      .filter(s => filters.statut.length === 0 || filters.statut.includes(s.statut))
      .filter(s => !term || [s.reference_sous_ensemble, s.type_sous_ensemble, s.technicien_nom, s.agence?.nom, s.commentaire]
        .some(v => String(v || '').toLowerCase().includes(term)));
  }, [stock, filters, search]);

  const showOk = (msg) => toast({ title: msg, className: 'bg-green-500 text-white' });
  const showErr = (msg) => toast({ title: 'Erreur', description: msg, variant: 'destructive' });

  const assignTechnicien = async () => {
    if (!selectedItem || !assignForm.technicien_id) { showErr('Sélectionnez un technicien.'); return; }
    setIsLoading(true);
    const tech = techniciens.find(t => String(t.id) === String(assignForm.technicien_id));
    const { error } = await supabase.from('stock_defectueux')
      .update({ statut: 'assigne', technicien_id: String(assignForm.technicien_id), technicien_nom: tech?.nom || assignForm.technicien_nom })
      .eq('id', selectedItem.id);
    if (error) { showErr(error.message); } else { showOk('Sous-ensemble assigné.'); setIsAssignOpen(false); load(); }
    setIsLoading(false);
  };

  const EQUIP_TABLE_MAP = {
    imprimante: 'equipments_imprimantes',
    lecteur: 'equipments_lecteurs',
    ecran: 'equipments_ecrans',
    afficheur: 'equipments_afficheurs',
  };

  const updateStatut = async (id, statut) => {
    const updates = { statut };
    if (statut === 'repare') updates.date_sortie = new Date().toISOString();
    const { error } = await supabase.from('stock_defectueux').update(updates).eq('id', id);
    if (error) { showErr(error.message); return; }

    // Quand réparé → remettre le sous-ensemble à Disponible dans sa table équipement
    if (statut === 'repare') {
      const item = stock.find(s => String(s.id) === String(id));
      const table = item?.type_sous_ensemble ? EQUIP_TABLE_MAP[item.type_sous_ensemble] : null;
      if (table && item?.reference_sous_ensemble) {
        const { error: eqErr } = await supabase
          .from(table)
          .update({ statut: 'Disponible' })
          .eq('reference', item.reference_sous_ensemble);
        if (eqErr) console.error('Erreur remise Disponible du sous-ensemble:', eqErr);
      }
    }

    showOk(`Statut mis à jour : ${STATUT_CONFIG[statut]?.label || statut}.`);
    load();
  };

  const openDetail = async (item) => {
    setDetailItem(item);
    setDetailMouvements([]);
    setIsDetailOpen(true);
    setIsLoadingDetail(true);
    const { data } = await supabase
      .from('stock_pieces_mouvements')
      .select('*, piece:pieces_sous_ensembles(nom, reference)')
      .eq('stock_defectueux_id', item.id)
      .order('created_at', { ascending: true });
    setDetailMouvements(data || []);
    setIsLoadingDetail(false);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden shadow-xl glassmorphism">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Package className="h-6 w-6" /> Stock de Sous-ensembles Défectueux
          </CardTitle>
          <CardDescription>Suivi des sous-ensembles défectueux, assignation aux techniciens et état de réparation.</CardDescription>
          {/* KPIs */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5 pt-2">
            <KpiStatCard icon={<Package />} label="Total" value={kpis.total} tone="primary" helper="Tous les sous-ensembles défectueux." />
            <KpiStatCard icon={<AlertTriangle />} label="Non assignés" value={kpis.defectueux} tone="red" helper="À prendre en charge." />
            <KpiStatCard icon={<UserCheck />} label="Assignés" value={kpis.assigne} tone="primary" helper="En cours de réparation." />
            <KpiStatCard icon={<Wrench />} label="À tester" value={kpis.a_tester} tone="primary" helper="Réparation effectuée, test requis." />
            <KpiStatCard icon={<CheckCircle2 />} label="Réparés" value={kpis.repare} tone="emerald" helper="Disponibles pour réaffectation." />
          </div>
          {/* Filtres multi-sélection — libellé intégré, indication active (bordure) */}
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <div className="w-40">
              <Combobox
                multi
                options={[{ value: ALL, label: 'Type' }, ...Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
                value={filters.type_sous_ensemble}
                onSelect={arr => setFilters(f => ({ ...f, type_sous_ensemble: arr }))}
                searchPlaceholder="Rechercher…"
                emptyText="Aucun type."
              />
            </div>
            <div className="w-36">
              <Combobox
                multi
                options={[{ value: ALL, label: 'Terminal' }, { value: '2020', label: '2020' }, { value: '2031', label: '2031' }]}
                value={filters.type_terminal}
                onSelect={arr => setFilters(f => ({ ...f, type_terminal: arr }))}
                searchPlaceholder="Rechercher…"
                emptyText="Aucun."
              />
            </div>
            <div className="w-44">
              <Combobox
                multi
                options={[{ value: ALL, label: 'Statut' }, ...Object.entries(STATUT_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))]}
                value={filters.statut}
                onSelect={arr => setFilters(f => ({ ...f, statut: arr }))}
                searchPlaceholder="Rechercher…"
                emptyText="Aucun statut."
              />
            </div>
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Rechercher : référence, agence, technicien..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table containerClassName="max-h-[60vh]">
            <TableCaption>
              {filtered.length === 0 ? 'Aucun sous-ensemble défectueux.' : `${filtered.length} sous-ensemble(s).`}
            </TableCaption>
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Terminal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Agence provenance</TableHead>
                <TableHead>Date entrée</TableHead>
                <TableHead>Technicien</TableHead>
                <TableHead>Date sortie</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(item)}>
                  <TableCell className="font-medium font-mono">{item.reference_sous_ensemble}</TableCell>
                  <TableCell><Badge variant="outline">{SOUS_ENSEMBLE_LABELS[item.type_sous_ensemble] || item.type_sous_ensemble}</Badge></TableCell>
                  <TableCell>{item.type_terminal || '—'}</TableCell>
                  <TableCell><StatutBadge statut={item.statut} /></TableCell>
                  <TableCell>{item.agence?.nom || '—'}</TableCell>
                  <TableCell>{formatDate(item.date_entree)}</TableCell>
                  <TableCell>{item.technicien_nom || <span className="text-muted-foreground text-xs">Non assigné</span>}</TableCell>
                  <TableCell>{formatDate(item.date_sortie)}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1 flex-wrap">
                      {canManage && item.statut === 'defectueux' && (
                        <Button size="sm" variant="outline" onClick={() => { setSelectedItem(item); setAssignForm({ technicien_id: '', technicien_nom: '' }); setIsAssignOpen(true); }}>
                          Assigner
                        </Button>
                      )}
                      {canManage && item.statut === 'assigne' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatut(item.id, 'a_tester')}>
                          Marquer À tester
                        </Button>
                      )}
                      {canManage && item.statut === 'a_tester' && (
                        <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => updateStatut(item.id, 'repare')}>
                          Marquer Réparé
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Assigner technicien */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-md relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="relative px-6 pb-6 pt-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <UserCheck className="h-5 w-5" />
                Assigner à un technicien
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-primary/20 bg-white/60 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Sous-ensemble concerné</p>
              <p className="font-semibold text-slate-800">
                {selectedItem?.reference_sous_ensemble}
                {selectedItem?.type_sous_ensemble && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — {SOUS_ENSEMBLE_LABELS[selectedItem.type_sous_ensemble] || selectedItem.type_sous_ensemble}
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Technicien *</Label>
              {techniciens.length > 0 ? (
                <Select value={assignForm.technicien_id} onValueChange={v => {
                  const tech = techniciens.find(t => String(t.id) === v);
                  setAssignForm({ technicien_id: v, technicien_nom: `${tech?.prenom || ''} ${tech?.nom || ''}`.trim() });
                }}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Choisir un technicien..." />
                  </SelectTrigger>
                  <SelectContent>
                    {techniciens.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{t.prenom} {t.nom}</span>
                          {t.matricule && <span className="text-xs text-muted-foreground">{t.matricule}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Nom du technicien..."
                  value={assignForm.technicien_nom}
                  onChange={e => setAssignForm(f => ({ ...f, technicien_nom: e.target.value, technicien_id: e.target.value }))}
                />
              )}
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button variant="outline" disabled={isLoading}>Annuler</Button>
              </DialogClose>
              <Button
                onClick={assignTechnicien}
                disabled={isLoading || !assignForm.technicien_id}
                className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              >
                {isLoading ? 'Assignation...' : 'Assigner'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Détail */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="relative px-6 pb-6 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Wrench className="h-5 w-5" />
              Détail — {detailItem?.reference_sous_ensemble}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Type', SOUS_ENSEMBLE_LABELS[detailItem.type_sous_ensemble] || detailItem.type_sous_ensemble],
                  ['Type terminal', detailItem.type_terminal || '—'],
                  ['Statut', <StatutBadge key="s" statut={detailItem.statut} />],
                  ['Agence provenance', detailItem.agence?.nom || '—'],
                  ['Date entrée', formatDate(detailItem.date_entree)],
                  ['Date sortie', formatDate(detailItem.date_sortie)],
                  ['Technicien', detailItem.technicien_nom || 'Non assigné'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-muted-foreground">{k}</p>
                    <p className="font-medium">{v}</p>
                  </div>
                ))}
              </div>
              {detailItem.commentaire && (
                <div>
                  <p className="text-muted-foreground">Commentaire (remplacement)</p>
                  <p className="rounded-md border bg-muted/40 px-3 py-2">{detailItem.commentaire}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground font-medium mb-2">Pièces détachées traitées</p>
                {isLoadingDetail ? (
                  <p className="text-xs text-muted-foreground">Chargement...</p>
                ) : detailMouvements.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucune pièce traitée enregistrée.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailMouvements.map(m => (
                      <div key={m.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-xs">
                        <span className="flex-1 font-medium">{m.piece?.nom || '—'}</span>
                        <span className="font-mono text-muted-foreground">{m.piece?.reference}</span>
                        <Badge className={m.type === 'nettoyage' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                          {m.type === 'nettoyage' ? 'Nettoyée' : 'Remplacée'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex gap-2 pt-2">
                  {detailItem.statut === 'defectueux' && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedItem(detailItem); setIsDetailOpen(false); setIsAssignOpen(true); }}>
                      Assigner technicien
                    </Button>
                  )}
                  {detailItem.statut === 'assigne' && (
                    <Button size="sm" variant="outline" onClick={() => { updateStatut(detailItem.id, 'a_tester'); setIsDetailOpen(false); }}>
                      Marquer À tester
                    </Button>
                  )}
                  {detailItem.statut === 'a_tester' && (
                    <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => { updateStatut(detailItem.id, 'repare'); setIsDetailOpen(false); }}>
                      Marquer Réparé
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockDefectueuxTab;
