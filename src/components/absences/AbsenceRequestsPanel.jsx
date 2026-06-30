import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarOff, Plus, Loader2, X, List, CalendarDays, Clock, CheckCircle2, XCircle, CalendarRange } from 'lucide-react';
import AbsenceCalendar from '@/components/absences/AbsenceCalendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import KpiStatCard from '@/components/analytics/KpiStatCard';
import {
  fetchAbsences, createAbsence, cancelAbsence,
  ABSENCE_TYPE_OPTIONS, ABSENCE_TYPES, ABSENCE_STATUSES, ABSENCE_CRENEAUX, ABSENCE_CRENEAU_OPTIONS,
  getAbsenceTypeLabel, getAbsenceCreneauLabel, getAbsenceStatusBadgeClass, absenceDaysCount,
} from '@/lib/absences';

const ALL = '__all__';

/**
 * Panneau « Mes demandes d'absence » pour un demandeur (guichetière ou technicien).
 * @param demandeur { role, id, matricule, nom, agence_nom, secteur, region }
 */
const AbsenceRequestsPanel = ({ demandeur }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('liste'); // 'liste' | 'calendrier'
  const [statutFilter, setStatutFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const today = format(new Date(), 'yyyy-MM-dd');
  const emptyForm = { type_absence: ABSENCE_TYPES.CONGE, creneau: ABSENCE_CRENEAUX.JOURNEE, date_debut: today, date_fin: today, motif: '' };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!demandeur?.id) { setRows([]); setIsLoading(false); return; }
    setIsLoading(true);
    const { rows, error } = await fetchAbsences({ demandeur_id: demandeur.id });
    if (error) toast({ title: 'Erreur de chargement', description: error.message, variant: 'destructive' });
    setRows(rows);
    setIsLoading(false);
  }, [demandeur?.id, toast]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.statut === ABSENCE_STATUSES.PENDING).length,
    approved: rows.filter((r) => r.statut === ABSENCE_STATUSES.APPROVED).length,
    refused: rows.filter((r) => r.statut === ABSENCE_STATUSES.REFUSED).length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter((r) =>
    (statutFilter === ALL || r.statut === statutFilter) &&
    (typeFilter === ALL || r.type_absence === typeFilter)
  ), [rows, statutFilter, typeFilter]);

  const openNewRequest = (dateStr) => {
    const d = dateStr || today;
    setForm({ ...emptyForm, date_debut: d, date_fin: d });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (form.date_fin < form.date_debut) {
      toast({ title: 'Dates invalides', description: 'La date de fin précède la date de début.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await createAbsence({
      role_demandeur: demandeur.role,
      demandeur_id: demandeur.id,
      demandeur_matricule: demandeur.matricule || null,
      demandeur_nom: demandeur.nom || null,
      agence_nom: demandeur.agence_nom || null,
      secteur: demandeur.secteur || null,
      region: demandeur.region || null,
      type_absence: form.type_absence,
      creneau: form.creneau,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      motif: form.motif?.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ title: "Échec de l'envoi", description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Demande envoyée', description: 'Votre demande a été transmise pour validation.' });
    setDialogOpen(false);
    setForm(emptyForm);
    load();
  };

  const handleCancel = async (id) => {
    const { error } = await cancelAbsence(id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Demande annulée' });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Bandeau titre */}
      <Card className="relative overflow-hidden border border-primary/20 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center text-2xl font-bold text-primary sm:text-3xl">
              <CalendarOff className="mr-2.5 h-7 w-7 sm:h-8 sm:w-8" /> Mes demandes d'absence
            </CardTitle>
            <CardDescription>Demandez un congé, une absence maladie ou autre — journée ou demi-journée.</CardDescription>
          </div>
          <Button onClick={() => openNewRequest()} className="self-start"><Plus className="h-4 w-4 mr-2" /> Nouvelle demande</Button>
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
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous statuts</SelectItem>
                  {Object.values(ABSENCE_STATUSES).map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous types</SelectItem>
                  {ABSENCE_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : view === 'calendrier' ? (
            <AbsenceCalendar rows={rows} onDayClick={openNewRequest} />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucune demande.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Créneau</TableHead>
                    <TableHead>Du</TableHead>
                    <TableHead>Au</TableHead>
                    <TableHead>Jours</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{getAbsenceTypeLabel(r.type_absence)}</TableCell>
                      <TableCell>{getAbsenceCreneauLabel(r.creneau)}</TableCell>
                      <TableCell>{r.date_debut}</TableCell>
                      <TableCell>{r.date_fin}</TableCell>
                      <TableCell>{absenceDaysCount(r.date_debut, r.date_fin)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.motif || ''}>{r.motif || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getAbsenceStatusBadgeClass(r.statut)}>{r.statut}</Badge>
                        {r.statut === ABSENCE_STATUSES.REFUSED && r.commentaire_traitement && (
                          <p className="text-xs text-red-600 mt-1">{r.commentaire_traitement}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.statut === ABSENCE_STATUSES.PENDING && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(r.id)} title="Annuler">
                            <X className="h-4 w-4" />
                          </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle demande d'absence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type_absence} onValueChange={(v) => setForm((f) => ({ ...f, type_absence: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ABSENCE_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Créneau</Label>
                <Select value={form.creneau} onValueChange={(v) => setForm((f) => ({ ...f, creneau: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ABSENCE_CRENEAU_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Du</Label>
                <Input type="date" value={form.date_debut} max={form.date_fin} onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Au</Label>
                <Input type="date" value={form.date_fin} min={form.date_debut} onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Motif (facultatif)</Label>
              <Textarea value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Précisez si nécessaire…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AbsenceRequestsPanel;
