import { supabase } from '@/lib/supabaseClient';
import { isMissingSupabaseTableError } from '@/lib/guichetiereSpace';

// ════════════════════════════════════════════════════════════════════════════
//  Module Tickets / Incidents — service.
//
//  Flux : déclaration (guichetière / chef d'agence) → triage & assignation
//  (exploitation) → résolution (technicien). Table : tickets_incidents
//  (cf. supabase/migrations/add_tickets_incidents.sql).
// ════════════════════════════════════════════════════════════════════════════

export const TICKETS_TABLE = 'tickets_incidents';

export const TICKET_ROLES = { GUICHETIERE: 'guichetiere', CHEF_AGENCE: 'chef_agence' };

export const TICKET_STATUSES = {
  OPEN: 'ouvert',
  IN_PROGRESS: 'en_cours',
  RESOLVED: 'resolu',
  CLOSED: 'cloture',
  CANCELLED: 'annule',
};

export const TICKET_CATEGORIES = {
  TERMINAL: 'terminal',
  MOBI: 'mobi',
  MATERIEL: 'materiel',
  RESEAU: 'reseau',
  AUTRE: 'autre',
};

export const TICKET_PRIORITIES = { BASSE: 'basse', NORMALE: 'normale', HAUTE: 'haute', URGENTE: 'urgente' };

export const TICKET_CATEGORY_OPTIONS = [
  { value: TICKET_CATEGORIES.TERMINAL, label: 'Terminal' },
  { value: TICKET_CATEGORIES.MOBI, label: 'Terminal Mobi' },
  { value: TICKET_CATEGORIES.MATERIEL, label: 'Matériel' },
  { value: TICKET_CATEGORIES.RESEAU, label: 'Réseau' },
  { value: TICKET_CATEGORIES.AUTRE, label: 'Autre' },
];

/** Type de terminal attendu pour une catégorie : 'fixe' (terminal), 'mobi', ou null. */
export const categoryTerminalKind = (categorie) =>
  categorie === TICKET_CATEGORIES.TERMINAL ? 'fixe'
    : categorie === TICKET_CATEGORIES.MOBI ? 'mobi'
    : null;

export const TICKET_PRIORITY_OPTIONS = [
  { value: TICKET_PRIORITIES.BASSE, label: 'Basse' },
  { value: TICKET_PRIORITIES.NORMALE, label: 'Normale' },
  { value: TICKET_PRIORITIES.HAUTE, label: 'Haute' },
  { value: TICKET_PRIORITIES.URGENTE, label: 'Urgente' },
];

const LABELS = {
  ouvert: 'Ouvert', en_cours: 'En cours', resolu: 'Résolu', cloture: 'Clôturé', annule: 'Annulé',
  terminal: 'Terminal', mobi: 'Terminal Mobi', materiel: 'Matériel', reseau: 'Réseau', autre: 'Autre',
  basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente',
};
export const ticketLabel = (value) => LABELS[value] || value || '—';

export const getTicketStatusBadgeClass = (statut) => {
  switch (statut) {
    case TICKET_STATUSES.OPEN: return 'bg-blue-100 text-blue-700 border-blue-200';
    case TICKET_STATUSES.IN_PROGRESS: return 'bg-amber-100 text-amber-700 border-amber-200';
    case TICKET_STATUSES.RESOLVED: return 'bg-green-100 text-green-700 border-green-200';
    case TICKET_STATUSES.CLOSED: return 'bg-gray-100 text-gray-600 border-gray-200';
    case TICKET_STATUSES.CANCELLED: return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

export const getTicketPriorityBadgeClass = (priorite) => {
  switch (priorite) {
    case TICKET_PRIORITIES.URGENTE: return 'bg-red-100 text-red-700 border-red-200';
    case TICKET_PRIORITIES.HAUTE: return 'bg-orange-100 text-orange-700 border-orange-200';
    case TICKET_PRIORITIES.NORMALE: return 'bg-slate-100 text-slate-700 border-slate-200';
    case TICKET_PRIORITIES.BASSE: return 'bg-slate-50 text-slate-500 border-slate-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const isMissingTicketsTableError = (error) => isMissingSupabaseTableError(error, TICKETS_TABLE);

// ── SLA : délai cible de résolution (heures) par priorité ───────────────────────
export const SLA_HOURS = {
  [TICKET_PRIORITIES.URGENTE]: 4,
  [TICKET_PRIORITIES.HAUTE]: 24,
  [TICKET_PRIORITIES.NORMALE]: 72,
  [TICKET_PRIORITIES.BASSE]: 168,
};

/** Un ticket est-il « actif » (non clôturé/résolu/annulé) ? */
export const ticketIsActive = (statut) =>
  statut === TICKET_STATUSES.OPEN || statut === TICKET_STATUSES.IN_PROGRESS;

/** Échéance SLA (timestamp ms) d'un ticket, ou null si indéterminable. */
export const ticketDueAt = (ticket) => {
  const created = ticket?.created_at ? new Date(ticket.created_at).getTime() : NaN;
  if (!Number.isFinite(created)) return null;
  const hours = SLA_HOURS[ticket?.priorite] ?? SLA_HOURS[TICKET_PRIORITIES.NORMALE];
  return created + hours * 3600 * 1000;
};

/** Vrai si le ticket est actif ET a dépassé son délai SLA. */
export const ticketOverdue = (ticket) => {
  if (!ticket || !ticketIsActive(ticket.statut)) return false;
  const due = ticketDueAt(ticket);
  return due != null && Date.now() > due;
};

/** Code lisible (ex. INC-2026-AB12C). Unicité best-effort (suffixe temporel base36). */
export const generateTicketCode = () =>
  `INC-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;

/**
 * Terminaux rattachables à un ticket pour une agence : terminaux FIXES (table
 * terminaux via agence_id) + terminaux MOBI (terminaux_mobi reliés à l'agence via
 * points_vente_mobi). Chaque entrée porte `kind` ('fixe' | 'mobi').
 * @returns [{ id, reference, kind }]  — [] si indéterminable.
 */
export const fetchTicketTerminals = async (agenceNom) => {
  if (!agenceNom) return [];
  try {
    const { data: agences } = await supabase
      .from('agences').select('id, nom').eq('is_current', true).eq('nom', agenceNom);
    const agenceId = agences?.[0]?.id;

    // Terminaux fixes de l'agence.
    let fixes = [];
    if (agenceId) {
      const { data } = await supabase
        .from('terminaux').select('id, reference').eq('agence_id', agenceId).order('reference', { ascending: true });
      fixes = (data || []).map((t) => ({ id: String(t.id), reference: t.reference, kind: 'fixe' }));
    }

    // Terminaux Mobi rattachés à l'agence via points_vente_mobi.
    const { data: pvm } = await supabase
      .from('points_vente_mobi').select('terminalReference').eq('agenceNom', agenceNom);
    const refs = [...new Set((pvm || []).map((p) => p.terminalReference).filter(Boolean))];
    let mobi = [];
    if (refs.length) {
      const { data } = await supabase.from('terminaux_mobi').select('id, reference').in('reference', refs);
      mobi = (data || []).map((t) => ({ id: String(t.id), reference: t.reference, kind: 'mobi' }));
    }

    return [...fixes, ...mobi];
  } catch {
    return [];
  }
};

/** Techniciens (pour l'assignation par l'exploitation). */
export const fetchTechniciens = async () => {
  const { data, error } = await supabase.from('techniciens').select('id, nom, prenom, matricule').order('nom', { ascending: true });
  if (error) return [];
  return data || [];
};

/**
 * Liste les tickets selon un filtre d'égalités.
 * @returns { rows, error } — rows=[] si la table n'existe pas encore.
 */
export const fetchTickets = async (filters = {}) => {
  let query = supabase.from(TICKETS_TABLE).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') query = query.eq(key, value);
  });
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) {
    if (isMissingTicketsTableError(error)) return { rows: [], error: null };
    return { rows: [], error };
  }
  return { rows: data || [], error: null };
};

/** Crée un ticket (statut initial « ouvert »). */
export const createTicket = async (payload) => {
  const row = { ...payload, code: payload.code || generateTicketCode(), statut: TICKET_STATUSES.OPEN };
  const { data, error } = await supabase.from(TICKETS_TABLE).insert(row).select().single();
  return { data, error };
};

/**
 * Crée une intervention de maintenance liée à un ticket (résolution d'un incident
 * sur un terminal). Renvoie { data: { id }, error }. Échoue proprement si le ticket
 * n'a pas de terminal exploitable.
 */
export const createInterventionFromTicket = async (ticket, { technicienId, commentaire } = {}) => {
  if (ticket?.terminal_kind === 'mobi') {
    return { data: null, error: new Error('Les interventions de maintenance ne concernent que les terminaux fixes.') };
  }
  const terminalId = Number(ticket?.terminal_id);
  if (!Number.isFinite(terminalId)) {
    return { data: null, error: new Error('Aucun terminal valide rattaché au ticket.') };
  }
  const techId = Number(technicienId ?? ticket?.assigne_a_id);
  const note = (commentaire || ticket?.commentaire_resolution || ticket?.titre || '').trim();
  const payload = {
    terminal_id: terminalId,
    technicien_id: Number.isFinite(techId) ? techId : null,
    type_intervention: 'curative',
    statut: 'Terminée',
    commentaire: `Ticket ${ticket?.code || ticket?.id || ''} : ${note}`.trim(),
    date_intervention: new Date().toISOString(),
    date_fin: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('interventions_maintenance').insert(payload).select('id').single();
  return { data, error };
};

/** Met à jour un ticket (assignation, statut, commentaire…). updated_at géré ici. */
export const updateTicket = async (id, fields) => {
  const patch = { ...fields, updated_at: new Date().toISOString() };
  if (fields.statut === TICKET_STATUSES.RESOLVED && !fields.date_resolution) {
    patch.date_resolution = new Date().toISOString();
  }
  const { error } = await supabase.from(TICKETS_TABLE).update(patch).eq('id', id);
  return { error };
};
