import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  updateTicket, fetchTechniciens, createInterventionFromTicket,
  TICKET_STATUSES, ticketLabel, getTicketStatusBadgeClass, getTicketPriorityBadgeClass,
} from '@/lib/tickets';
import { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/lib/auditLog';
import { triggerPush } from '@/lib/pushNotifications';
import { isNotifTypeEnabled } from '@/lib/notificationSettings';

const UNASSIGNED = '__none__';

// Statuts sélectionnables selon le mode.
const STATUS_OPTIONS_TRAITEMENT = [
  TICKET_STATUSES.OPEN, TICKET_STATUSES.IN_PROGRESS, TICKET_STATUSES.RESOLVED,
  TICKET_STATUSES.CLOSED, TICKET_STATUSES.CANCELLED,
];
const STATUS_OPTIONS_TECHNICIEN = [TICKET_STATUSES.IN_PROGRESS, TICKET_STATUSES.RESOLVED];

/**
 * Dialog de traitement d'un ticket.
 * @param mode 'traitement' (exploitation : assigne + statut) | 'technicien' (statut).
 */
const TicketProcessDialog = ({ open, onOpenChange, ticket, mode, actor, spaceKey, onSaved }) => {
  const { toast } = useToast();
  const [techniciens, setTechniciens] = useState([]);
  const [assigneId, setAssigneId] = useState(UNASSIGNED);
  const [statut, setStatut] = useState(TICKET_STATUSES.OPEN);
  const [commentaire, setCommentaire] = useState('');
  const [createInterv, setCreateInterv] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTraitement = mode === 'traitement';
  const statusOptions = isTraitement ? STATUS_OPTIONS_TRAITEMENT : STATUS_OPTIONS_TECHNICIEN;

  useEffect(() => {
    if (!open || !ticket) return;
    setAssigneId(ticket.assigne_a_id ? String(ticket.assigne_a_id) : UNASSIGNED);
    setStatut(ticket.statut || TICKET_STATUSES.OPEN);
    setCommentaire(ticket.commentaire_resolution || '');
    setCreateInterv(false);
    if (isTraitement) fetchTechniciens().then(setTechniciens).catch(() => setTechniciens([]));
  }, [open, ticket, isTraitement]);

  if (!ticket) return null;

  const save = async () => {
    setSaving(true);
    const tech = techniciens.find((t) => String(t.id) === assigneId);
    const fields = {
      statut,
      commentaire_resolution: commentaire?.trim() || null,
    };
    if (isTraitement) {
      fields.assigne_a_id = assigneId === UNASSIGNED ? null : assigneId;
      fields.assigne_a_nom = assigneId === UNASSIGNED ? null : [tech?.prenom, tech?.nom].filter(Boolean).join(' ');
    }
    if (statut === TICKET_STATUSES.RESOLVED) {
      fields.resolu_par = actor?.name || null;
    }

    // Résolution d'un incident terminal → création optionnelle d'une intervention liée.
    let interventionMsg = '';
    if (statut === TICKET_STATUSES.RESOLVED && createInterv && ticket.terminal_id && ticket.terminal_kind !== 'mobi' && !ticket.intervention_id) {
      const { data: interv, error: intervErr } = await createInterventionFromTicket(ticket, {
        technicienId: ticket.assigne_a_id || actor?.id,
        commentaire: commentaire?.trim(),
      });
      if (intervErr) {
        toast({ title: "Intervention non créée", description: intervErr.message, variant: 'destructive' });
      } else if (interv?.id != null) {
        fields.intervention_id = String(interv.id);
        interventionMsg = ` · Intervention #${interv.id} créée`;
      }
    }

    const { error } = await updateTicket(ticket.id, fields);
    setSaving(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Ticket mis à jour', description: interventionMsg ? interventionMsg.replace(/^ · /, '') : undefined });

    // Push au technicien nouvellement (ré)assigné — avec le « sous-ensemble » à réparer
    // (terminal + priorité). Best-effort, respecte le réglage global « Assignation de ticket ».
    const wasAssignedTo = ticket.assigne_a_id ? String(ticket.assigne_a_id) : UNASSIGNED;
    if (isTraitement && assigneId !== UNASSIGNED && assigneId !== wasAssignedTo && isNotifTypeEnabled('ticket_assigne')) {
      const body = [
        ticket.titre,
        ticket.terminal_reference ? `Terminal ${ticket.terminal_reference}` : null,
        ticket.agence_nom || null,
        ticket.priorite ? `Priorité ${ticket.priorite}` : null,
      ].filter(Boolean).join(' · ');
      triggerPush(
        { role: 'technicien', user_id: assigneId },
        { title: `Ticket assigné : ${ticket.code || ticket.titre}`, body, url: '/espace-technicien' },
      );
    }
    logAudit({
      space: spaceKey,
      actorId: actor?.id, actorName: actor?.name, actorRole: actor?.role,
      action: statut === TICKET_STATUSES.RESOLVED ? AUDIT_ACTIONS.VALIDATE : AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.TICKET, entityId: ticket.id, entityLabel: ticket.code || ticket.titre,
      details: { statut, assigne: fields.assigne_a_nom },
    });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{ticket.code || 'Ticket'} — {ticket.titre}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className={getTicketStatusBadgeClass(ticket.statut)}>{ticketLabel(ticket.statut)}</Badge>
            <Badge variant="outline" className={getTicketPriorityBadgeClass(ticket.priorite)}>{ticketLabel(ticket.priorite)}</Badge>
            <Badge variant="outline">{ticketLabel(ticket.categorie)}</Badge>
            {ticket.agence_nom && <span className="text-muted-foreground">Agence : {ticket.agence_nom}</span>}
            {ticket.terminal_reference && <span className="text-muted-foreground">Terminal : {ticket.terminal_reference}</span>}
          </div>
          {ticket.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>}
          <div className="text-xs text-muted-foreground">
            Déclaré par {ticket.createur_nom || '—'}{ticket.assigne_a_nom ? ` · Assigné à ${ticket.assigne_a_nom}` : ''}
          </div>

          {isTraitement && (
            <div className="space-y-1.5">
              <Label>Assigner à un technicien</Label>
              <Select value={assigneId} onValueChange={setAssigneId}>
                <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
                  {techniciens.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{[t.prenom, t.nom].filter(Boolean).join(' ')}{t.matricule ? ` (${t.matricule})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (<SelectItem key={s} value={s}>{ticketLabel(s)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {ticket.intervention_id ? (
            <p className="text-xs text-green-700">Intervention de maintenance liée : #{ticket.intervention_id}</p>
          ) : statut === TICKET_STATUSES.RESOLVED && ticket.terminal_id && ticket.terminal_kind !== 'mobi' ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-input" checked={createInterv} onChange={(e) => setCreateInterv(e.target.checked)} />
              Créer une intervention de maintenance liée (terminal {ticket.terminal_reference || ticket.terminal_id})
            </label>
          ) : null}

          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3} placeholder="Note de traitement / résolution…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fermer</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketProcessDialog;
