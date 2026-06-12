import { supabase } from '@/lib/supabaseClient';

export const ACTIVITY_SESSIONS_TABLE = 'activites_sessions';
export const ACTIVITY_EVENTS_TABLE = 'activites_evenements';

// Libellés lisibles pour chaque espace applicatif.
export const ACTIVITY_SPACE_LABELS = {
  'espace-exploitation': 'Exploitation',
  'espace-chef-agence': "Chef d'agence",
  'espace-guichetiere': 'Guichetière',
  'espace-technicien': 'Technicien',
  'espace-directeur-regional': 'Directeur régional',
  'espace-directeur-general': 'Directeur général',
};

export const getActivitySpaceLabel = (spaceKey) =>
  ACTIVITY_SPACE_LABELS[spaceKey] || spaceKey || 'Espace inconnu';

// Seuils (ms) de calcul de l'état temps réel.
// Le heartbeat tourne toutes les 60 s ; on laisse une marge pour les latences.
export const ACTIVITY_ONLINE_THRESHOLD_MS = 3 * 60 * 1000;   // « En ligne »
export const ACTIVITY_IDLE_THRESHOLD_MS = 15 * 60 * 1000;    // « Inactif »

export const ACTIVITY_STATUS = {
  ONLINE: 'online',
  IDLE: 'idle',
  OFFLINE: 'offline',
};

export const ACTIVITY_STATUS_META = {
  [ACTIVITY_STATUS.ONLINE]: { label: 'En ligne', className: 'bg-green-100 text-green-700 border-green-200' },
  [ACTIVITY_STATUS.IDLE]: { label: 'Inactif', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  [ACTIVITY_STATUS.OFFLINE]: { label: 'Hors ligne', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const EVENT_TYPE_META = {
  login: { label: 'Connexion', className: 'bg-green-100 text-green-700' },
  navigation: { label: 'Navigation', className: 'bg-blue-100 text-blue-700' },
  logout: { label: 'Déconnexion', className: 'bg-red-100 text-red-700' },
};

/**
 * Calcule l'état d'une session à partir de last_seen_at / ended_at.
 * @param {{last_seen_at?: string, ended_at?: string|null}} session
 * @param {number} [now] timestamp de référence (ms)
 */
export const computeActivityStatus = (session, now = Date.now()) => {
  if (!session) return ACTIVITY_STATUS.OFFLINE;
  if (session.ended_at) return ACTIVITY_STATUS.OFFLINE;
  const lastSeen = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  const elapsed = now - lastSeen;
  if (elapsed <= ACTIVITY_ONLINE_THRESHOLD_MS) return ACTIVITY_STATUS.ONLINE;
  if (elapsed <= ACTIVITY_IDLE_THRESHOLD_MS) return ACTIVITY_STATUS.IDLE;
  return ACTIVITY_STATUS.OFFLINE;
};

const PATH_LABEL_OVERRIDES = {
  'mon-planning': 'Mon Planning',
  'mes-guichetieres': 'Mes Guichetières',
  'mes-pointages': 'Mes Pointages',
  'maintenance-terminaux': 'Maintenance Terminaux',
  'suivi-pointage': 'Suivi Pointage',
  'points-vente-mobi': 'Points de Vente Mobi',
  'mes-points-vente-mobi': 'Mes Points de Vente Mobi',
  'paiement-gros-gain': 'Paiement Gros Gain',
  'etat-caisse': 'État de Caisse',
  'chiffres-daffaires': 'Etat comptable',
  'validation-paiement-gain': 'Directeurs',
  'autorisation-paiement-gain': 'Autorisation Paiement Gain',
  'etat-planning-general': 'État Planning Général',
  'referentiel-parametres': 'Référentiel Paramètres',
  'profils-exploitation': 'Profil et Fonctionnalité',
  'activites-utilisateurs': 'Activités utilisateurs',
  'activites-et-audit': 'Activités et Audit',
  'terminaux-mobi': 'Terminaux Mobi',
  'chefs-agence': "Chefs d'agence",
};

/**
 * Transforme un pathname applicatif en libellé lisible (dernier segment).
 */
export const prettifyActivityPath = (pathname) => {
  if (!pathname) return 'Accueil';
  const segments = String(pathname).split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  if (PATH_LABEL_OVERRIDES[last]) return PATH_LABEL_OVERRIDES[last];
  if (!last) return 'Accueil';
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Construit une identité normalisée à partir des données utilisateur d'un espace.
 * Tolérant aux différentes formes de userData selon les espaces.
 */
export const buildActivityIdentity = (raw) => {
  if (!raw) return null;
  const userKey = String(
    raw.userKey ??
      raw.auth_user_id ??
      raw.id ??
      raw.matricule ??
      raw.codePrepose ??
      raw.email ??
      ''
  ).trim();

  if (!userKey) return null;

  const composedName = [raw.prenom, raw.nom].filter(Boolean).join(' ').trim();
  const displayName = String(
    raw.displayName ||
      raw.nomComplet ||
      raw.nomChef ||
      composedName ||
      raw.email ||
      raw.matricule ||
      'Utilisateur'
  ).trim();

  return {
    userKey,
    displayName: displayName || 'Utilisateur',
    email: raw.email ? String(raw.email).trim().toLowerCase() : null,
    role: raw.role || raw.fonction || (raw.isAdmin ? 'Administrateur' : null) || null,
  };
};

/**
 * Démarre (insère) une session d'activité et renvoie son id, ou null en cas d'échec.
 */
export const startActivitySession = async ({ spaceKey, identity, path }) => {
  if (!spaceKey || !identity?.userKey) return null;
  try {
    const { data, error } = await supabase
      .from(ACTIVITY_SESSIONS_TABLE)
      .insert({
        space_key: spaceKey,
        user_key: identity.userKey,
        user_email: identity.email,
        user_name: identity.displayName,
        user_role: identity.role,
        current_path: path || null,
        nav_count: 0,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.warn('[userActivity] startActivitySession échec :', err?.message || err);
    return null;
  }
};

/**
 * Met à jour le last_seen_at (+ chemin courant) d'une session (heartbeat).
 */
export const touchActivitySession = async (sessionId, { path } = {}) => {
  if (!sessionId) return;
  try {
    const payload = { last_seen_at: new Date().toISOString(), ended_at: null };
    if (path) payload.current_path = path;
    await supabase.from(ACTIVITY_SESSIONS_TABLE).update(payload).eq('id', sessionId);
  } catch (err) {
    console.warn('[userActivity] touchActivitySession échec :', err?.message || err);
  }
};

/**
 * Clôture une session (déconnexion / fermeture).
 */
export const endActivitySession = async (sessionId) => {
  if (!sessionId) return;
  try {
    const nowIso = new Date().toISOString();
    await supabase
      .from(ACTIVITY_SESSIONS_TABLE)
      .update({ ended_at: nowIso, last_seen_at: nowIso })
      .eq('id', sessionId);
  } catch (err) {
    console.warn('[userActivity] endActivitySession échec :', err?.message || err);
  }
};

/**
 * Journalise un évènement d'activité (login / navigation / logout).
 */
export const logActivityEvent = async ({ sessionId, spaceKey, identity, eventType, path, label }) => {
  if (!spaceKey || !identity?.userKey || !eventType) return;
  try {
    await supabase.from(ACTIVITY_EVENTS_TABLE).insert({
      session_id: sessionId || null,
      space_key: spaceKey,
      user_key: identity.userKey,
      event_type: eventType,
      path: path || null,
      label: label || null,
    });
  } catch (err) {
    console.warn('[userActivity] logActivityEvent échec :', err?.message || err);
  }
};

/**
 * Incrémente le compteur de navigation d'une session et met à jour le chemin.
 */
export const bumpActivityNavigation = async (sessionId, { path, navCount } = {}) => {
  if (!sessionId) return;
  try {
    const payload = {
      last_seen_at: new Date().toISOString(),
      current_path: path || null,
      ended_at: null,
    };
    if (typeof navCount === 'number') payload.nav_count = navCount;
    await supabase.from(ACTIVITY_SESSIONS_TABLE).update(payload).eq('id', sessionId);
  } catch (err) {
    console.warn('[userActivity] bumpActivityNavigation échec :', err?.message || err);
  }
};
