import { supabase } from '@/lib/supabaseClient';

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VALIDATE: 'validate',
  REFUSE: 'refuse',
  IMPORT: 'import',
  EXPORT: 'export',
};

export const AUDIT_ENTITIES = {
  AGENCE: 'agence',
  TERMINAL: 'terminal',
  PAIEMENT_GAIN: 'paiement_gain',
  POINT_VENTE: 'point_vente',
  GUICHETIERE: 'guichetiere',
  CHEF: 'chef_agence',
  PROFIL: 'profil',
};

const ACTION_LABELS = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  validate: 'Validation',
  refuse: 'Refus',
  import: 'Import',
  export: 'Export',
};

const ENTITY_LABELS = {
  agence: 'Agence',
  terminal: 'Terminal',
  paiement_gain: 'Paiement de gain',
  point_vente: 'Point de vente',
  guichetiere: 'Guichetière',
  chef_agence: "Chef d'agence",
  profil: 'Profil',
};

export const auditActionLabel = (action) => ACTION_LABELS[action] || action || '—';
export const auditEntityLabel = (entity) => ENTITY_LABELS[entity] || entity || '—';

/**
 * Enregistre une action sensible dans le journal d'audit.
 * Ne lève JAMAIS d'erreur : l'audit ne doit pas bloquer l'action métier.
 *
 * @param {object} p
 * @param {string} p.action   AUDIT_ACTIONS.*
 * @param {string} p.entity   AUDIT_ENTITIES.*
 * @param {string} [p.space]
 * @param {string|number} [p.actorId]
 * @param {string} [p.actorName]
 * @param {string} [p.actorRole]
 * @param {string|number} [p.entityId]
 * @param {string} [p.entityLabel]
 * @param {object} [p.details]
 */
export async function logAudit({
  action,
  entity,
  space = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  entityId = null,
  entityLabel = null,
  details = null,
} = {}) {
  try {
    if (!action || !entity) return;
    await supabase.from('audit_log').insert({
      space,
      actor_id: actorId != null ? String(actorId) : null,
      actor_name: actorName,
      actor_role: actorRole,
      action,
      entity,
      entity_id: entityId != null ? String(entityId) : null,
      entity_label: entityLabel,
      details: details ?? null,
    });
  } catch {
    /* silencieux — jamais bloquant */
  }
}

/**
 * Lit le journal d'audit (paginé, filtrable). Renvoie { rows, count }.
 */
export async function fetchAuditLog({
  page = 0,
  pageSize = 50,
  entity = null,
  action = null,
  search = null,
  spaces = null,   // string[] | null — null = tous les espaces
} = {}) {
  try {
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (entity)          query = query.eq('entity', entity);
    if (action)          query = query.eq('action', action);
    if (search)          query = query.or(`actor_name.ilike.%${search}%,entity_label.ilike.%${search}%`);
    if (spaces?.length)  query = query.in('space', spaces);

    const { data, error, count } = await query;
    if (error) return { rows: [], count: 0 };
    return { rows: data || [], count: count || 0 };
  } catch {
    return { rows: [], count: 0 };
  }
}
