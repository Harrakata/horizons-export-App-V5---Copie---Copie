// Edge Function : notification SMS du parieur (paiement de gain) via Twilio.
//
// Rôle :
//   À partir d'un identifiant de demande et d'un évènement de workflow,
//   recharge la demande côté serveur (source de vérité), construit le message
//   approprié, l'envoie par SMS via l'API Twilio, puis journalise le résultat
//   dans la table paiement_gain_sms_notifications.
//
// Sécurité :
//   1. L'appelant doit posséder un JWT Supabase valide (utilisateur connecté).
//   2. Les secrets Twilio et la service_role ne vivent QUE côté serveur.
//
// Corps attendu (POST JSON) :
//   { "demandeId": <number>, "event": "authorized" | "rejected" | "paid" }
//
// Variables d'environnement requises :
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   (déjà fournies par Supabase)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN                         (compte Twilio)
//   TWILIO_FROM            → numéro expéditeur (ex: +1xxxxxxxxxx) OU
//   TWILIO_MESSAGING_SID   → Messaging Service SID (alternative à TWILIO_FROM)
//   SMS_DEFAULT_COUNTRY_CODE (optionnel, défaut "+226") → préfixe ajouté aux
//                          numéros locaux saisis sans indicatif international.
//
// Déploiement :
//   supabase functions deploy notify-parieur-sms
//   supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+1...

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_EVENTS = ["authorized", "rejected", "paid"] as const;
type SmsEvent = (typeof VALID_EVENTS)[number];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Normalise un numéro local vers le format E.164 attendu par Twilio.
// - garde les numéros déjà au format international (+...)
// - sinon ajoute l'indicatif pays par défaut, en retirant un éventuel 0 initial.
function normalizePhone(raw: string, defaultCountryCode: string): string | null {
  if (!raw) return null;
  let value = String(raw).trim().replace(/[\s().-]/g, "");
  if (!value) return null;

  if (value.startsWith("+")) {
    return /^\+\d{6,15}$/.test(value) ? value : null;
  }
  if (value.startsWith("00")) {
    value = "+" + value.slice(2);
    return /^\+\d{6,15}$/.test(value) ? value : null;
  }
  // Numéro local : on retire un 0 de tête puis on préfixe l'indicatif pays.
  value = value.replace(/^0+/, "");
  const candidate = `${defaultCountryCode}${value}`;
  return /^\+\d{6,15}$/.test(candidate) ? candidate : null;
}

function formatAmount(amount: unknown): string {
  const numeric = Number(amount ?? 0);
  if (!Number.isFinite(numeric)) return String(amount ?? "");
  return `${numeric.toLocaleString("fr-FR")} F CFA`;
}

function buildMessage(event: SmsEvent, demande: Record<string, any>): string {
  const prenom = demande.prenomGagnant ? String(demande.prenomGagnant).trim() : "";
  const civilite = prenom ? `${prenom}, ` : "";
  const montant = formatAmount(demande.montantGain);
  const code = demande.codeDemande || "";
  const agence = demande.agencePaiementNom || "l'agence désignée";

  switch (event) {
    case "authorized":
      return (
        `${civilite}votre gain de ${montant} (demande ${code}) est autorisé. ` +
        `Vous pouvez vous faire payer à l'agence ${agence}. ` +
        `Munissez-vous de votre pièce d'identité et de votre ticket.`
      );
    case "paid":
      return (
        `${civilite}le paiement de votre gain de ${montant} (demande ${code}) a bien été effectué ` +
        `à l'agence ${agence}. Merci de votre confiance.`
      );
    case "rejected":
      return (
        `${civilite}votre demande de paiement de gain ${code} n'a pas pu être validée. ` +
        `Veuillez vous rapprocher de votre agence pour plus d'informations.`
      );
  }
}

async function sendTwilioSms(params: {
  accountSid: string;
  authToken: string;
  to: string;
  body: string;
  from?: string;
  messagingServiceSid?: string;
}): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("Body", params.body);
  if (params.messagingServiceSid) {
    form.set("MessagingServiceSid", params.messagingServiceSid);
  } else if (params.from) {
    form.set("From", params.from);
  }

  const authHeader = "Basic " + btoa(`${params.accountSid}:${params.authToken}`);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: payload?.message || `Twilio HTTP ${resp.status}` };
  }
  return { ok: true, sid: payload?.sid };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Edge Function mal configurée : variables Supabase manquantes." }, 500);
    }

    // 1) Authentification de l'appelant ------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header manquant" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return jsonResponse({ error: "Session invalide" }, 401);

    // 2) Validation de l'entrée --------------------------------------------
    const body = await req.json().catch(() => null);
    const demandeId = body?.demandeId;
    const event = body?.event as SmsEvent;
    if (!demandeId) return jsonResponse({ error: "demandeId requis" }, 400);
    if (!VALID_EVENTS.includes(event)) {
      return jsonResponse({ error: `event invalide (attendu: ${VALID_EVENTS.join(", ")})` }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3) Rechargement de la demande (source de vérité) ---------------------
    const { data: demande, error: demandeErr } = await adminClient
      .from("demandes_paiement_gain")
      .select(
        'id, "codeDemande", "montantGain", "prenomGagnant", "nomGagnant", ' +
          '"telephoneGagnant", "agencePaiementNom"',
      )
      .eq("id", demandeId)
      .maybeSingle();

    if (demandeErr) return jsonResponse({ error: demandeErr.message }, 400);
    if (!demande) return jsonResponse({ error: "Demande introuvable" }, 404);

    const message = buildMessage(event, demande);
    const defaultCountryCode = Deno.env.get("SMS_DEFAULT_COUNTRY_CODE") || "+226";
    const toNumber = normalizePhone(demande.telephoneGagnant || "", defaultCountryCode);

    const logRow = {
      demandeId: demande.id,
      codeDemande: demande.codeDemande,
      event,
      destinataire: toNumber,
      message,
    };

    // Pas de numéro exploitable → on journalise "skipped" sans échouer l'appel.
    if (!toNumber) {
      await adminClient.from("paiement_gain_sms_notifications").insert({
        ...logRow,
        statut: "skipped",
        error: "Numéro de téléphone du gagnant absent ou invalide.",
      });
      return jsonResponse({ ok: false, skipped: true, reason: "no_phone" });
    }

    // 4) Envoi via Twilio --------------------------------------------------
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM");
    const TWILIO_MESSAGING_SID = Deno.env.get("TWILIO_MESSAGING_SID");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_FROM && !TWILIO_MESSAGING_SID)) {
      await adminClient.from("paiement_gain_sms_notifications").insert({
        ...logRow,
        statut: "failed",
        error: "Configuration Twilio incomplète (SID/token/expéditeur manquants).",
      });
      return jsonResponse({ error: "Configuration Twilio incomplète côté serveur." }, 500);
    }

    const result = await sendTwilioSms({
      accountSid: TWILIO_ACCOUNT_SID,
      authToken: TWILIO_AUTH_TOKEN,
      to: toNumber,
      body: message,
      from: TWILIO_FROM,
      messagingServiceSid: TWILIO_MESSAGING_SID,
    });

    await adminClient.from("paiement_gain_sms_notifications").insert({
      ...logRow,
      statut: result.ok ? "sent" : "failed",
      provider_sid: result.sid || null,
      error: result.ok ? null : result.error,
    });

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 502);
    }
    return jsonResponse({ ok: true, sid: result.sid });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("notify-parieur-sms error:", errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
