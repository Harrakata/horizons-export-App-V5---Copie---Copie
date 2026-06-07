import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  bumpActivityNavigation,
  buildActivityIdentity,
  endActivitySession,
  logActivityEvent,
  prettifyActivityPath,
  startActivitySession,
  touchActivitySession,
} from '@/lib/userActivity';

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const SESSION_STORAGE_PREFIX = 'ps:activity:session:';

const readStoredSession = (spaceKey) => {
  try {
    const raw = sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${spaceKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredSession = (spaceKey, value) => {
  try {
    if (value) {
      sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${spaceKey}`, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${spaceKey}`);
    }
  } catch {
    /* sessionStorage indisponible : on ignore */
  }
};

/**
 * Instrumente un espace applicatif pour journaliser l'activité utilisateur :
 *   - création / reprise de session (état temps réel)
 *   - heartbeat périodique (last_seen_at)
 *   - évènements de navigation entre onglets de l'espace
 *   - clôture de session à la déconnexion / fermeture
 *
 * @param {object}  params
 * @param {string}  params.spaceKey      ex. 'espace-exploitation'
 * @param {boolean} params.isAuthenticated
 * @param {object}  params.identity      données utilisateur brutes de l'espace
 *                                        (voir buildActivityIdentity)
 */
export function useActivityTracker({ spaceKey, isAuthenticated, identity }) {
  const location = useLocation();

  const sessionIdRef = useRef(null);
  const navCountRef = useRef(0);
  const lastPathRef = useRef(null);
  const creatingRef = useRef(false);
  const startingPromiseRef = useRef(null);

  // Identité normalisée (recalculée à chaque rendu mais stable via la clé).
  const normalizedIdentity = buildActivityIdentity(identity);
  const identityRef = useRef(normalizedIdentity);
  identityRef.current = normalizedIdentity;

  const userKey = normalizedIdentity?.userKey || null;
  const active = Boolean(isAuthenticated && spaceKey && userKey);

  // ── Démarrage / clôture de session ────────────────────────
  useEffect(() => {
    if (!active) {
      // Déconnexion : on clôture la session courante si elle existe.
      const stored = readStoredSession(spaceKey);
      const sessionId = sessionIdRef.current || stored?.id;
      if (sessionId) {
        const id = identityRef.current;
        if (id) {
          logActivityEvent({
            sessionId,
            spaceKey,
            identity: id,
            eventType: 'logout',
            path: lastPathRef.current,
            label: 'Déconnexion',
          });
        }
        endActivitySession(sessionId);
      }
      sessionIdRef.current = null;
      navCountRef.current = 0;
      lastPathRef.current = null;
      writeStoredSession(spaceKey, null);
      return;
    }

    const ensureSession = async () => {
      // Garde StrictMode / double-rendu : une seule création concurrente.
      if (creatingRef.current || sessionIdRef.current) return;
      creatingRef.current = true;

      const currentPath = location.pathname;
      lastPathRef.current = currentPath;

      // Reprise d'une session existante (rechargement de page même onglet).
      const stored = readStoredSession(spaceKey);
      if (stored?.id && stored.userKey === userKey) {
        sessionIdRef.current = stored.id;
        navCountRef.current = stored.navCount || 0;
        creatingRef.current = false;
        touchActivitySession(stored.id, { path: currentPath });
        return;
      }

      const promise = startActivitySession({
        spaceKey,
        identity: identityRef.current,
        path: currentPath,
      });
      startingPromiseRef.current = promise;
      const newId = await promise;
      creatingRef.current = false;
      // On assigne même si l'effet a été nettoyé (StrictMode) : assigner une ref
      // est sans effet de bord et évite les sessions orphelines en base.
      if (!newId) return;

      sessionIdRef.current = newId;
      navCountRef.current = 0;
      writeStoredSession(spaceKey, { id: newId, userKey, navCount: 0 });
      logActivityEvent({
        sessionId: newId,
        spaceKey,
        identity: identityRef.current,
        eventType: 'login',
        path: currentPath,
        label: prettifyActivityPath(currentPath),
      });
    };

    ensureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, spaceKey, userKey]);

  // ── Heartbeat ─────────────────────────────────────────────
  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(() => {
      if (sessionIdRef.current) {
        touchActivitySession(sessionIdRef.current, { path: lastPathRef.current });
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  // ── Navigation entre onglets de l'espace ──────────────────
  useEffect(() => {
    if (!active) return;
    const currentPath = location.pathname;
    if (lastPathRef.current === currentPath) return;

    // Première navigation = chemin initial déjà couvert par l'évènement login.
    const isInitial = lastPathRef.current === null;
    lastPathRef.current = currentPath;
    if (isInitial) return;

    const applyNavigation = (sessionId) => {
      if (!sessionId) return;
      navCountRef.current += 1;
      const stored = readStoredSession(spaceKey);
      if (stored?.id === sessionId) {
        writeStoredSession(spaceKey, { ...stored, navCount: navCountRef.current });
      }
      bumpActivityNavigation(sessionId, { path: currentPath, navCount: navCountRef.current });
      logActivityEvent({
        sessionId,
        spaceKey,
        identity: identityRef.current,
        eventType: 'navigation',
        path: currentPath,
        label: prettifyActivityPath(currentPath),
      });
    };

    if (sessionIdRef.current) {
      applyNavigation(sessionIdRef.current);
    } else if (startingPromiseRef.current) {
      // Session encore en cours de création : on attend son id.
      startingPromiseRef.current.then((id) => applyNavigation(id || sessionIdRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, active, spaceKey]);

  // ── Clôture best-effort à la fermeture de l'onglet ────────
  useEffect(() => {
    if (!active) return undefined;
    const handlePageHide = () => {
      const sessionId = sessionIdRef.current;
      if (sessionId) endActivitySession(sessionId);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [active]);
}

export default useActivityTracker;
