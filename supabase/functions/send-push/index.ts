// Edge Function : envoi de notifications push (Web Push) ciblées.
//
// Rôle :
//   À partir d'un filtre de cible (rôle / agence / utilisateur) et d'un payload
//   (titre, corps, url), récupère les abonnements correspondants dans
//   push_subscriptions et envoie une notification push à chacun via le protocole
//   Web Push (clés VAPID). Supprime les abonnements expirés (404/410).
//
// Corps attendu (POST JSON) :
//   { "target": { "role"?: string, "agence_nom"?: string, "user_id"?: string },
//     "payload": { "title": string, "body"?: string, "url"?: string, "tag"?: string } }
//
// Variables d'environnement requises :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY        (déjà fournies par Supabase)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY            (paire VAPID du déploiement)
//   VAPID_SUBJECT  → "mailto:contact@exemple.com"  (identité de l'émetteur)
//
// Déploiement :
//   supabase functions deploy send-push
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "vapid_not_configured" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let target: Record<string, string> = {};
  let payload: Record<string, unknown> = {};
  try {
    const body = await req.json();
    target = body.target ?? {};
    payload = body.payload ?? {};
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!payload.title) return json({ error: "missing_title" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  for (const col of ["role", "agence_nom", "user_id"]) {
    const v = (target as Record<string, string>)[col];
    if (v) query = query.eq(col, v);
  }
  const { data: subs, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const notif = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const deadIds: number[] = [];

  await Promise.all(
    (subs ?? []).map(async (s: { id: number; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notif,
        );
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) deadIds.push(s.id);
      }
    }),
  );

  if (deadIds.length) await supabase.from("push_subscriptions").delete().in("id", deadIds);

  return json({ sent, failed, removed: deadIds.length });
});
