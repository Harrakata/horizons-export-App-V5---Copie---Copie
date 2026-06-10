import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Wrench, Wallet, Smartphone, CheckCircle2, AlertTriangle, Users, Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabaseClient';
import KpiStatCard from '@/components/analytics/KpiStatCard';

/**
 * Charge les agences (nom + id) rattachées au secteur du chef.
 */
function useSecteurAgences(secteurName) {
  const [agences, setAgences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('agences').select('id, nom, codePDV, region').eq('is_current', true).eq('secteur', secteurName);
        if (!cancelled) setAgences(data || []);
      } catch {
        if (!cancelled) setAgences([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [secteurName]);

  const names = useMemo(() => agences.map((a) => a.nom).filter(Boolean), [agences]);
  const ids = useMemo(() => agences.map((a) => a.id).filter(Boolean), [agences]);
  return { agences, names, ids, isLoading };
}

const SectionShell = ({ icon: Icon, title, secteurName, children }) => (
  <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-2xl text-primary"><Icon className="h-6 w-6" /> {title}</CardTitle>
      <CardDescription>Secteur : <span className="font-semibold">{secteurName || '—'}</span></CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const EmptyAgences = () => (
  <p className="py-8 text-center text-sm text-muted-foreground">Aucune agence rattachée à ce secteur. Affectez des agences au secteur dans Exploitation.</p>
);

const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return String(d); }
};

// ── Pointages ───────────────────────────────────────────────
export const PointagesSecteurSection = ({ chef }) => {
  const { names, isLoading: agLoading } = useSecteurAgences(chef.secteurEnCharge);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (agLoading) return;
      if (names.length === 0) { setRows([]); setIsLoading(false); return; }
      setIsLoading(true);
      const since = new Date(); since.setDate(since.getDate() - 7);
      const sinceIso = since.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('pointages').select('*').in('agence', names).gte('date', sinceIso).not('geo_refused', 'is', true).order('date', { ascending: false }).limit(300);
      if (!cancelled) { setRows(data || []); setIsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [names, agLoading]);

  const distinctGuichetieres = useMemo(() => new Set(rows.map((r) => r.guichetiereMatricule).filter(Boolean)).size, [rows]);
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => String(r.date).slice(0, 10) === today).length;
  }, [rows]);

  return (
    <SectionShell icon={ClipboardCheck} title="Pointages du secteur" secteurName={chef.secteurEnCharge}>
      {agLoading ? <p className="py-8 text-center text-muted-foreground">Chargement…</p> : names.length === 0 ? <EmptyAgences /> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
            <KpiStatCard icon={ClipboardCheck} label="Pointages (7 j)" value={rows.length} tone="primary" />
            <KpiStatCard icon={Clock} label="Aujourd'hui" value={todayCount} tone="emerald" />
            <KpiStatCard icon={Users} label="Guichetières actives" value={distinctGuichetieres} tone="blue" />
          </div>
          {isLoading ? <p className="py-6 text-center text-muted-foreground">Chargement…</p> : (
            <Table className="responsive-cards">
              <TableCaption>{rows.length === 0 ? 'Aucun pointage sur les 7 derniers jours.' : `${rows.length} pointage(s) — 7 derniers jours.`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Heure</TableHead><TableHead>Matricule</TableHead><TableHead>Type</TableHead><TableHead>Agence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 100).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="Date">{formatDate(r.date)}</TableCell>
                    <TableCell data-label="Heure">{r.time || '—'}</TableCell>
                    <TableCell data-label="Matricule">{r.guichetiereMatricule || '—'}</TableCell>
                    <TableCell data-label="Type">{r.type || '—'}</TableCell>
                    <TableCell data-label="Agence">{r.agence || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </SectionShell>
  );
};

// ── Maintenance ─────────────────────────────────────────────
export const MaintenanceSecteurSection = ({ chef }) => {
  const { agences, ids, isLoading: agLoading } = useSecteurAgences(chef.secteurEnCharge);
  const [terminaux, setTerminaux] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (agLoading) return;
      if (ids.length === 0) { setTerminaux([]); setIsLoading(false); return; }
      setIsLoading(true);
      const { data } = await supabase
        .from('terminaux').select('id, reference, type_terminal, position, statut, agence_id').in('agence_id', ids);
      if (!cancelled) { setTerminaux(data || []); setIsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ids, agLoading]);

  const agenceName = useMemo(() => Object.fromEntries(agences.map((a) => [a.id, a.nom])), [agences]);
  const enService = terminaux.filter((t) => t.statut === 'En service').length;
  const horsService = terminaux.filter((t) => ['Hors service', 'En panne'].includes(t.statut)).length;
  const maintenance = terminaux.filter((t) => t.statut === 'Maintenance').length;

  return (
    <SectionShell icon={Wrench} title="Maintenance des terminaux" secteurName={chef.secteurEnCharge}>
      {agLoading ? <p className="py-8 text-center text-muted-foreground">Chargement…</p> : ids.length === 0 ? <EmptyAgences /> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
            <KpiStatCard icon={Smartphone} label="Terminaux" value={terminaux.length} tone="primary" />
            <KpiStatCard icon={CheckCircle2} label="En service" value={enService} tone="emerald" />
            <KpiStatCard icon={AlertTriangle} label="Hors service / panne" value={horsService} tone="red" />
            <KpiStatCard icon={Wrench} label="En maintenance" value={maintenance} tone="amber" />
          </div>
          {isLoading ? <p className="py-6 text-center text-muted-foreground">Chargement…</p> : (
            <Table className="responsive-cards">
              <TableCaption>{terminaux.length === 0 ? 'Aucun terminal.' : `${terminaux.length} terminal(aux).`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead><TableHead>Type</TableHead><TableHead>Agence</TableHead><TableHead>Position</TableHead><TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminaux.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell data-label="Référence" className="font-medium">{t.reference}</TableCell>
                    <TableCell data-label="Type">{t.type_terminal || '—'}</TableCell>
                    <TableCell data-label="Agence">{agenceName[t.agence_id] || '—'}</TableCell>
                    <TableCell data-label="Position">{t.position || '—'}</TableCell>
                    <TableCell data-label="Statut">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.statut === 'En service' ? 'bg-green-100 text-green-700'
                          : ['Hors service', 'En panne'].includes(t.statut) ? 'bg-red-100 text-red-700'
                          : t.statut === 'Maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                      }`}>{t.statut || '—'}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </SectionShell>
  );
};

// ── Paiements de gain ───────────────────────────────────────
export const PaiementsSecteurSection = ({ chef }) => {
  const { names, isLoading: agLoading } = useSecteurAgences(chef.secteurEnCharge);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (agLoading) return;
      if (names.length === 0) { setRows([]); setIsLoading(false); return; }
      setIsLoading(true);
      const { data } = await supabase
        .from('demandes_paiement_gain')
        .select('id, codeDemande, montantGain, statutGlobal, agenceOrigineNom, nomGagnant, prenomGagnant, created_at')
        .in('agenceOrigineNom', names).order('created_at', { ascending: false }).limit(200);
      if (!cancelled) { setRows(data || []); setIsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [names, agLoading]);

  const enCours = rows.filter((r) => String(r.statutGlobal || '').toLowerCase().includes('attente')).length;
  const montantTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.montantGain || 0), 0), [rows]);
  const fmtMontant = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F`;

  return (
    <SectionShell icon={Wallet} title="Paiements de gain du secteur" secteurName={chef.secteurEnCharge}>
      {agLoading ? <p className="py-8 text-center text-muted-foreground">Chargement…</p> : names.length === 0 ? <EmptyAgences /> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
            <KpiStatCard icon={Wallet} label="Demandes" value={rows.length} tone="primary" />
            <KpiStatCard icon={Clock} label="En attente" value={enCours} tone="amber" />
            <KpiStatCard icon={CheckCircle2} label="Montant cumulé" value={fmtMontant(montantTotal)} tone="emerald" />
          </div>
          {isLoading ? <p className="py-6 text-center text-muted-foreground">Chargement…</p> : (
            <Table className="responsive-cards">
              <TableCaption>{rows.length === 0 ? 'Aucune demande de paiement.' : `${rows.length} demande(s).`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Gagnant</TableHead><TableHead>Agence</TableHead><TableHead>Montant</TableHead><TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="Code" className="font-medium">{r.codeDemande || '—'}</TableCell>
                    <TableCell data-label="Gagnant">{[r.prenomGagnant, r.nomGagnant].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell data-label="Agence">{r.agenceOrigineNom || '—'}</TableCell>
                    <TableCell data-label="Montant">{fmtMontant(r.montantGain)}</TableCell>
                    <TableCell data-label="Statut"><span className="text-xs text-muted-foreground">{r.statutGlobal || '—'}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </SectionShell>
  );
};
