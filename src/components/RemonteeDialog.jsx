import React, { useState } from 'react';
import { Send, Loader2, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { sendRemontee } from '@/lib/messaging';
import { triggerPush } from '@/lib/pushNotifications';

const CATEGORIES = [
  { value: 'info', label: 'Information' },
  { value: 'important', label: 'Important' },
  { value: 'urgent', label: 'Urgent' },
];

/**
 * Bouton + dialog pour qu'un agent envoie une remontée à l'exploitation.
 * @param sender { id, role, nom, agence }
 */
const RemonteeDialog = ({ sender = {}, iconOnly = false, className = '' }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const empty = { titre: '', corps: '', categorie: 'info' };
  const [form, setForm] = useState(empty);

  const submit = async () => {
    if (!form.titre.trim()) {
      toast({ title: 'Objet requis', description: 'Indiquez l’objet de votre message.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await sendRemontee({ titre: form.titre, corps: form.corps, categorie: form.categorie, sender });
    setSaving(false);
    if (error) { toast({ title: "Échec de l'envoi", description: error.message, variant: 'destructive' }); return; }
    // Push à l'exploitation (best-effort).
    triggerPush(
      { role: 'exploitation' },
      { title: `Remontée : ${form.titre.trim()}`, body: `${sender.nom || 'Un agent'}${sender.agence ? ` (${sender.agence})` : ''}`, url: '/espace-exploitation/notifications-exploitation' }
    );
    toast({ title: 'Message envoyé', description: "L'exploitation a été notifiée." });
    setForm(empty);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)} title="Contacter l'exploitation">
        <MessageSquarePlus className="h-4 w-4" />
        {!iconOnly && <span className="ml-1.5">Contacter l'exploitation</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contacter l'exploitation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Objet</Label>
                <Input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Ex. Problème terminal agence X" />
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={form.categorie} onValueChange={(v) => setForm((f) => ({ ...f, categorie: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={form.corps} onChange={(e) => setForm((f) => ({ ...f, corps: e.target.value }))} rows={4} placeholder="Décrivez votre demande / signalement…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RemonteeDialog;
