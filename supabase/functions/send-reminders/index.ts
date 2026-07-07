// Edge Function : rappels planifiés (pointage guichetière + planning technicien).
//
// Déclenchée par pg_cron toutes les 5 min. À chaque exécution :
//   • Rappel POINTAGE : à l'heure de début d'un créneau, pousse aux guichetières
//     planifiées aujourd'hui qui n'ont PAS encore pointé ce créneau.
//   • Rappel PLANNING : LEAD minutes AVANT le début d'un créneau, pousse aux
//     techniciens ayant une intervention planifiée sur ce créneau aujourd'hui.
// Respecte les réglages globaux (app_settings/notification_settings) et réutilise
// l'Edge Function send-push pour l'envoi (logique VAPID centralisée).
//
// Les HORAIRES sont configurables SANS redéploiement via app_settings/reminder_config
// (éditables dans l'app : Exploitation → Notifications). Valeurs par défaut ci-dessous.
//
// Déploiement : supabase functions deploy send-reminders   (+ pg_cron)

import { createClient } from "npm:@supabase/supabase-js@2";

const WINDOW_MIN = 5; // = cadence du cron (chaque début tombe dans un seul créneau)
const NOTIFICATION_SETTINGS_KEY = "notification_settings";
const REMINDER_CONFIG_KEY = "reminder_config";

// Défauts (surchargés par app_settings/reminder_config).
const DEFAULTS = { tzOffsetHours: 0, planningLeadMin: 15, matinStart: "08:00", apresMidiStart: "14:00" };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const toMin = (hhmm: string) => { const [h, m] = String(hhmm).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const pad = (n: number) => String(n).padStart(2, "0");

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Réglages (toggles) + config horaires.
  const [{ data: setRow }, { data: cfgRow }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", NOTIFICATION_SETTINGS_KEY).maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", REMINDER_CONFIG_KEY).maybeSingle(),
  ]);
  const settings = (setRow?.value ?? {}) as Record<string, boolean>;
  const pointageOn = settings.rappel_pointage !== false;
  const planningOn = settings.rappel_planning !== false;

  const cfg = { ...DEFAULTS, ...((cfgRow?.value ?? {}) as Record<string, unknown>) };
  const TZ_OFFSET_HOURS = Number(cfg.tzOffsetHours ?? 0);
  const PLANNING_LEAD_MIN = Number(cfg.planningLeadMin ?? 15);
  const matinStart = String(cfg.matinStart || "08:00");
  const apresMidiStart = String(cfg.apresMidiStart || "14:00");

  const GUICHETIERE_CRENEAUX = [
    { index: 0, start: matinStart,     label: "du matin" },
    { index: 1, start: apresMidiStart, label: "de l'après-midi" },
  ];
  const MAINTENANCE_CRENEAUX = [
    { value: "matin",      start: matinStart,     label: "Matin" },
    { value: "apres_midi", start: apresMidiStart, label: "Après-midi" },
  ];

  // Heure LOCALE courante (minutes depuis minuit) + date du jour (YYYY-MM-DD).
  const now = new Date(Date.now() + TZ_OFFSET_HOURS * 3600 * 1000);
  const minutesOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const todayStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}`;

  const inWindow = (startMin: number) => minutesOfDay >= startMin && minutesOfDay < startMin + WINDOW_MIN;

  // Envoi mutualisé via send-push (réutilise la config VAPID).
  const sendPush = async (target: Record<string, string>, payload: Record<string, unknown>) => {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
        body: JSON.stringify({ target, payload }),
      });
    } catch { /* best-effort */ }
  };

  let pointageSent = 0;
  let planningSent = 0;

  // ── 1) Rappel POINTAGE : à l'heure de début d'un créneau ───────────────────
  if (pointageOn) {
    for (const cr of GUICHETIERE_CRENEAUX) {
      if (!inWindow(toMin(cr.start))) continue;
      const { data: planning } = await supabase.from("planning").select("guichetiereId").eq("date", todayStr);
      const ids = [...new Set((planning ?? []).map((p: { guichetiereId: unknown }) => p.guichetiereId).filter(Boolean))];
      if (!ids.length) continue;
      const { data: guichetieres } = await supabase.from("guichetieres").select("id, matricule").in("id", ids as string[]);
      const matricules = (guichetieres ?? []).map((g: { matricule: string }) => g.matricule).filter(Boolean);
      const { data: pointages } = await supabase.from("pointages")
        .select("guichetiereMatricule").eq("date", todayStr).eq("creneauIndex", cr.index).in("guichetiereMatricule", matricules);
      const pointed = new Set((pointages ?? []).map((p: { guichetiereMatricule: string }) => p.guichetiereMatricule));
      for (const g of (guichetieres ?? []) as Array<{ id: string; matricule: string }>) {
        if (pointed.has(g.matricule)) continue;
        await sendPush(
          { role: "guichetiere", user_id: String(g.id) },
          { title: "Rappel de pointage", body: `N'oubliez pas de pointer votre créneau ${cr.label}.`, url: "/pointage", tag: `rappel-pointage-${cr.index}` },
        );
        pointageSent++;
      }
    }
  }

  // ── 2) Rappel PLANNING : LEAD min avant le début d'un créneau ──────────────
  if (planningOn) {
    for (const cr of MAINTENANCE_CRENEAUX) {
      if (!inWindow(toMin(cr.start) - PLANNING_LEAD_MIN)) continue;
      const { data: rows } = await supabase.from("planning_maintenance")
        .select("technicien_id, agence_nom, creneau, statut, date_planification")
        .eq("creneau", cr.value).eq("statut", "planifiee")
        .gte("date_planification", todayStr).lt("date_planification", tomorrowStr);
      for (const r of (rows ?? []) as Array<{ technicien_id: string; agence_nom: string }>) {
        if (!r.technicien_id) continue;
        await sendPush(
          { role: "technicien", user_id: String(r.technicien_id) },
          { title: "Rappel d'intervention", body: `Intervention ${cr.label} — ${r.agence_nom || ""} dans ${PLANNING_LEAD_MIN} min.`.trim(), url: "/espace-technicien", tag: "rappel-planning" },
        );
        planningSent++;
      }
    }
  }

  return json({ ok: true, todayStr, minutesOfDay, config: { matinStart, apresMidiStart, PLANNING_LEAD_MIN, TZ_OFFSET_HOURS }, pointageOn, planningOn, pointageSent, planningSent });
});
