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
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY            (paire VAPID du déploiement, base64url)
//   VAPID_SUBJECT  → "mailto:contact@exemple.com"  (identité de l'émetteur)
//
// ⚠ La clé VAPID_PUBLIC_KEY DOIT être identique à VITE_VAPID_PUBLIC_KEY (front),
//   sinon le service de push (FCM/Mozilla) rejette l'envoi avec un 403.
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

// Normalise le sujet VAPID : doit être une URL mailto: ou https:. Un email nu est
// automatiquement préfixé par mailto: (erreur de configuration très fréquente).
function normalizeSubject(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "mailto:admin@example.com";
  if (s.startsWith("mailto:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  return `mailto:${s}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Secrets VAPID — on retire tout espace / retour-ligne parasite (cause classique de crash
  // quand le secret a été collé/importé depuis un fichier).
  const VAPID_PUBLIC_KEY = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  const VAPID_SUBJECT = normalizeSubject(Deno.env.get("VAPID_SUBJECT") ?? "");
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "vapid_not_configured", hint: "Définir VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans les secrets." }, 500);
  }

  // ⚠ setVapidDetails valide le format des clés et du sujet : on l'encapsule pour
  // renvoyer une erreur claire au lieu de crasher (500 générique).
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    return json({
      error: "vapid_setup_failed",
      detail: String((e as Error)?.message ?? e),
      subject: VAPID_SUBJECT,
      publicKeyLen: VAPID_PUBLIC_KEY.length,
      privateKeyLen: VAPID_PRIVATE_KEY.length,
    }, 500);
  }

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
  const errors: Array<{ id: number; statusCode: number | null; body: string }> = [];

  await Promise.all(
    (subs ?? []).map(async (s: { id: number; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notif,
          // TTL : le service de push conserve la notif jusqu'à 24 h si l'appareil est
          // hors-ligne (ex. navigateur fermé) → livrée à la reconnexion. urgency high
          // pour réveiller les appareils en veille.
          { TTL: 24 * 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number })?.statusCode ?? null;
        const body = String((e as { body?: string })?.body ?? (e as Error)?.message ?? e).slice(0, 300);
        errors.push({ id: s.id, statusCode: code, body });
        if (code === 404 || code === 410) deadIds.push(s.id);
      }
    }),
  );

  if (deadIds.length) await supabase.from("push_subscriptions").delete().in("id", deadIds);

  // `found` = nombre d'abonnements ciblés ; `errors` = détail des échecs (ex. 403 = clés
  // front/serveur différentes, 401 = VAPID invalide).
  return json({ found: (subs ?? []).length, sent, failed, removed: deadIds.length, errors: errors.slice(0, 5) });
});
