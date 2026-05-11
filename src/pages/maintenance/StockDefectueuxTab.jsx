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
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import { AlertTriangle, Package, UserCheck, Wrench, CheckCircle2, Search } from 'lucide-react';

const ALL = '__all__';

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

const StockDefectueuxTab = ({ canManage = true }) => {
  const { toast } = useToast();
  const [stock, setStock] = useState([]);
  const [agences, setAgences] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({ type_sous_ensemble: ALL, type_terminal: ALL, statut: ALL });
  const [search, setSearch] = useState('');

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [assignForm, setAssignForm] = useState({ technicien_id: '', technicien_nom: '' });

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [sRes, aRes, tRes] = await Promise.all([
      supabase.from('stock_defectueux').select('*, agence:agences(nom, codePDV)').order('date_entree', { ascending: false }),
      supabase.from('agences').select('id, nom, codePDV').order('nom'),
      supabase.from('techniciens').select('id, nom, matricule').order('nom').limit(200),
    ]);
    if (!sRes.error) setStock(sRes.data || []);
    if (!aRes.error) setAgences(aRes.data || []);
    if (!tRes.error) setTechniciens(tRes.data || []);
    setIsLoading(false);
  }, []);

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
      .filter(s => filters.type_sous_ensemble === ALL || s.type_sous_ensemble === filters.type_sous_ensemble)
      .filter(s => filters.type_terminal === ALL || s.type_terminal === filters.type_terminal)
      .filter(s => filters.statut === ALL || s.statut === filters.statut)
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

  const updateStatut = async (id, statut) => {
    const updates = { statut };
    if (statut === 'repare') updates.date_sortie = new Date().toISOString();
    const { error } = await supabase.from('stock_defectueux').update(updates).eq('id', id);
    if (error) { showErr(error.message); } else { showOk(`Statut mis à jour : ${STATUT_CONFIG[statut]?.label || statut}.`); load(); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  return (
    <div className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Package className="h-6 w-6" /> Stock de Sous-ensembles Défectueux
          </CardTitle>
          <CardDescription>Suivi des sous-ensembles défectueux, assignation aux techniciens et état de réparation.</CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <KpiStatCard icon={<Package />} label="Total" value={kpis.total} tone="primary" helper="Tous les sous-ensembles défectueux." />
        <KpiStatCard icon={<AlertTriangle />} label="Non assignés" value={kpis.defectueux} tone="red" helper="À prendre en charge." />
        <KpiStatCard icon={<UserCheck />} label="Assignés" value={kpis.assigne} tone="primary" helper="En cours de réparation." />
        <KpiStatCard icon={<Wrench />} label="À tester" value={kpis.a_tester} tone="primary" helper="Réparation effectuée, test requis." />
        <KpiStatCard icon={<CheckCircle2 />} label="Réparés" value={kpis.repare} tone="emerald" helper="Disponibles pour réaffectation." />
      </div>

      {/* Filtres */}
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={filters.type_sous_ensemble} onValueChange={v => setFilters(f => ({ ...f, type_sous_ensemble: v }))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les types</SelectItem>
                  {Object.entries(SOUS_ENSEMBLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Terminal</Label>
              <Select value={filters.type_terminal} onValueChange={v => setFilters(f => ({ ...f, type_terminal: v }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous</SelectItem>
                  <SelectItem value="2020">2020</SelectItem>
                  <SelectItem value="2031">2031</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={filters.statut} onValueChange={v => setFilters(f => ({ ...f, statut: v }))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les statuts</SelectItem>
                  {Object.entries(STATUT_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" placeholder="Référence, agence, technicien..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {filtered.length === 0 ? 'Aucun sous-ensemble défectueux.' : `${filtered.length} sous-ensemble(s).`}
            </TableCaption>
            <TableHeader>
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
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setDetailItem(item); setIsDetailOpen(true); }}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Assigner à un technicien
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Sous-ensemble : <span className="font-medium">{selectedItem?.reference_sous_ensemble}</span>
            </p>
            <div className="space-y-1">
              <Label>Technicien</Label>
              {techniciens.length > 0 ? (
                <Select value={assignForm.technicien_id} onValueChange={v => {
                  const tech = techniciens.find(t => String(t.id) === v);
                  setAssignForm({ technicien_id: v, technicien_nom: tech?.nom || '' });
                }}>
                  <SelectTrigger><SelectValue placeholder="Choisir un technicien..." /></SelectTrigger>
                  <SelectContent>
                    {techniciens.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nom}{t.matricule ? ` (${t.matricule})` : ''}
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
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={assignTechnicien} disabled={isLoading}>Assigner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Détail */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail — {detailItem?.reference_sous_ensemble}</DialogTitle>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockDefectueuxTab;
