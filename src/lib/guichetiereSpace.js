export const GUICHETIERE_AUTH_KEY = 'pmuGuichetiereAuth';

export const REQUEST_STATUS = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REFUSED: 'Refusée',
  CANCELLED: 'Annulée',
};

export const PLANNING_REQUEST_TYPES = {
  UNAVAILABILITY: 'indisponibilite',
  DATE_CHANGE: 'changement_date',
};

export const POINT_VENTE_REQUEST_TYPES = {
  UPDATE: 'modification_affectation',
};

export const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const formatDisplayDate = (value) => {
  if (!value) return 'N/A';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleDateString('fr-FR');
};

export const formatDisplayDateTime = (value) => {
  if (!value) return 'N/A';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleString('fr-FR');
};

export const getPlanningRequestTypeLabel = (value) => {
  if (value === PLANNING_REQUEST_TYPES.UNAVAILABILITY) return 'Indisponibilité';
  if (value === PLANNING_REQUEST_TYPES.DATE_CHANGE) return 'Changement de date';
  return value || 'N/A';
};

export const getRequestStatusBadgeClass = (status) => {
  if (status === REQUEST_STATUS.APPROVED) {
    return 'border-green-200 bg-green-50 text-green-700';
  }

  if (status === REQUEST_STATUS.REFUSED) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (status === REQUEST_STATUS.CANCELLED) {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
};

export const buildGuichetiereDisplayName = (guichetiere) =>
  [guichetiere?.prenom, guichetiere?.nom].filter(Boolean).join(' ').trim() ||
  guichetiere?.matricule ||
  'Guichetière';

export const isMissingSupabaseTableError = (error, tableName) => {
  if (!error) return false;

  const serializedError = JSON.stringify(error).toLowerCase();
  return (
    serializedError.includes(String(tableName || '').toLowerCase()) &&
    (serializedError.includes('schema cache') ||
      serializedError.includes('does not exist') ||
      serializedError.includes('could not find the table'))
  );
};

// Détecte une erreur d'authentification Supabase (clé JWT invalide / non correspondante)
export const isSupabaseAuthError = (error) => {
  if (!error) return false;
  const msg = (error.message || JSON.stringify(error)).toLowerCase();
  return (
    msg.includes('no suitable key') ||
    msg.includes('wrong key type') ||
    msg.includes('jwt') ||
    msg.includes('invalid api key') ||
    msg.includes('apikey') ||
    error.status === 401 ||
    error.code === 'PGRST301'
  );
};

// Détecte une table absente (migration non encore appliquée) : la fonctionnalité
// doit alors se dégrader silencieusement au lieu d'afficher une erreur bloquante.
export const isMissingTableError = (error) => {
  if (!error) return false;
  const msg = (error.message || JSON.stringify(error)).toLowerCase();
  return (
    error.code === 'PGRST205' || // PostgREST : table introuvable dans le schema cache
    error.code === '42P01' ||    // PostgreSQL : undefined_table
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
};
