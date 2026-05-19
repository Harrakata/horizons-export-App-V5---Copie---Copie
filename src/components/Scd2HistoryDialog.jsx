import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { History, CheckCircle2, ArrowRight, Pencil, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Dialog d'historique SCD Type 2 (style timeline).
 *
 * Props:
 *   open, onOpenChange
 *   tableName     — 'agences' | 'chefs_agence'
 *   keyField      — colonne de recherche ('codePDV', 'matricule', …)
 *   keyValue      — valeur de cette colonne
 *   displayFields — [{ key, label, format? }]
 *   headerTitle, headerSubtitle
 *   canEdit       — autorise l'édition des dates + section "Changer l'affectation"
 *   onChange      — callback après modification
 *   changeSection — { fieldLabel, options: [{value, label}], onSave: async (value, date) => void }
 */
const Scd2HistoryDialog = ({
  open,
  onOpenChange,
  tableName,
  keyField,
  keyValue,
  displayFields = [],
  headerTitle = 'Historique des versions',
  headerSubtitle = '',
  canEdit = false,
  onChange,
  changeSection,
}) => {
  const { toast } = useToast();

  // ── État principal ──────────────────────────────────────────────────────────
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loadError, setLoadError]   = useState(null);

  // ── Édition dates inline ────────────────────────────────────────────────────
  const [editingId, setEditingId]       = useState(null);
  const [editingDates, setEditingDates] = useState({ valid_from: '', valid_to: '' });
  const [isSaving, setIsSaving]         = useState(false);

  // ── Section "Changer l'affectation" ────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd');
  const [newAffectation, setNewAffectation]         = useState('');
  const [affectationDate, setAffectationDate]       = useState(today);
  const [isSavingAffectation, setIsSavingAffectation] = useState(false);

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = async (table, field, value) => {
    if (!value) return;
    setLoading(true);
    setLoadError(null);

    let { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(field, value)
      .order('valid_from', { ascending: false });

    // Fallback si valid_from n'existe pas encore
    if (error) {
      const fb = await supabase.from(table).select('*').eq(field, value);
      if (fb.data) { data = fb.data; error = null; }
      else { error = fb.error ?? error; }
    }

    if (error) { setLoadError(error.message); setRows([]); }
    else { setRows(data ?? []); }
    setLoading(false);
  };

  useEffect(() => {
    if (open && keyValue) {
      load(tableName, keyField, keyValue);
    }
    if (!open) {
      setRows([]);
      setLoadError(null);
      setEditingId(null);
      setEditingDates({ valid_from: '', valid_to: '' });
      setNewAffectation('');
      setAffectationDate(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyValue]);

  // ── Utilitaires dates ───────────────────────────────────────────────────────
  const fmtDate = (v) => {
    if (!v) return '—';
    const d = typeof v === 'string' ? parseISO(v) : v;
    return isValidDate(d) ? format(d, 'dd/MM/yyyy', { locale: fr }) : '—';
  };
  const toDateInput = (v) => {
    if (!v) return '';
    const d = typeof v === 'string' ? parseISO(v) : v;
    return isValidDate(d) ? format(d, 'yyyy-MM-dd') : '';
  };

  // ── Édition inline dates ────────────────────────────────────────────────────
  const startEdit = (row) => {
    setEditingId(row.id);
    setEditingDates({ valid_from: toDateInput(row.valid_from), valid_to: toDateInput(row.valid_to) });
  };
  const cancelEdit = () => { setEditingId(null); setEditingDates({ valid_from: '', valid_to: '' }); };

  const saveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    const payload = {
      valid_from: editingDates.valid_from ? new Date(editingDates.valid_from).toISOString() : null,
      valid_to:   editingDates.valid_to   ? new Date(editingDates.valid_to).toISOString()   : null,
    };
    const { error } = await supabase.from(tableName).update(payload).eq('id', editingId);
    setIsSaving(false);
    if (error) {
      toast({ title: 'Erreur sauvegarde', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dates mises à jour', className: 'bg-green-500 text-white' });
      cancelEdit();
      await load(tableName, keyField, keyValue);
      onChange?.();
    }
  };

  // ── Changer l'affectation ───────────────────────────────────────────────────
  const handleSaveAffectation = async () => {
    if (!newAffectation || !changeSection?.onSave) return;
    setIsSavingAffectation(true);
    try {
      await changeSection.onSave(newAffectation, affectationDate);
      setNewAffectation('');
      await load(tableName, keyField, keyValue);
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
    setIsSavingAffectation(false);
  };

  // ── Rendu ───────────────────────────────────────────────────────────────────
  const primaryField    = displayFields[0];
  const secondaryFields = displayFields.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl glassmorphism">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary">
            <History className="h-5 w-5" />
            {headerTitle}
          </DialogTitle>
          {headerSubtitle && <DialogDescription>{headerSubtitle}</DialogDescription>}
        </DialogHeader>

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        <div className="max-h-[45vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : loadError ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">Erreur de chargement</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">{loadError}</p>
                <p className="mt-2 text-xs text-amber-600">Vérifiez que la migration SCD2 a été appliquée dans Supabase.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => load(tableName, keyField, keyValue)} className="gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" /> Réessayer
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune version trouvée.</p>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-0">
              {rows.map((row, i) => {
                const debut    = fmtDate(row.valid_from);
                const fin      = row.valid_to ? fmtDate(row.valid_to) : null;
                const isCurrent = row.is_current === true || row.is_current === undefined;
                const isEditing = editingId === row.id;
                const primaryVal = primaryField
                  ? (primaryField.format ? primaryField.format(row[primaryField.key], row) : row[primaryField.key])
                  : '';

                return (
                  <li key={row.id} className="mb-0 ml-6 py-3 border-b border-border/50 last:border-0">
                    <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      isCurrent ? 'border-primary bg-primary text-white' : 'border-border bg-background text-muted-foreground'
                    }`}>
                      {isCurrent
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : <span className="text-[10px] font-bold">{rows.length - i}</span>}
                    </span>

                    {isEditing ? (
                      <div className="space-y-2">
                        <span className="font-semibold text-sm text-foreground">{primaryVal || '—'}</span>
                        {secondaryFields.length > 0 && (
                          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                            {secondaryFields.map((f) => {
                              const val = f.format ? f.format(row[f.key], row) : row[f.key];
                              if (val == null || val === '') return null;
                              return <span key={f.key}><span className="opacity-70">{f.label} :</span> <span className="font-medium text-foreground">{val}</span></span>;
                            })}
                          </div>
                        )}
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Début *</p>
                            <input type="date" value={editingDates.valid_from}
                              onChange={(e) => setEditingDates(p => ({ ...p, valid_from: e.target.value }))}
                              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground mb-1.5" />
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fin <span className="normal-case">(vide = en cours)</span></p>
                            <input type="date" value={editingDates.valid_to} min={editingDates.valid_from || undefined}
                              onChange={(e) => setEditingDates(p => ({ ...p, valid_to: e.target.value }))}
                              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={saveEdit} disabled={isSaving} className="h-7 gap-1 text-xs">
                            <Save className="h-3 w-3" />{isSaving ? 'Enregistrement…' : 'Sauvegarder'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} disabled={isSaving} className="h-7 text-xs">Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between group/row">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{primaryVal || '—'}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Actuel</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Du {debut}</span>
                            {fin ? (<><ArrowRight className="h-3 w-3 shrink-0" /><span>{fin}</span></>) : (
                              <span className="text-emerald-600">— en cours</span>
                            )}
                          </div>
                          {secondaryFields.length > 0 && (
                            <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                              {secondaryFields.map((f) => {
                                const val = f.format ? f.format(row[f.key], row) : row[f.key];
                                if (val == null || val === '') return null;
                                return <span key={f.key}><span className="opacity-70">{f.label} :</span> <span className="font-medium text-foreground">{val}</span></span>;
                              })}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <button onClick={() => startEdit(row)}
                            className="ml-2 mt-0.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/row:opacity-100"
                            title="Modifier les dates">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* ── Section "Changer l'affectation" ────────────────────────────── */}
        {changeSection && canEdit && (
          <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Changer l'affectation
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{changeSection.fieldLabel}</p>
                <select
                  value={newAffectation}
                  onChange={(e) => setNewAffectation(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sélectionner…</option>
                  {(changeSection.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Date d'effet</p>
                <input
                  type="date"
                  value={affectationDate}
                  onChange={(e) => setAffectationDate(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveAffectation}
              disabled={!newAffectation || !affectationDate || isSavingAffectation}
              className="w-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <ArrowRight className="h-4 w-4" />
              {isSavingAffectation ? 'Enregistrement…' : 'Valider le changement'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Scd2HistoryDialog;
