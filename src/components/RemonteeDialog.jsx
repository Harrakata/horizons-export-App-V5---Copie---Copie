import React, { useCallback, useEffect, useState } from 'react';
import { Send, Loader2, MessageSquarePlus, Clock, CheckCircle2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { sendRemontee, fetchMyRemontees } from '@/lib/messaging';
import { triggerPush } from '@/lib/pushNotifications';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const CATEGORIES = [
  { value: 'info', label: 'Information' },
  { value: 'important', label: 'Important' },
  { value: 'urgent', label: 'Urgent' },
];

const catLabel = (v) => (CATEGORIES.find((c) => c.value === v) || {}).label || v;
const relTime = (iso) => {
  if (!iso) return '';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }); } catch { return ''; }
};

/**
 * Bouton + dialog pour qu'un agent envoie une remontée à l'exploitation,
 * et consulte l'historique de ses propres remontées (avec leur statut).
 * @param sender { id, role, nom, agence }
 */
const RemonteeDialog = ({ sender = {}, iconOnly = false, className = '' }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const empty = { titre: '', corps: '', categorie: 'info' };
  const [form, setForm] = useState(empty);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Clé stable de l'émetteur pour relancer le chargement quand il change.
  const senderKey = `${sender.nom || ''}|${sender.role || ''}|${sender.agence || ''}`;

  const loadHistory = useCallback(async () => {
    if (!sender.nom) { setHistory([]); return; }
    setLoadingHistory(true);
    const rows = await fetchMyRemontees(sender).catch(() => []);
    setHistory(rows);
    setLoadingHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderKey]);

  // Charge l'historique à l'ouverture du dialog.
  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

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
    loadHistory(); // rafraîchit l'historique avec la nouvelle remontée
  };

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)} title="Contacter l'exploitation">
        <MessageSquarePlus className="h-4 w-4" />
        {!iconOnly && <span className="ml-1.5">Contacter l'exploitation</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
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

            {/* Historique des remontées de l'agent */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <Label className="m-0">Vos précédentes remontées</Label>
                {!loadingHistory && history.length > 0 && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[0.6rem]">{history.length}</Badge>
                )}
              </div>
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-2">
                {loadingHistory ? (
                  <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
                  </div>
                ) : history.length === 0 ? (
                  <p className="py-5 text-center text-xs text-muted-foreground">Aucune remontée envoyée pour l'instant.</p>
                ) : history.map((r) => (
                  <div key={r.id} className="rounded-md border border-border/40 bg-white p-2">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">{r.titre}</span>
                      <Badge variant="outline" className="px-1.5 py-0 text-[0.6rem]">{catLabel(r.categorie)}</Badge>
                      {r.traite ? (
                        <Badge variant="outline" className="border-emerald-200 px-1.5 py-0 text-[0.6rem] text-emerald-600">
                          <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> Traité
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 px-1.5 py-0 text-[0.6rem] text-amber-600">En attente</Badge>
                      )}
                    </div>
                    {r.corps && <p className="line-clamp-2 text-[0.7rem] text-muted-foreground">{r.corps}</p>}
                    <div className="mt-0.5 flex items-center gap-1 text-[0.6rem] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />{relTime(r.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Fermer</Button>
            <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RemonteeDialog;
