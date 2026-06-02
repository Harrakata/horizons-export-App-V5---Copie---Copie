import { publicSupabase, supabase } from '@/lib/supabaseClient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login intelligent : accepte un email OU un identifiant local (matricule).
 *
 * - Si l'identifiant ressemble à un email (contient '@') → utilisé tel quel
 * - Sinon → lookup dans la table fournie pour récupérer l'email associé au matricule,
 *           puis Supabase Auth est appelé avec cet email.
 *
 * @param {object} opts
 * @param {string} opts.identifier   - Saisie de l'utilisateur (email ou matricule)
 * @param {string} opts.password
 * @param {string} opts.table        - Table à interroger pour le lookup matricule (ex: 'techniciens')
 * @param {string} [opts.matriculeCol='matricule']
 * @param {string} [opts.emailCol='email']
 *
 * @returns {Promise<{ data, error }>} - Format identique à supabase.auth.signInWithPassword
 */
export async function smartSignIn({
  identifier,
  password,
  table,
  matriculeCol = 'matricule',
  emailCol    = 'email',
}) {
  const id = String(identifier ?? '').trim();
  if (!id) {
    return { data: null, error: { message: 'Identifiant requis.' } };
  }

  let emailToUse;
  if (EMAIL_REGEX.test(id)) {
    emailToUse = id.toLowerCase();
  } else {
    // Lookup par matricule → on récupère l'email lié
    const { data: row, error: lookupErr } = await publicSupabase
      .from(table)
      .select(emailCol)
      .ilike(matriculeCol, id)
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      return { data: null, error: { message: `Erreur lookup matricule : ${lookupErr.message}` } };
    }
    const linkedEmail = row?.[emailCol];
    if (!linkedEmail) {
      return {
        data: null,
        error: { message: `Matricule "${id}" introuvable ou sans email associé. Contactez un administrateur.` },
      };
    }
    emailToUse = String(linkedEmail).trim().toLowerCase();
  }

  return supabase.auth.signInWithPassword({ email: emailToUse, password });
}

/**
 * Récupère le profil métier (technicien, chef, guichetière…) lié à un compte auth.
 *
 * @param {object} opts
 * @param {string} opts.table         - Nom de la table (ex: 'techniciens')
 * @param {string} opts.authUserId    - UUID du compte auth.users
 * @param {string} [opts.statusCol]   - Colonne statut à vérifier (ex: 'statut')
 * @param {string} [opts.activeValue='Actif']
 *
 * @returns {Promise<{ data, error }>}
 */
export async function fetchAuthLinkedProfile({
  table,
  authUserId,
  statusCol  = null,
  activeValue = 'Actif',
}) {
  let query = supabase.from(table).select('*').eq('auth_user_id', authUserId);
  if (statusCol) query = query.eq(statusCol, activeValue);
  return query.maybeSingle();
}

/**
 * Extrait le message d'erreur d'une réponse Edge Function (utile car
 * supabase.functions.invoke renvoie un "non-2xx status code" générique).
 *
 * @param {Error|null} error   - L'erreur de supabase.functions.invoke
 * @param {object|null} data   - Le body de réponse si parsé
 * @returns {Promise<string|null>}
 */
export async function extractEdgeFunctionError(error, data) {
  if (data?.error) return data.error;
  if (!error) return null;
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      return body?.error ?? body?.message ?? null;
    }
    if (ctx && typeof ctx.text === 'function') {
      const txt = await ctx.text();
      if (txt) return txt;
    }
  } catch {}
  return error.message ?? null;
}
