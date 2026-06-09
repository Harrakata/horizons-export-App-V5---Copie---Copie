import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SEVERITY_DOT = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
};

/**
 * Cloche de notifications d'un espace : badge du nombre total + liste déroulante.
 * Les notifications sont dérivées des données (voir useSpaceNotifications).
 *
 * @param {Array}  notifications  [{ key, count, title, description, to, severity }]
 * @param {number} totalCount
 * @param {Function} [onNavigate] callback optionnel avant navigation (ex. fermer le menu)
 */
const NotificationBell = ({ notifications = [], totalCount = 0, onNavigate }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (to) => {
    setOpen(false);
    onNavigate?.();
    if (to) navigate(to);
  };

  const badge = totalCount > 99 ? '99+' : totalCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${totalCount ? ` (${totalCount})` : ''}`}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-all hover:border-primary/35 hover:bg-primary/10"
        >
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold leading-none text-white ring-2 ring-background">
              {badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
        <div className="flex items-center justify-between px-3 pb-2 pt-3.5">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </span>
          {totalCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{totalCount}</span>
          )}
        </div>
        <div className="mx-3 mb-1 h-px bg-primary/15" />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-7 w-7 text-green-500/70" />
            <p className="text-sm">Aucune alerte en attente.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-0.5 overflow-y-auto px-2 pb-2">
            {notifications.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => go(n.to)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-primary/5"
              >
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] || 'bg-primary'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{n.title}</span>
                    {n.count > 0 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-xs font-bold text-primary">{n.count}</span>
                    )}
                  </span>
                  {n.description && <span className="block truncate text-xs text-muted-foreground">{n.description}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
