import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarCheck, Check, X, Loader2, List, CalendarDays, CalendarRange, Clock, CheckCircle2, XCircle } from 'lucide-react';
import AbsenceCalendar from '@/components/absences/AbsenceCalendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import {
  fetchAbsences, updateAbsenceStatut,
  ABSENCE_STATUSES, getAbsenceTypeLabel, getAbsenceCreneauLabel, getAbsenceStatusBadgeClass, absenceDaysCount,
} from '@/lib/absences';

const ALL = '__all__';
const STATUS_FILTERS = [
  { value: ABSENCE_STATUSES.PENDING, label: 'En attente' },
  { value: ALL, label: 'Toutes' },
  { value: ABSENCE_STATUSES.APPROVED, label: 'Approuvées' },
  { value: ABSENCE_STATUSES.REFUSED, label: 'Refusées' },
  { value: ABSENCE_STATUSES.CANCELLED, label: 'Annulées' },
];

/**
 * Panneau de validation des demandes d'absence (chef d'agence / chef de secteur / exploitation).
 * @param filter   égalités appliquées au fetch (ex. { role_demandeur, agence_nom }).
 * @param approver { name, role } — pour la traçabilité du traitement.
 */
const AbsenceApprovalPanel = ({ filter = {}, approver = {}, title = "Demandes d'absence", description = 'Validez ou refusez les demandes de votre périmètre.' }) => {
  const { toast } = useToast();
  const [allRows, setAllRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState(ABSENCE_STATUSES.PENDING);
  const [view, setView] = useState('liste'); // 'liste' | 'calendrier'
  const [actingId, setActingId] = useState(null);
  const [comments, setComments] = useState({});

  const filterKey = JSON.stringify(filter);

  // On charge tout le périmètre (sans filtre statut) → KPI stables + filtrage client.
  const load = useCallback(async () => {
    setIsLoading(true);
    const { rows, error } = await fetchAbsences(filter);
    if (error) toast({ title: 'Erreur de chargement', description: error.message, variant: 'destructive' });
    setAllRows(rows);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, toast]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => ({
    total: allRows.length,
    pending: allRows.filter((r) => r.statut === ABSENCE_STATUSES.PENDING).length,
    approved: allRows.filter((r) => r.statut === ABSENCE_STATUSES.APPROVED).length,
    refused: allRows.filter((r) => r.statut === ABSENCE_STATUSES.REFUSED).length,
  }), [allRows]);

  const rows = useMemo(
    () => (statutFilter === ALL ? allRows : allRows.filter((r) => r.statut === statutFilter)),
    [allRows, statutFilter]
  );

  const act = async (row, statut) => {
    setActingId(row.id);
    const { error } = await updateAbsenceStatut(row.id, {
      statut,
      commentaire: comments[row.id]?.trim() || null,
      traitee_par: approver.name || null,
      traitee_par_role: approver.role || null,
    });
    setActingId(null);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: statut === ABSENCE_STATUSES.APPROVED ? 'Demande approuvée' : 'Demande refusée' });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Bandeau titre */}
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold text-primary sm:text-3xl">
            <CalendarCheck className="mr-2.5 h-7 w-7 sm:h-8 sm:w-8" /> {title}
            {kpis.pending > 0 && <Badge className="ml-3 bg-amber-100 text-amber-700 border-amber-200" variant="outline">{kpis.pending} à traiter</Badge>}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiStatCard icon={CalendarRange} label="Total" value={kpis.total} tone="primary" />
        <KpiStatCard icon={Clock} label="En attente" value={kpis.pending} tone="amber" />
        <KpiStatCard icon={CheckCircle2} label="Approuvées" value={kpis.approved} tone="emerald" />
        <KpiStatCard icon={XCircle} label="Refusées" value={kpis.refused} tone="red" />
      </div>

      {/* Outils + contenu */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-md border p-0.5 self-start">
            <Button variant={view === 'liste' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setView('liste')} title="Liste">
              <List className="h-4 w-4" />
            </Button>
            <Button variant={view === 'calendrier' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setView('calendrier')} title="Calendrier">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          {view !== 'calendrier' && (
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : view === 'calendrier' ? (
            <AbsenceCalendar rows={allRows} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucune demande.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Demandeur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Créneau</TableHead>
                    <TableHead>Du</TableHead>
                    <TableHead>Au</TableHead>
                    <TableHead>Jours</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const isPending = r.statut === ABSENCE_STATUSES.PENDING;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.demandeur_nom || '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.demandeur_matricule || ''}</div>
                        </TableCell>
                        <TableCell>{getAbsenceTypeLabel(r.type_absence)}</TableCell>
                        <TableCell>{getAbsenceCreneauLabel(r.creneau)}</TableCell>
                        <TableCell>{r.date_debut}</TableCell>
                        <TableCell>{r.date_fin}</TableCell>
                        <TableCell>{absenceDaysCount(r.date_debut, r.date_fin)}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={r.motif || ''}>{r.motif || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={getAbsenceStatusBadgeClass(r.statut)}>{r.statut}</Badge></TableCell>
                        <TableCell>
                          {isPending ? (
                            <div className="flex flex-col gap-1.5 min-w-[200px]">
                              <Input
                                placeholder="Commentaire (optionnel)"
                                value={comments[r.id] || ''}
                                onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                                className="h-8 text-xs"
                              />
                              <div className="flex gap-1.5">
                                <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" disabled={actingId === r.id} onClick={() => act(r, ABSENCE_STATUSES.APPROVED)}>
                                  {actingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approuver
                                </Button>
                                <Button size="sm" variant="destructive" className="h-7" disabled={actingId === r.id} onClick={() => act(r, ABSENCE_STATUSES.REFUSED)}>
                                  <X className="h-3.5 w-3.5" /> Refuser
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.traitee_par ? `par ${r.traitee_par}` : '—'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AbsenceApprovalPanel;
