import { supabase } from '@/lib/supabaseClient';

// ════════════════════════════════════════════════════════════════════════════
//  Réglages GLOBAUX des notifications (par client) — activer/désactiver par type.
//  Source de vérité : app_settings/notification_settings (partagé, tous les users).
//  Cache localStorage alimenté par Layout au boot (event `app-notification-settings-updated`).
//  Le cron serveur (rappels) lit la même clé app_settings.
// ════════════════════════════════════════════════════════════════════════════

export const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const LS_KEY = 'notification_settings_cache';

// Catalogue des types de notifications activables. `push` = concerné par le Web Push.
export const NOTIFICATION_TYPES = [
  { key: 'message',               label: "Messages de l'exploitation",   description: 'Messages ciblés envoyés aux guichetières / techniciens (y compris « à tous »).' },
  { key: 'ticket_assigne',        label: 'Assignation de ticket',        description: 'Prévenir le technicien quand un ticket / incident lui est assigné (avec le sous-ensemble à réparer).' },
  { key: 'intervention_assignee', label: "Planning d'intervention",      description: "Prévenir le technicien d'une intervention planifiée qui lui est assignée." },
  { key: 'rappel_pointage',       label: 'Rappel de pointage',           description: 'Rappeler à la guichetière de pointer selon son planning (déclenché côté serveur).' },
  { key: 'rappel_planning',       label: 'Rappel de planning',           description: 'Rappeler au technicien son intervention planifiée à venir (déclenché côté serveur).' },
];

export const buildDefaultNotificationSettings = () =>
  NOTIFICATION_TYPES.reduce((acc, t) => { acc[t.key] = true; return acc; }, {});

export const normalizeNotificationSettings = (value) => {
  const base = buildDefaultNotificationSettings();
  if (value && typeof value === 'object') {
    for (const t of NOTIFICATION_TYPES) {
      if (typeof value[t.key] === 'boolean') base[t.key] = value[t.key];
    }
  }
  return base;
};

/** Lecture SYNCHRONE depuis le cache localStorage (alimenté par Layout au boot). */
export const getCachedNotificationSettings = () => {
  try { return normalizeNotificationSettings(JSON.parse(localStorage.getItem(LS_KEY) || '{}')); }
  catch { return buildDefaultNotificationSettings(); }
};

/** Un type de notification est-il activé pour ce client ? (par défaut : oui). */
export const isNotifTypeEnabled = (key) => getCachedNotificationSettings()[key] !== false;

/** Charge les réglages depuis le serveur → met à jour le cache localStorage. */
export const loadNotificationSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('app_settings').select('value').eq('key', NOTIFICATION_SETTINGS_KEY).maybeSingle();
    const settings = (!error && data?.value)
      ? normalizeNotificationSettings(data.value)
      : buildDefaultNotificationSettings();
    try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch { /* quota */ }
    return settings;
  } catch {
    return buildDefaultNotificationSettings();
  }
};

/**
 * Sauvegarde les réglages (select-then-update/insert : app_settings n'a pas de
 * contrainte unique garantie sur `key`). Met à jour le cache + émet un event.
 */
export const saveNotificationSettings = async (settings) => {
  const normalized = normalizeNotificationSettings(settings);
  const { data: existing } = await supabase
    .from('app_settings').select('id').eq('key', NOTIFICATION_SETTINGS_KEY).maybeSingle();
  const res = existing?.id
    ? await supabase.from('app_settings').update({ value: normalized }).eq('id', existing.id)
    : await supabase.from('app_settings').insert({ key: NOTIFICATION_SETTINGS_KEY, value: normalized });
  if (!res.error) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(normalized)); } catch { /* quota */ }
    window.dispatchEvent(new CustomEvent('app-notification-settings-updated', { detail: normalized }));
  }
  return res;
};

// ════════════════════════════════════════════════════════════════════════════
//  Config des HORAIRES de rappels (lue par l'Edge Function send-reminders).
//  Éditable dans l'app → pas besoin de redéployer la fonction pour changer les heures.
// ════════════════════════════════════════════════════════════════════════════
export const REMINDER_CONFIG_KEY = 'reminder_config';
const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const buildDefaultReminderConfig = () => ({
  tzOffsetHours: 0,        // décalage horaire local (Mali/Sénégal = 0 = GMT)
  planningLeadMin: 15,     // rappel planning : minutes avant le début du créneau
  matinStart: '08:00',     // début créneau matin
  apresMidiStart: '14:00', // début créneau après-midi
});

export const normalizeReminderConfig = (value) => {
  const base = buildDefaultReminderConfig();
  if (value && typeof value === 'object') {
    if (Number.isFinite(Number(value.tzOffsetHours))) base.tzOffsetHours = Number(value.tzOffsetHours);
    if (Number.isFinite(Number(value.planningLeadMin))) base.planningLeadMin = Math.max(0, Number(value.planningLeadMin));
    if (typeof value.matinStart === 'string' && HHMM_RE.test(value.matinStart)) base.matinStart = value.matinStart;
    if (typeof value.apresMidiStart === 'string' && HHMM_RE.test(value.apresMidiStart)) base.apresMidiStart = value.apresMidiStart;
  }
  return base;
};

export const loadReminderConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('app_settings').select('value').eq('key', REMINDER_CONFIG_KEY).maybeSingle();
    return (!error && data?.value) ? normalizeReminderConfig(data.value) : buildDefaultReminderConfig();
  } catch {
    return buildDefaultReminderConfig();
  }
};

export const saveReminderConfig = async (config) => {
  const normalized = normalizeReminderConfig(config);
  const { data: existing } = await supabase
    .from('app_settings').select('id').eq('key', REMINDER_CONFIG_KEY).maybeSingle();
  return existing?.id
    ? await supabase.from('app_settings').update({ value: normalized }).eq('id', existing.id)
    : await supabase.from('app_settings').insert({ key: REMINDER_CONFIG_KEY, value: normalized });
};
