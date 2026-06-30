import React, { useMemo, useState } from 'react';
import { AlertTriangle, GripVertical, MapPin } from 'lucide-react';
import {
  TICKET_STATUSES, ticketLabel, ticketOverdue,
} from '@/lib/tickets';

// Accent de colonne par statut (point + barre d'en-tête).
const COLUMNS = [
  { key: TICKET_STATUSES.OPEN, label: 'Ouvert', dot: 'bg-blue-500', bar: 'from-blue-500/70', head: 'text-blue-700' },
  { key: TICKET_STATUSES.IN_PROGRESS, label: 'En cours', dot: 'bg-amber-500', bar: 'from-amber-500/70', head: 'text-amber-700' },
  { key: TICKET_STATUSES.RESOLVED, label: 'Résolu', dot: 'bg-emerald-500', bar: 'from-emerald-500/70', head: 'text-emerald-700' },
  { key: TICKET_STATUSES.CLOSED, label: 'Clôturé', dot: 'bg-slate-400', bar: 'from-slate-400/70', head: 'text-slate-600' },
];

// Couleur d'accent de carte (bordure gauche) + pastille selon la priorité.
const PRIORITY_ACCENT = {
  urgente: { border: 'border-l-red-500', pill: 'bg-red-100 text-red-700' },
  haute: { border: 'border-l-orange-500', pill: 'bg-orange-100 text-orange-700' },
  normale: { border: 'border-l-sky-400', pill: 'bg-sky-100 text-sky-700' },
  basse: { border: 'border-l-slate-300', pill: 'bg-slate-100 text-slate-600' },
};

const initials = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || '?';

/**
 * Vue Kanban des tickets, en colonnes par statut.
 * @param rows           tickets
 * @param onCardClick    (ticket) => void — ouvre le détail/traitement si défini
 * @param onStatusChange (id, statut) => void — si défini, active le glisser-déposer
 */
const TicketsKanban = ({ rows = [], onCardClick, onStatusChange }) => {
  const [overCol, setOverCol] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const draggable = typeof onStatusChange === 'function';

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    rows.forEach((r) => { if (map[r.statut]) map[r.statut].push(r); });
    return map;
  }, [rows]);

  const handleDrop = (colKey) => (e) => {
    e.preventDefault();
    setOverCol(null);
    setDraggingId(null);
    if (!draggable) return;
    const id = e.dataTransfer.getData('text/plain');
    const row = rows.find((r) => String(r.id) === String(id));
    if (id && row && row.statut !== colKey) onStatusChange(id, colKey);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = byStatus[col.key];
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            onDragOver={draggable ? (e) => { e.preventDefault(); setOverCol(col.key); } : undefined}
            onDragLeave={draggable ? () => setOverCol((c) => (c === col.key ? null : c)) : undefined}
            onDrop={draggable ? handleDrop(col.key) : undefined}
            className={`flex flex-col rounded-2xl border bg-muted/30 transition-all duration-150 ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
          >
            {/* En-tête de colonne */}
            <div className="relative overflow-hidden rounded-t-2xl">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${col.bar} to-transparent`} />
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <span className={`text-sm font-semibold ${col.head}`}>{col.label}</span>
                <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
                  {items.length}
                </span>
              </div>
            </div>

            {/* Cartes */}
            <div className="flex flex-1 flex-col gap-2.5 p-2.5 pt-1">
              {items.length === 0 ? (
                <div className={`flex h-20 items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground transition ${isOver ? 'border-primary/40 text-primary' : 'border-muted'}`}>
                  {isOver ? 'Déposer ici' : 'Aucun ticket'}
                </div>
              ) : (
                items.map((r) => {
                  const overdue = ticketOverdue(r);
                  const accent = PRIORITY_ACCENT[r.priorite] || PRIORITY_ACCENT.normale;
                  const isDragging = String(draggingId) === String(r.id);
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      draggable={draggable}
                      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/plain', String(r.id)); e.dataTransfer.effectAllowed = 'move'; setDraggingId(r.id); } : undefined}
                      onDragEnd={draggable ? () => { setDraggingId(null); setOverCol(null); } : undefined}
                      onClick={() => onCardClick?.(r)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onCardClick?.(r); }}
                      className={`group relative rounded-xl border border-l-4 ${accent.border} bg-card p-3 text-xs shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-50 rotate-1' : ''}`}
                    >
                      {/* Ligne haute : réf + priorité */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                          {draggable && <GripVertical className="h-3.5 w-3.5 opacity-30 transition group-hover:opacity-60" />}
                          {r.code || `#${r.id}`}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${accent.pill}`}>
                          {ticketLabel(r.priorite)}
                        </span>
                      </div>

                      {/* Titre */}
                      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-foreground">{r.titre}</p>

                      {/* Métadonnées */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">{ticketLabel(r.categorie)}</span>
                        {r.agence_nom && (
                          <span className="inline-flex items-center gap-0.5 truncate"><MapPin className="h-3 w-3" />{r.agence_nom}</span>
                        )}
                      </div>

                      {/* Pied : assigné + retard */}
                      {(r.assigne_a_nom || overdue) && (
                        <div className="mt-2.5 flex items-center justify-between border-t pt-2">
                          {r.assigne_a_nom ? (
                            <span className="flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {initials(r.assigne_a_nom)}
                              </span>
                              <span className="truncate text-[11px] text-muted-foreground">{r.assigne_a_nom}</span>
                            </span>
                          ) : <span />}
                          {overdue && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              <AlertTriangle className="h-3 w-3" /> Retard
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TicketsKanban;
