import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Building, Smartphone, Users, UserCog, CornerDownLeft } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { isGuichetiereAgenceVisible } from '@/lib/orgStructureConfig';

// Nettoie le terme pour l'usage dans un filtre PostgREST `or(...)`.
const sanitize = (q) => q.replace(/[,()*%]/g, ' ').trim();

const TYPE_META = {
  agence:      { icon: Building,  label: 'Agences',      tone: 'text-primary' },
  terminal:    { icon: Smartphone, label: 'Terminaux',   tone: 'text-violet-600' },
  guichetiere: { icon: Users,     label: 'Guichetières', tone: 'text-emerald-600' },
  chef:        { icon: UserCog,   label: "Chefs d'agence", tone: 'text-blue-600' },
};

async function runSearch(raw) {
  const q = sanitize(raw);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const safe = async (p) => { try { const { data, error } = await p; return error ? [] : (data || []); } catch { return []; } };

  const [agences, terminaux, guichetieres, chefs] = await Promise.all([
    safe(supabase.from('agences').select('id,nom,codePDV,region').eq('is_current', true).or(`nom.ilike.${like},codePDV.ilike.${like}`).limit(5)),
    safe(supabase.from('terminaux').select('id,reference,agence_id').ilike('reference', like).limit(5)),
    safe(supabase.from('guichetieres').select('id,matricule,nom,prenom,agenceAssigne').eq('is_current', true).or(`nom.ilike.${like},prenom.ilike.${like},matricule.ilike.${like}`).limit(5)),
    safe(supabase.from('chefs_agence').select('id,matricule,nom,prenom,agenceEnCharge').eq('is_current', true).or(`nom.ilike.${like},prenom.ilike.${like},matricule.ilike.${like}`).limit(5)),
  ]);

  const results = [];
  agences.forEach((a) => results.push({
    type: 'agence', id: a.id, title: a.nom, subtitle: [a.codePDV, a.region].filter(Boolean).join(' • '),
    to: `/espace-exploitation/agences?q=${encodeURIComponent(a.nom || '')}`,
  }));
  terminaux.forEach((t) => results.push({
    type: 'terminal', id: t.id, title: t.reference, subtitle: 'Terminal',
    to: `/espace-exploitation/maintenance-terminaux?q=${encodeURIComponent(t.reference || '')}`,
  }));
  guichetieres.forEach((g) => results.push({
    type: 'guichetiere', id: g.id, title: `${g.prenom || ''} ${g.nom || ''}`.trim(),
    subtitle: [g.matricule, isGuichetiereAgenceVisible() ? g.agenceAssigne : null].filter(Boolean).join(' • '),
    to: `/espace-exploitation/guichetieres?q=${encodeURIComponent(g.matricule || g.nom || '')}`,
  }));
  chefs.forEach((c) => results.push({
    type: 'chef', id: c.id, title: `${c.prenom || ''} ${c.nom || ''}`.trim(), subtitle: [c.matricule, c.agenceEnCharge].filter(Boolean).join(' • '),
    to: `/espace-exploitation/chefs-agence?q=${encodeURIComponent(c.matricule || c.nom || '')}`,
  }));
  return results;
}

const GlobalSearchDialog = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTerm('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (sanitize(term).length < 2) { setResults([]); setIsLoading(false); return undefined; }
    setIsLoading(true);
    const handle = setTimeout(async () => {
      const r = await runSearch(term);
      setResults(r);
      setIsLoading(false);
    }, 280);
    return () => clearTimeout(handle);
  }, [term, open]);

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  // Regroupe par type en conservant l'ordre des types.
  const grouped = ['agence', 'terminal', 'guichetiere', 'chef']
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 p-0 sm:max-w-xl">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher agence, terminal, guichetière, chef…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {sanitize(term).length < 2 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Saisissez au moins 2 caractères.</p>
          ) : (!isLoading && grouped.length === 0) ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucun résultat pour « {term.trim()} ».</p>
          ) : (
            grouped.map((group) => {
              const meta = TYPE_META[group.type];
              const Icon = meta.icon;
              return (
                <div key={group.type} className="mb-1">
                  <p className="px-2 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground/70">{meta.label}</p>
                  {group.items.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => go(item.to)}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-primary/5"
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{item.title || '—'}</span>
                        {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                      </span>
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearchDialog;
