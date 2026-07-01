import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, CheckCircle2, ChevronDown,
  AlertTriangle, AlertOctagon, Info,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFeature } from '@/hooks/useFeatureFlags';
import { markMessagesRead } from '@/lib/messaging';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Constantes ────────────────────────────────────────────────────────────────
const SEVERITY_DOT = {
  red:   'bg-red-500',
  amber: 'bg-amber-500',
  blue:  'bg-blue-500',
  green: 'bg-green-500',
};

const CAT_META = {
  info:   { Icon: Info,          color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200',  label: 'Information' },
  urgent: { Icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Urgent'      },
  alerte: { Icon: AlertOctagon,  color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   label: 'Alerte'      },
};

const STORAGE_PREFIX = 'expl_msgs_read_';

const relTime = (iso) => {
  if (!iso) return '';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }); } catch { return ''; }
};

// ── Helpers localStorage ──────────────────────────────────────────────────────
const loadReadIds = (storageKey) => {
  if (!storageKey) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveReadIds = (storageKey, ids) => {
  if (!storageKey) return;
  try {
    // Limite à 500 IDs pour éviter de grossir indéfiniment
    const arr = [...ids].slice(-500);
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(arr));
  } catch {}
};

// ── Composant ─────────────────────────────────────────────────────────────────
/**
 * Cloche de notifications d'un espace.
 *
 * @param {Array}    notifications  [{ key, count, title, description, to, severity, messages? }]
 * @param {number}   totalCount     — conservé pour compatibilité, remplacé par le calcul interne
 * @param {Function} [onNavigate]   callback avant navigation
 * @param {string}   [storageKey]   clé unique par utilisateur pour persister les IDs lus
 */
const NotificationBell = ({ notifications = [], totalCount = 0, onNavigate, storageKey = null, reader = null }) => {
  const navigate = useNavigate();
  const notificationsEnabled = useFeature('notifications');
  const [open, setOpen]             = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);
  const [readIds, setReadIds]       = useState(() => loadReadIds(storageKey));

  // Recharge les IDs lus quand l'utilisateur change (login/logout)
  useEffect(() => { setReadIds(loadReadIds(storageKey)); }, [storageKey]);

  // Ouvre la cloche quand le service worker le demande (clic sur une notif « message »).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onSwMessage = (event) => { if (event.data?.type === 'open-notifications') setOpen(true); };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, []);

  // ── Détection mobile ────────────────────────────────────────────────────────
  // Sur mobile, on n'utilise PAS le positionnement de Radix (qui décale le popover
  // hors écran dans l'en-tête sticky) : on rend un panneau fixe centré via portal.
  // « Mobile » = écran étroit OU PWA installée (standalone). En PWA, le popover
  // natif de Radix se positionne hors écran → on force le panneau fixe portalisé,
  // quel que soit l'appareil (téléphone, tablette).
  const evalMobile = () =>
    typeof window !== 'undefined' && (
      window.matchMedia('(max-width: 767px)').matches ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    );
  const [isMobile, setIsMobile] = useState(evalMobile);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setIsMobile(evalMobile());
    const mqWidth = window.matchMedia('(max-width: 767px)');
    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    mqWidth.addEventListener?.('change', update);
    mqStandalone.addEventListener?.('change', update);
    return () => {
      mqWidth.removeEventListener?.('change', update);
      mqStandalone.removeEventListener?.('change', update);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isUnread = (msgId) => !readIds.has(msgId);

  const markAllRead = (messages) => {
    if (!messages?.length) return;
    if (storageKey) {
      const next = new Set(readIds);
      messages.forEach((m) => next.add(m.id));
      setReadIds(next);
      saveReadIds(storageKey, next);
    }
    // Accusé de lecture serveur (messages de l'exploitation = ids numériques).
    if (reader?.id) markMessagesRead(messages.map((m) => m.id), reader);
  };

  // Badge : pour les notifications avec messages, on compte les non-lus uniquement
  const effectiveBadge = useMemo(() => {
    const n = notifications.reduce((sum, notif) => {
      if (notif.messages?.length) return sum + notif.messages.filter((m) => isUnread(m.id)).length;
      return sum + (notif.count || 0);
    }, 0);
    return n > 99 ? '99+' : n || 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, readIds]);

  // Fonctionnalité Notifications (multi-tenant) : masque la cloche dans tous les
  // espaces si désactivée pour ce client. (Placé après tous les hooks.)
  if (!notificationsEnabled) return null;

  // ── Actions ───────────────────────────────────────────────────────────────
  const go = (to) => {
    setOpen(false);
    onNavigate?.();
    if (to) navigate(to);
  };

  const handleClick = (n) => {
    if (n.messages?.length) {
      const next = expandedKey === n.key ? null : n.key;
      setExpandedKey(next);
      if (next) markAllRead(n.messages);
    } else {
      go(n.to);
    }
  };

  const handleOpenChange = (o) => {
    setOpen(o);
    if (!o) setExpandedKey(null);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  const bellButton = (
    <button
      type="button"
      onClick={isMobile ? () => handleOpenChange(!open) : undefined}
      aria-label={`Notifications${effectiveBadge ? ` (${effectiveBadge})` : ''}`}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-all hover:border-primary/35 hover:bg-primary/10"
    >
      <Bell className="h-4 w-4" />
      {!!effectiveBadge && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold leading-none text-white ring-2 ring-background">
          {effectiveBadge}
        </span>
      )}
    </button>
  );

  const panelBody = (
    <>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />

        {/* En-tête */}
        <div className="flex items-center justify-between px-3 pb-2 pt-3.5">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </span>
          {!!effectiveBadge && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{effectiveBadge}</span>
          )}
        </div>
        <div className="mx-3 mb-1 h-px bg-primary/15" />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-7 w-7 text-green-500/70" />
            <p className="text-sm">Aucune alerte en attente.</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="space-y-0.5 px-2 pb-2">
              {notifications.map((n) => {
                const hasMessages = n.messages?.length > 0;
                const isExpanded  = expandedKey === n.key;
                const unreadCount = hasMessages ? n.messages.filter((m) => isUnread(m.id)).length : 0;
                const hasUnread   = unreadCount > 0;

                return (
                  <div key={n.key}>
                    {/* Ligne de notification */}
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-primary/5"
                    >
                      {/* Point de sévérité — pulse si non-lus */}
                      <span className="relative mt-0.5 shrink-0">
                        <span className={`block h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[n.severity] || 'bg-primary'}`} />
                        {hasMessages && hasUnread && (
                          <span className={`absolute inset-0 animate-ping rounded-full ${SEVERITY_DOT[n.severity] || 'bg-primary'} opacity-60`} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{n.title}</span>
                          {/* Badge count */}
                          {n.count > 0 && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-xs font-bold text-primary">{n.count}</span>
                          )}
                          {/* Badge non-lus */}
                          {hasMessages && hasUnread && (
                            <span className="shrink-0 rounded-full bg-blue-500 px-1.5 text-[0.6rem] font-bold text-white">
                              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                        {/* Description adaptée */}
                        <span className="block truncate text-xs text-muted-foreground">
                          {hasMessages
                            ? (hasUnread
                                ? `${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''} · Cliquez pour lire`
                                : 'Tout lu · Cliquez pour revoir')
                            : n.description}
                        </span>
                      </span>

                      {hasMessages ? (
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      )}
                    </button>

                    {/* Messages expansion inline */}
                    {hasMessages && isExpanded && (
                      <div className="mb-1 ml-2 space-y-1.5 overflow-hidden rounded-lg border border-border/30 bg-muted/15 p-2">
                        {n.messages.map((msg) => {
                          const cat  = CAT_META[msg.categorie] || CAT_META.info;
                          const unread = isUnread(msg.id);
                          return (
                            <div key={msg.id}
                              className={`rounded-lg border p-2.5 transition-all ${cat.border} ${cat.bg} ${unread ? 'ring-1 ring-blue-300' : 'opacity-80'}`}>
                              <div className="mb-1 flex items-start gap-2">
                                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${cat.border} bg-white/70`}>
                                  <cat.Icon className={`h-3 w-3 ${cat.color}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold text-foreground">{msg.titre}</p>
                                </div>
                                {unread ? (
                                  <span className="shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">Nouveau</span>
                                ) : (
                                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold ${cat.color} ${cat.border} bg-white/60`}>
                                    {cat.label}
                                  </span>
                                )}
                              </div>
                              <p className="mb-1.5 whitespace-pre-wrap text-xs text-foreground/80">{msg.corps}</p>
                              <div className="flex items-center gap-2 text-[0.6rem] text-muted-foreground">
                                {msg.envoye_par_nom && <span>{msg.envoye_par_nom}</span>}
                                {msg.envoye_par_nom && msg.created_at && <span>·</span>}
                                {msg.created_at && <span>{relTime(msg.created_at)}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {/* Lien vers la page de traitement (demandes à valider/refuser) */}
                        {n.to && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); go(n.to); }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            {n.ctaLabel || 'Traiter les demandes'} <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </>
  );

  // Sur mobile : panneau fixe centré sous la barre, rendu via portal au niveau du
  // body → positionnement totalement maîtrisé, indépendant du calcul de Radix
  // (qui décalait le contenu hors écran dans l'en-tête sticky).
  if (isMobile) {
    return (
      <>
        {bellButton}
        {open && createPortal(
          // Conteneur plein écran en flexbox : centrage horizontal SANS transform
          // ni marge auto (fiable en PWA/WebView), styles inline (insensibles au
          // purge/override CSS), z-index très haut pour passer au-dessus de tout.
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              pointerEvents: 'none',
            }}
          >
            <div
              onClick={() => handleOpenChange(false)}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
            />
            <div
              className="surface-glass notification-bell-popover overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45)]"
              style={{
                position: 'relative',
                marginTop: '6.25rem',
                width: 'calc(100vw - 1rem)',
                maxWidth: '22rem',
                maxHeight: 'calc(100dvh - 7.75rem)',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'auto',
              }}
              role="region"
              aria-label="Notifications"
            >
              {panelBody}
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Desktop : positionnement natif de Radix (ancré à la cloche).
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{bellButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={{ top: 4, right: 8, bottom: 8, left: 8 }}
        className="notification-bell-popover overflow-hidden p-0"
        style={{ width: 'min(320px, calc(100vw - 1rem))', maxWidth: 'calc(100vw - 1rem)' }}
      >
        {panelBody}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
