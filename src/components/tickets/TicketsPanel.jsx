import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Ticket, Plus, Loader2, Settings2, X, List, LayoutGrid, AlertTriangle, Inbox, CircleDot, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import TicketCreateDialog from '@/components/tickets/TicketCreateDialog';
import TicketProcessDialog from '@/components/tickets/TicketProcessDialog';
import TicketsKanban from '@/components/tickets/TicketsKanban';
import {
  fetchTickets, updateTicket,
  TICKET_STATUSES, TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS,
  ticketLabel, getTicketStatusBadgeClass, getTicketPriorityBadgeClass, ticketOverdue,
} from '@/lib/tickets';

const ALL = '__all__';
const ACTIVE = '__active__';
const ACTIVE_STATUSES = [TICKET_STATUSES.OPEN, TICKET_STATUSES.IN_PROGRESS];

const STATUS_FILTERS = [
  { value: ACTIVE, label: 'Actifs' },
  { value: ALL, label: 'Tous statuts' },
  { value: TICKET_STATUSES.OPEN, label: 'Ouverts' },
  { value: TICKET_STATUSES.IN_PROGRESS, label: 'En cours' },
  { value: TICKET_STATUSES.RESOLVED, label: 'Résolus' },
  { value: TICKET_STATUSES.CLOSED, label: 'Clôturés' },
];

/**
 * Panneau Tickets / Incidents, décliné selon le mode :
 *  - 'declarant'   : guichetière / chef d'agence — créer + suivre ses tickets.
 *  - 'traitement'  : exploitation — file complète, assigner + changer statut.
 *  - 'technicien'  : technicien — tickets qui lui sont assignés, traiter.
 */
const TicketsPanel = ({ mode = 'declarant', identity = {}, filter = {}, spaceKey = 'espace-exploitation', title = 'Tickets / Incidents', description }) => {
  const { toast } = useToast();
  const [allRows, setAllRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState(ACTIVE);
  const [prioriteFilter, setPrioriteFilter] = useState(ALL);
  const [categorieFilter, setCategorieFilter] = useState(ALL);
  const [view, setView] = useState('liste'); // 'liste' | 'kanban'
  const [createOpen, setCreateOpen] = useState(false);
  const [processTicket, setProcessTicket] = useState(null);
  const [actingId, setActingId] = useState(null);

  const filterKey = JSON.stringify(filter);
  const canCreate = mode === 'declarant';
  const canProcess = mode === 'traitement' || mode === 'technicien';

  // On charge TOUT le périmètre (sans filtre de statut) → KPI stables + filtrage client.
  const load = useCallback(async () => {
    setIsLoading(true);
    const { rows, error } = await fetchTickets(filter);
    if (error) toast({ title: 'Erreur de chargement', description: error.message, variant: 'destructive' });
    setAllRows(rows);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, toast]);

  useEffect(() => { load(); }, [load]);

  // ── KPI (sur tout le périmètre) ───────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total: allRows.length,
    ouverts: allRows.filter((r) => r.statut === TICKET_STATUSES.OPEN).length,
    enCours: allRows.filter((r) => r.statut === TICKET_STATUSES.IN_PROGRESS).length,
    resolus: allRows.filter((r) => r.statut === TICKET_STATUSES.RESOLVED).length,
    enRetard: allRows.filter(ticketOverdue).length,
  }), [allRows]);

  // ── Filtrage client (état + priorité + catégorie, combinés) ───────────────────
  const matchesPC = useCallback((r) =>
    (prioriteFilter === ALL || r.priorite === prioriteFilter) &&
    (categorieFilter === ALL || r.categorie === categorieFilter),
    [prioriteFilter, categorieFilter]);

  const listRows = useMemo(() => allRows.filter((r) => {
    const statutOk = statutFilter === ALL ? true
      : statutFilter === ACTIVE ? ACTIVE_STATUSES.includes(r.statut)
      : r.statut === statutFilter;
    return statutOk && matchesPC(r);
  }), [allRows, statutFilter, matchesPC]);

  // Le Kanban montre tous les statuts (colonnes) ; on n'applique que priorité + catégorie.
  const kanbanRows = useMemo(() => allRows.filter(matchesPC), [allRows, matchesPC]);

  const changeStatut = async (id, statut) => {
    const patch = { statut };
    if (statut === TICKET_STATUSES.RESOLVED) patch.resolu_par = identity.nom || null;
    const { error } = await updateTicket(id, patch);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Statut mis à jour', description: ticketLabel(statut) });
    load();
  };

  const cancelTicket = async (row) => {
    setActingId(row.id);
    const { error } = await updateTicket(row.id, { statut: TICKET_STATUSES.CANCELLED });
    setActingId(null);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Ticket annulé' });
    load();
  };

  const displayed = view === 'kanban' ? kanbanRows : listRows;

  return (
    <div className="space-y-4">
      {/* ── Bandeau titre ───────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center text-2xl font-bold text-primary sm:text-3xl">
              <Ticket className="mr-2.5 h-7 w-7 sm:h-8 sm:w-8" /> {title}
            </CardTitle>
            <CardDescription>{description || 'Signalez, suivez et traitez les incidents.'}</CardDescription>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="self-start"><Plus className="h-4 w-4 mr-2" /> Signaler un incident</Button>
          )}
        </CardHeader>
      </Card>

      {/* ── Cartes KPI ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        <KpiStatCard icon={Inbox} label="Total" value={kpis.total} tone="primary" />
        <KpiStatCard icon={CircleDot} label="Ouverts" value={kpis.ouverts} tone="blue" />
        <KpiStatCard icon={Clock} label="En cours" value={kpis.enCours} tone="amber" />
        <KpiStatCard icon={CheckCircle2} label="Résolus" value={kpis.resolus} tone="emerald" />
        <KpiStatCard icon={AlertTriangle} label="En retard" value={kpis.enRetard} tone="red" helper="SLA dépassé" />
      </div>

      {/* ── Barre d'outils : vue + filtres ──────────────────────────────────── */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-md border p-0.5 self-start">
            <Button variant={view === 'liste' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setView('liste')} title="Liste">
              <List className="h-4 w-4" />
            </Button>
            <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setView('kanban')} title="Kanban">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view !== 'kanban' && (
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
            <Select value={prioriteFilter} onValueChange={setPrioriteFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes priorités</SelectItem>
                {TICKET_PRIORITY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={categorieFilter} onValueChange={setCategorieFilter}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes catégories</SelectItem>
                {TICKET_CATEGORY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : displayed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun ticket pour ces critères.</p>
          ) : view === 'kanban' ? (
            <TicketsKanban
              rows={displayed}
              onCardClick={canProcess ? setProcessTicket : undefined}
              onStatusChange={canProcess ? changeStatut : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Agence</TableHead>
                    <TableHead>Statut</TableHead>
                    {mode !== 'technicien' && <TableHead>Assigné à</TableHead>}
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.code || r.id}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={r.titre}>{r.titre}</TableCell>
                      <TableCell>{ticketLabel(r.categorie)}</TableCell>
                      <TableCell><Badge variant="outline" className={getTicketPriorityBadgeClass(r.priorite)}>{ticketLabel(r.priorite)}</Badge></TableCell>
                      <TableCell>{r.agence_nom || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={getTicketStatusBadgeClass(r.statut)}>{ticketLabel(r.statut)}</Badge>
                          {ticketOverdue(r) && (
                            <span className="flex items-center gap-0.5 text-xs text-red-600" title="Délai SLA dépassé"><AlertTriangle className="h-3.5 w-3.5" /> En retard</span>
                          )}
                        </div>
                      </TableCell>
                      {mode !== 'technicien' && <TableCell>{r.assigne_a_nom || '—'}</TableCell>}
                      <TableCell>
                        {canProcess ? (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setProcessTicket(r)}>
                            <Settings2 className="h-4 w-4 mr-1" /> Traiter
                          </Button>
                        ) : r.statut === TICKET_STATUSES.OPEN ? (
                          <Button size="sm" variant="ghost" className="h-8" disabled={actingId === r.id} onClick={() => cancelTicket(r)} title="Annuler">
                            {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.commentaire_resolution ? '✓' : '—'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canCreate && (
        <TicketCreateDialog
          open={createOpen} onOpenChange={setCreateOpen}
          declarant={identity} spaceKey={spaceKey} onCreated={load}
        />
      )}
      {canProcess && (
        <TicketProcessDialog
          open={!!processTicket} onOpenChange={(v) => !v && setProcessTicket(null)}
          ticket={processTicket} mode={mode}
          actor={{ id: identity.id, name: identity.nom, role: identity.role }}
          spaceKey={spaceKey} onSaved={load}
        />
      )}
    </div>
  );
};

export default TicketsPanel;
