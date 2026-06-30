import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ABSENCE_STATUSES, ABSENCE_CRENEAUX, getAbsenceTypeLabel, getAbsenceCreneauLabel } from '@/lib/absences';

const CRENEAU_SHORT = { [ABSENCE_CRENEAUX.MATIN]: 'AM', [ABSENCE_CRENEAUX.APRES_MIDI]: 'PM' };

// Couleur de pastille par statut.
const STATUS_DOT = {
  [ABSENCE_STATUSES.PENDING]: 'bg-amber-500',
  [ABSENCE_STATUSES.APPROVED]: 'bg-green-500',
  [ABSENCE_STATUSES.REFUSED]: 'bg-red-500',
  [ABSENCE_STATUSES.CANCELLED]: 'bg-gray-400',
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Calendrier mensuel des demandes d'absence : chaque jour couvert par une demande
 * affiche une pastille colorée selon le statut. Survol = détail.
 * @param rows       demandes [{ date_debut, date_fin, statut, demandeur_nom, type_absence, motif, creneau }]
 * @param onDayClick (dayStr 'yyyy-MM-dd') => void — si défini, clic sur un jour (ex. nouvelle demande)
 */
const AbsenceCalendar = ({ rows = [], onDayClick }) => {
  const [cursor, setCursor] = useState(() => new Date());
  const clickable = typeof onDayClick === 'function';

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  // Demandes couvrant un jour donné (comparaison sur chaînes yyyy-MM-dd).
  const absencesForDay = (dayStr) =>
    rows.filter((r) => r.date_debut && r.date_fin && r.date_debut <= dayStr && dayStr <= r.date_fin);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold capitalize">{format(cursor, 'MMMM yyyy', { locale: fr })}</h4>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor((d) => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>Aujourd'hui</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border bg-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted/60 py-1.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, cursor);
          const dayAbsences = absencesForDay(dayStr);
          return (
            <div
              key={dayStr}
              onClick={clickable ? () => onDayClick(dayStr) : undefined}
              className={`group relative min-h-[68px] bg-background p-1.5 ${inMonth ? '' : 'opacity-40'} ${clickable ? 'cursor-pointer transition hover:bg-primary/5' : ''}`}
            >
              <div className="flex items-center justify-between">
                {clickable && <Plus className="h-3 w-3 text-primary opacity-0 transition group-hover:opacity-70" />}
                <div className="ml-auto text-right text-xs text-muted-foreground">{format(day, 'd')}</div>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {dayAbsences.slice(0, 3).map((r, i) => {
                  const creneauShort = CRENEAU_SHORT[r.creneau];
                  return (
                    <div
                      key={`${r.id}-${i}`}
                      className="flex items-center gap-1 truncate text-[11px] leading-tight"
                      title={`${r.demandeur_nom || 'Demande'} — ${getAbsenceTypeLabel(r.type_absence)} — ${getAbsenceCreneauLabel(r.creneau)} — ${r.statut}${r.motif ? `\nMotif : ${r.motif}` : ''}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[r.statut] || 'bg-gray-400'}`} />
                      <span className="truncate">
                        {r.demandeur_nom || getAbsenceTypeLabel(r.type_absence)}
                        {creneauShort ? <span className="text-muted-foreground"> · {creneauShort}</span> : null}
                        {r.motif ? <span className="text-muted-foreground"> — {r.motif}</span> : null}
                      </span>
                    </div>
                  );
                })}
                {dayAbsences.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayAbsences.length - 3} autre(s)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende des statuts */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_DOT).map(([statut, cls]) => (
          <span key={statut} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {statut}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AbsenceCalendar;
