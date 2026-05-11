import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, Edit, Plus, Trash2, Wrench, Zap } from 'lucide-react';

const DEFAULT_FORM = { code: '', libelle: '' };

const CodeTable = ({ title, description, icon, rows, canManage, onAdd, onEdit, onDelete, isLoading }) => (
  <Card className="relative overflow-hidden shadow-lg">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
    <CardHeader className="relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-xl text-primary">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {canManage && (
          <Button onClick={onAdd} disabled={isLoading}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        )}
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <Table>
        <TableCaption>{rows.length === 0 ? 'Aucun code.' : `${rows.length} code(s).`}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Code</TableHead>
            <TableHead>Libellé</TableHead>
            {canManage && <TableHead className="text-right w-24">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id}>
              <TableCell>
                <Badge variant="outline" className="font-mono">{row.code}</Badge>
              </TableCell>
              <TableCell className="text-sm">{row.libelle}</TableCell>
              {canManage && (
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" className="text-blue-500" onClick={() => onEdit(row)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(row)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const CodesMaintenanceTab = ({ canManage = true }) => {
  const { toast } = useToast();
  const [codesPannes, setCodesPannes] = useState([]);
  const [codesInterventions, setCodesInterventions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [dialogState, setDialogState] = useState({ open: false, table: null, editing: null, form: DEFAULT_FORM });

  const showOk = (msg) => toast({ title: msg, className: 'bg-green-500 text-white' });
  const showErr = (msg) => toast({ title: 'Erreur', description: msg, variant: 'destructive' });

  const load = useCallback(async () => {
    setIsLoading(true);
    const [pRes, iRes] = await Promise.all([
      supabase.from('codes_pannes').select('*').order('code'),
      supabase.from('codes_interventions').select('*').order('code'),
    ]);
    if (!pRes.error) setCodesPannes(pRes.data || []);
    if (!iRes.error) setCodesInterventions(iRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = (table) => setDialogState({ open: true, table, editing: null, form: DEFAULT_FORM });
  const openEdit = (table, row) => setDialogState({ open: true, table, editing: row, form: { code: row.code, libelle: row.libelle } });
  const closeDialog = () => setDialogState(s => ({ ...s, open: false }));

  const save = async () => {
    const { table, editing, form } = dialogState;
    if (!form.code.trim() || !form.libelle.trim()) { showErr('Code et libellé requis.'); return; }
    setIsLoading(true);
    const payload = { code: form.code.trim().toUpperCase(), libelle: form.libelle.trim() };
    const { error } = editing
      ? await supabase.from(table).update(payload).eq('id', editing.id)
      : await supabase.from(table).insert(payload);
    if (error) { showErr(error.message); } else {
      showOk(editing ? 'Code modifié.' : 'Code ajouté.');
      closeDialog(); load();
    }
    setIsLoading(false);
  };

  const deleteCode = async (table, row) => {
    if (!window.confirm(`Supprimer le code "${row.code} - ${row.libelle}" ?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) { showErr(error.message); } else { showOk('Code supprimé.'); load(); }
  };

  const tableLabel = dialogState.table === 'codes_pannes' ? 'panne' : 'intervention';

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden shadow-xl glassmorphism">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Wrench className="h-6 w-6" /> Codes de Maintenance
          </CardTitle>
          <CardDescription>
            Gérez les codes pannes et les codes d'intervention utilisés lors des fiches de maintenance.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Votre profil est en lecture seule sur cet espace.
        </div>
      )}

      <CodeTable
        title="Codes Pannes"
        description="Codes utilisés lors des interventions curatives pour qualifier la panne."
        icon={<Zap className="h-5 w-5 text-red-500" />}
        rows={codesPannes}
        canManage={canManage}
        isLoading={isLoading}
        onAdd={() => openAdd('codes_pannes')}
        onEdit={(row) => openEdit('codes_pannes', row)}
        onDelete={(row) => deleteCode('codes_pannes', row)}
      />

      <CodeTable
        title="Codes Interventions"
        description="Codes utilisés lors des interventions préventives pour décrire l'opération effectuée."
        icon={<Wrench className="h-5 w-5 text-blue-500" />}
        rows={codesInterventions}
        canManage={canManage}
        isLoading={isLoading}
        onAdd={() => openAdd('codes_interventions')}
        onEdit={(row) => openEdit('codes_interventions', row)}
        onDelete={(row) => deleteCode('codes_interventions', row)}
      />

      {/* ===== DIALOG ADD / EDIT ===== */}
      <Dialog open={dialogState.open} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState.editing ? `Modifier le code ${tableLabel}` : `Ajouter un code ${tableLabel}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Code *</Label>
              <Input
                className="col-span-3 font-mono uppercase"
                placeholder="Ex: P01"
                value={dialogState.form.code}
                onChange={e => setDialogState(s => ({ ...s, form: { ...s.form, code: e.target.value } }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">Libellé *</Label>
              <Input
                className="col-span-3"
                placeholder="Ex: Bourrage papier"
                value={dialogState.form.libelle}
                onChange={e => setDialogState(s => ({ ...s, form: { ...s.form, libelle: e.target.value } }))}
                onKeyDown={e => e.key === 'Enter' && save()}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={save} disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : dialogState.editing ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CodesMaintenanceTab;
