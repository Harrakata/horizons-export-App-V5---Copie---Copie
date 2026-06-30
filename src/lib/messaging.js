import { supabase } from '@/lib/supabaseClient';
import { isMissingSupabaseTableError } from '@/lib/guichetiereSpace';

// ════════════════════════════════════════════════════════════════════════════
//  Messagerie — accusés de lecture des messages de l'exploitation.
//  Le ciblage existe déjà (messages_exploitation). Ici on TRACE les lectures
//  (table message_lectures, cf. add_message_lectures.sql) — best-effort.
// ════════════════════════════════════════════════════════════════════════════

const TABLE = 'message_lectures';

/** Garde les ids numériques (= messages_exploitation) parmi des ids hétérogènes. */
const numericIds = (ids) =>
  (ids || []).map((v) => Number(v)).filter((n) => Number.isFinite(n));

/**
 * Enregistre la lecture de messages par un destinataire (upsert idempotent).
 * @param messageIds ids des messages lus (les non-numériques sont ignorés)
 * @param reader     { id, role, nom, agence }
 */
export const markMessagesRead = async (messageIds, reader = {}) => {
  try {
    if (!reader?.id) return;
    const ids = numericIds(messageIds);
    if (!ids.length) return;
    const rows = ids.map((message_id) => ({
      message_id,
      reader_id: String(reader.id),
      reader_role: reader.role || null,
      reader_nom: reader.nom || null,
      agence_nom: reader.agence || null,
      lu_at: new Date().toISOString(),
    }));
    await supabase.from(TABLE).upsert(rows, { onConflict: 'message_id,reader_id', ignoreDuplicates: true });
  } catch {
    /* best-effort */
  }
};

/**
 * Statistiques de lecture pour une liste de messages.
 * @returns { [message_id]: count }  — {} si la table n'existe pas encore.
 */
export const fetchReadStats = async (messageIds) => {
  const ids = numericIds(messageIds);
  if (!ids.length) return {};
  const { data, error } = await supabase.from(TABLE).select('message_id').in('message_id', ids);
  if (error) return {};
  const counts = {};
  (data || []).forEach((r) => { counts[r.message_id] = (counts[r.message_id] || 0) + 1; });
  return counts;
};

// ── Remontée terrain → exploitation ─────────────────────────────────────────────
const MESSAGES_TABLE = 'messages_exploitation';

/**
 * Envoie une remontée d'un agent vers l'exploitation.
 * @param sender { id, role, nom, agence }
 */
export const sendRemontee = async ({ titre, corps, categorie = 'info', sender = {} }) => {
  const { error } = await supabase.from(MESSAGES_TABLE).insert({
    sens: 'remontee',
    destinataires: 'exploitation',
    titre: (titre || '').trim(),
    corps: (corps || '').trim() || null,
    categorie,
    agence_nom: sender.agence || null,
    envoye_par_nom: sender.nom || null,
    envoye_par_role: sender.role || null,
    envoye_par_id: sender.id != null ? String(sender.id) : null,
    actif: true,
    traite: false,
  });
  return { error };
};

/** Remontées (exploitation). Renvoie [] si la colonne `sens` n'existe pas encore. */
export const fetchRemontees = async () => {
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select('id, titre, corps, categorie, agence_nom, envoye_par_nom, envoye_par_role, traite, created_at')
    .eq('sens', 'remontee')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return data || [];
};

/** Marque une remontée comme traitée / non traitée. */
export const setRemonteeTraitee = async (id, traite = true) => {
  const { error } = await supabase.from(MESSAGES_TABLE).update({ traite }).eq('id', id);
  return { error };
};

/** Compte les remontées non traitées (pour l'alerte exploitation). 0 si indisponible. */
export const countUntreatedRemontees = async () => {
  try {
    const { count, error } = await supabase
      .from(MESSAGES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('sens', 'remontee')
      .eq('traite', false);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
};

/** Liste des lecteurs d'un message (pour le détail). */
export const fetchReaders = async (messageId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('reader_nom, reader_role, agence_nom, lu_at')
    .eq('message_id', Number(messageId))
    .order('lu_at', { ascending: false });
  if (error) {
    if (isMissingSupabaseTableError(error, TABLE)) return [];
    return [];
  }
  return data || [];
};
