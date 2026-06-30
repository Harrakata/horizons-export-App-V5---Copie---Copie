import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RefreshCw, Loader2, CheckCircle2, CloudOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getQueued } from '@/lib/offlineQueue';
import { flushQueue } from '@/lib/offlineSync';

const rel = (ts) => { try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: fr }); } catch { return ''; } };
const itemLabel = (i) => i.table || i.type || i.op || 'Opération';

/** Détail de la file de synchro locale + action « Tout synchroniser ». */
const MaSynchroDialog = ({ open, onOpenChange, online }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await getQueued());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    load();
    const onSynced = () => load();
    window.addEventListener('offline-queue-synced', onSynced);
    return () => window.removeEventListener('offline-queue-synced', onSynced);
  }, [open, load]);

  const sync = async () => {
    setSyncing(true);
    try { await flushQueue(); } finally { setSyncing(false); load(); }
  };

  const failed = items.filter((i) => (i.retries || 0) > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CloudOff className="h-5 w-5" /> Ma synchro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className={online ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
              {online ? 'En ligne' : 'Hors ligne'}
            </Badge>
            <span className="text-muted-foreground">{items.length} en attente{failed > 0 ? ` · ${failed} en échec` : ''}</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-1 h-7 w-7 text-emerald-500" /> Tout est synchronisé.
            </div>
          ) : (
            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {items.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-2 p-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium">{itemLabel(i)} <span className="font-normal text-muted-foreground">· {i.op}</span></div>
                    <div className="text-muted-foreground">{rel(i.createdAt)}</div>
                    {i.lastError && <div className="mt-0.5 truncate text-red-600" title={i.lastError}>⚠ {i.lastError}</div>}
                  </div>
                  {(i.retries || 0) > 0 && (
                    <Badge variant="outline" className="shrink-0 border-red-200 bg-red-100 text-red-700">{i.retries} essai(s)</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          {!online && (
            <p className="text-xs text-muted-foreground">Reconnectez-vous pour synchroniser. Vos saisies sont conservées localement.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={sync} disabled={!online || syncing || items.length === 0}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Tout synchroniser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaSynchroDialog;
