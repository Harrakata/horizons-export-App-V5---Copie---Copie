import { supabase } from '@/lib/supabaseClient';
import { isMissingSupabaseTableError } from '@/lib/guichetiereSpace';

// ════════════════════════════════════════════════════════════════════════════
//  Demandes d'absence / congés (guichetières & techniciens) — service.
//
//  Workflow plage de dates, validation à un seul niveau :
//   * guichetière → chef d'agence  (filtre agence_nom)
//   * technicien  → chef de secteur (filtre secteur)
//  Table : demandes_absence (cf. supabase/migrations/add_demandes_absence.sql).
//  Complète l'« indisponibilité » par créneau existante.
// ════════════════════════════════════════════════════════════════════════════

export const ABSENCE_TABLE = 'demandes_absence';

export const ABSENCE_ROLES = {
  GUICHETIERE: 'guichetiere',
  TECHNICIEN: 'technicien',
};

export const ABSENCE_STATUSES = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REFUSED: 'Refusée',
  CANCELLED: 'Annulée',
};

export const ABSENCE_TYPES = {
  CONGE: 'conge',
  MALADIE: 'maladie',
  AUTRE: 'autre',
};

export const ABSENCE_CRENEAUX = {
  JOURNEE: 'journee',
  MATIN: 'matin',
  APRES_MIDI: 'apres_midi',
};

export const ABSENCE_CRENEAU_OPTIONS = [
  { value: ABSENCE_CRENEAUX.JOURNEE, label: 'Journée entière' },
  { value: ABSENCE_CRENEAUX.MATIN, label: 'Matin' },
  { value: ABSENCE_CRENEAUX.APRES_MIDI, label: 'Après-midi' },
];

export const getAbsenceCreneauLabel = (value) => {
  switch (value) {
    case ABSENCE_CRENEAUX.MATIN: return 'Matin';
    case ABSENCE_CRENEAUX.APRES_MIDI: return 'Après-midi';
    case ABSENCE_CRENEAUX.JOURNEE: return 'Journée';
    default: return value ? value : 'Journée';
  }
};

export const getAbsenceTypeLabel = (value) => {
  switch (value) {
    case ABSENCE_TYPES.CONGE: return 'Congé';
    case ABSENCE_TYPES.MALADIE: return 'Maladie';
    case ABSENCE_TYPES.AUTRE: return 'Autre';
    default: return value || '—';
  }
};

export const ABSENCE_TYPE_OPTIONS = [
  { value: ABSENCE_TYPES.CONGE, label: 'Congé' },
  { value: ABSENCE_TYPES.MALADIE, label: 'Maladie' },
  { value: ABSENCE_TYPES.AUTRE, label: 'Autre' },
];

export const getAbsenceStatusBadgeClass = (statut) => {
  switch (statut) {
    case ABSENCE_STATUSES.APPROVED: return 'bg-green-100 text-green-700 border-green-200';
    case ABSENCE_STATUSES.REFUSED: return 'bg-red-100 text-red-700 border-red-200';
    case ABSENCE_STATUSES.CANCELLED: return 'bg-gray-100 text-gray-600 border-gray-200';
    case ABSENCE_STATUSES.PENDING:
    default: return 'bg-amber-100 text-amber-700 border-amber-200';
  }
};

export const isMissingAbsenceTableError = (error) =>
  isMissingSupabaseTableError(error, ABSENCE_TABLE);

/** Nombre de jours (inclusif) couverts par une demande. */
export const absenceDaysCount = (dateDebut, dateFin) => {
  if (!dateDebut || !dateFin) return 0;
  const d1 = new Date(dateDebut);
  const d2 = new Date(dateFin);
  const diff = Math.round((d2 - d1) / 86400000);
  return Number.isFinite(diff) ? Math.max(diff + 1, 0) : 0;
};

/**
 * Liste les demandes d'absence selon un filtre d'égalités.
 * @param filters { role_demandeur?, agence_nom?, secteur?, demandeur_id?, statut? }
 * @returns { rows, error } — rows=[] si la table n'existe pas encore.
 */
export const fetchAbsences = async (filters = {}) => {
  let query = supabase.from(ABSENCE_TABLE).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') query = query.eq(key, value);
  });
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    if (isMissingAbsenceTableError(error)) return { rows: [], error: null };
    return { rows: [], error };
  }
  return { rows: data || [], error: null };
};

/**
 * Absences APPROUVÉES chevauchant une plage [start, end] (pour bloquer la
 * planification). Renvoie [] si la table n'existe pas encore.
 * @param role_demandeur 'guichetiere' | 'technicien' (optionnel)
 */
export const fetchApprovedAbsencesInRange = async ({ role_demandeur, start, end } = {}) => {
  let query = supabase
    .from(ABSENCE_TABLE)
    .select('demandeur_id, demandeur_nom, date_debut, date_fin, creneau')
    .eq('statut', ABSENCE_STATUSES.APPROVED);
  if (role_demandeur) query = query.eq('role_demandeur', role_demandeur);
  if (end) query = query.lte('date_debut', end);   // condition de chevauchement
  if (start) query = query.gte('date_fin', start);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
};

/**
 * Un demandeur est-il en absence validée le jour donné (et le créneau, si fourni) ?
 * @param creneau 'matin' | 'apres_midi' | undefined (undefined = journée → bloque tout)
 * @returns l'absence bloquante, ou null.
 */
export const findBlockingAbsence = (absences, demandeurId, dateStr, creneau) =>
  (absences || []).find((a) =>
    String(a.demandeur_id) === String(demandeurId) &&
    a.date_debut <= dateStr && dateStr <= a.date_fin &&
    (a.creneau === ABSENCE_CRENEAUX.JOURNEE || !creneau || a.creneau === creneau)
  ) || null;

/** Crée une demande d'absence (statut initial « En attente »). */
export const createAbsence = async (payload) => {
  const row = { ...payload, statut: ABSENCE_STATUSES.PENDING };
  const { data, error } = await supabase.from(ABSENCE_TABLE).insert(row).select().single();
  return { data, error };
};

/** Traite une demande (Approuvée / Refusée) par un valideur. */
export const updateAbsenceStatut = async (id, { statut, commentaire, traitee_par, traitee_par_role }) => {
  const { error } = await supabase
    .from(ABSENCE_TABLE)
    .update({
      statut,
      commentaire_traitement: commentaire ?? null,
      traitee_par: traitee_par ?? null,
      traitee_par_role: traitee_par_role ?? null,
      date_traitement: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  return { error };
};

/** Annulation par le demandeur (uniquement si encore « En attente »). */
export const cancelAbsence = async (id) => {
  const { error } = await supabase
    .from(ABSENCE_TABLE)
    .update({ statut: ABSENCE_STATUSES.CANCELLED, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('statut', ABSENCE_STATUSES.PENDING);
  return { error };
};
