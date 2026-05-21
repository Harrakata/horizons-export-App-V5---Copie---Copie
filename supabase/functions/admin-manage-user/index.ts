// Edge Function : gestion des comptes auth.users par un admin Exploitation.
//
// Sécurité :
//   1. Vérifie que l'appelant possède un JWT Supabase valide (utilisateur connecté)
//   2. Vérifie que cet utilisateur est lié à un profil Exploitation `statut = 'Actif'`
//   3. Utilise la service_role uniquement côté serveur pour appeler auth.admin.*
//
// Actions supportées :
//   - create        : { email, password }  → crée un utilisateur dans auth.users
//   - updatePassword: { userId, password } → change le mot de passe d'un utilisateur existant
//   - delete        : { userId }           → supprime un utilisateur de auth.users
//
// Variables d'environnement requises (déjà configurées par Supabase) :
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Déploiement :
//   supabase functions deploy admin-manage-user

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")    return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Edge Function mal configurée : variables Supabase manquantes." }, 500);
    }

    // 1) Authentification : qui appelle cette fonction ?
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header manquant" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return jsonResponse({ error: "Session invalide" }, 401);

    // 2) Autorisation : l'appelant doit être un profil Exploitation actif
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerProfile } = await adminClient
      .from("profils_exploitation")
      .select("id, statut, auth_user_id")
      .eq("auth_user_id", caller.id)
      .eq("statut", "Actif")
      .maybeSingle();

    if (!callerProfile) {
      // Cas spécial : tout premier admin créé via le dashboard Supabase, pas encore lié à un profil.
      // On accepte uniquement si AUCUN profil Exploitation n'existe encore (= bootstrap).
      const { count } = await adminClient
        .from("profils_exploitation")
        .select("id", { count: "exact", head: true });
      if (count && count > 0) {
        return jsonResponse({ error: "Compte non autorisé à gérer les utilisateurs." }, 403);
      }
    }

    // 3) Dispatch des actions
    const body = await req.json().catch(() => null);
    if (!body?.action) return jsonResponse({ error: "Action manquante" }, 400);

    switch (body.action) {
      case "create": {
        const { email, password } = body;
        if (!email || !password) return jsonResponse({ error: "email et password requis" }, 400);

        // Réutilisation : si un compte auth existe déjà pour cet email, on le retourne sans erreur
        // (utile pour le mode bootstrap où l'admin a déjà créé son compte via le Dashboard)
        const listResp = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const users: any[] = listResp?.data?.users ?? [];
        const targetEmail = String(email).toLowerCase();
        const existing = users.find((u: any) => String(u?.email ?? "").toLowerCase() === targetEmail);
        if (existing) {
          // Met à jour le mot de passe pour s'aligner sur la saisie de l'admin
          await adminClient.auth.admin.updateUserById(existing.id, { password });
          return jsonResponse({ user: { id: existing.id, email: existing.email }, reused: true });
        }

        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // pas de mail de vérification : l'admin crée le compte
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ user: { id: data.user.id, email: data.user.email } });
      }

      case "updatePassword": {
        const { userId, password } = body;
        if (!userId || !password) return jsonResponse({ error: "userId et password requis" }, 400);

        const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ ok: true });
      }

      case "updateEmail": {
        const { userId, email } = body;
        if (!userId || !email) return jsonResponse({ error: "userId et email requis" }, 400);

        const { error } = await adminClient.auth.admin.updateUserById(userId, { email });
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ ok: true });
      }

      case "delete": {
        const { userId } = body;
        if (!userId) return jsonResponse({ error: "userId requis" }, 400);

        // Empêcher un admin de se supprimer lui-même
        if (userId === caller.id) {
          return jsonResponse({ error: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
        }
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: `Action inconnue : ${body.action}` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin-manage-user error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
