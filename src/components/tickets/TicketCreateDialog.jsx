import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  createTicket, fetchTicketTerminals, categoryTerminalKind,
  TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, TICKET_CATEGORIES, TICKET_PRIORITIES,
} from '@/lib/tickets';
import { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/lib/auditLog';

const NO_TERMINAL = '__none__';

/** Dialog de déclaration d'un ticket par un déclarant (guichetière / chef d'agence). */
const TicketCreateDialog = ({ open, onOpenChange, declarant, spaceKey, onCreated }) => {
  const { toast } = useToast();
  const [terminaux, setTerminaux] = useState([]);
  const [saving, setSaving] = useState(false);
  const empty = {
    titre: '', description: '', categorie: TICKET_CATEGORIES.TERMINAL,
    priorite: TICKET_PRIORITIES.NORMALE, terminal_id: NO_TERMINAL,
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open && declarant?.agence_nom) {
      fetchTicketTerminals(declarant.agence_nom).then(setTerminaux).catch(() => setTerminaux([]));
    }
  }, [open, declarant?.agence_nom]);

  // Cascade : la catégorie détermine le type de terminal proposé (fixe / mobi).
  const expectedKind = categoryTerminalKind(form.categorie); // 'fixe' | 'mobi' | null
  const terminalOptions = expectedKind ? terminaux.filter((t) => t.kind === expectedKind) : [];

  // Réinitialise le terminal quand la catégorie change (cascade).
  const setCategorie = (categorie) => setForm((f) => ({ ...f, categorie, terminal_id: NO_TERMINAL }));

  const submit = async () => {
    if (!form.titre.trim()) {
      toast({ title: 'Titre requis', description: 'Indiquez un résumé du problème.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const terminal = expectedKind ? terminalOptions.find((t) => String(t.id) === form.terminal_id) : null;
    const { data, error } = await createTicket({
      titre: form.titre.trim(),
      description: form.description?.trim() || null,
      categorie: form.categorie,
      priorite: form.priorite,
      agence_nom: declarant.agence_nom || null,
      terminal_id: terminal?.id || null,
      terminal_reference: terminal?.reference || null,
      terminal_kind: terminal ? expectedKind : null,
      createur_role: declarant.role || null,
      createur_id: declarant.id || null,
      createur_nom: declarant.nom || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Échec de la création', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ticket créé', description: data?.code ? `Référence ${data.code}.` : 'Incident signalé.' });
    logAudit({
      space: spaceKey,
      actorId: declarant.id, actorName: declarant.nom, actorRole: declarant.role,
      action: AUDIT_ACTIONS.CREATE, entity: AUDIT_ENTITIES.TICKET,
      entityId: data?.id, entityLabel: data?.code || form.titre,
      details: { categorie: form.categorie, priorite: form.priorite, agence: declarant.agence_nom },
    });
    setForm(empty);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Signaler un incident</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Ex. Terminal ne s'allume plus" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.categorie} onValueChange={setCategorie}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={form.priorite} onValueChange={(v) => setForm((f) => ({ ...f, priorite: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {expectedKind && (
            <div className="space-y-1.5">
              <Label>{expectedKind === 'mobi' ? 'Terminal Mobi concerné (optionnel)' : 'Terminal concerné (optionnel)'}</Label>
              <Select value={form.terminal_id} onValueChange={(v) => setForm((f) => ({ ...f, terminal_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TERMINAL}>Aucun</SelectItem>
                  {terminalOptions.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.reference}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {terminalOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun terminal {expectedKind === 'mobi' ? 'Mobi' : 'fixe'} rattaché à cette agence.</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description (facultatif)</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Détaillez le problème…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketCreateDialog;
