import { createClient } from "npm:@supabase/supabase-js@2";

const TABLE_NAME     = Deno.env.get("TABLE_NAME") ?? "vue_cln_fnir_ccope";
const RETENTION_DAYS = 180; // 6 mois de stockage dans Supabase
const REFRESH_DAYS   = 30;  // fenêtre incrémentielle par défaut (1 mois)
const CHUNK_DAYS     = 6;   // taille de chaque tranche de requête Power BI

const POWERBI_ACCESS_TOKEN  = Deno.env.get("POWERBI_ACCESS_TOKEN");
const POWERBI_GROUP_ID      = Deno.env.get("POWERBI_GROUP_ID");
const POWERBI_DATASET_ID    = Deno.env.get("POWERBI_DATASET_ID");
const POWERBI_TENANT_ID     = Deno.env.get("POWERBI_TENANT_ID");
const POWERBI_CLIENT_ID     = Deno.env.get("POWERBI_CLIENT_ID");
const POWERBI_CLIENT_SECRET = Deno.env.get("POWERBI_CLIENT_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PBRow = Record<string, any>;

// ─── DAX ─────────────────────────────────────────────────────────────────────

function buildDaxQuery(
  startYear: number, startMonth: number, startDay: number,
  endYear?: number, endMonth?: number, endDay?: number
): string {
  const upperBound = endYear !== undefined
    ? `&& 'CLN_FNIR CCOPE'[DATE_OP] < DATE(${endYear}, ${endMonth}, ${endDay})`
    : "";
  return `
EVALUATE
SELECTCOLUMNS(
    TOPN(
        100000,
        FILTER(
            ALL('CLN_FNIR CCOPE'),
            NOT ISBLANK('CLN_FNIR CCOPE'[DATE_OP])
                && 'CLN_FNIR CCOPE'[DATE_OP] >= DATE(${startYear}, ${startMonth}, ${startDay})
                ${upperBound}
        ),
        'CLN_FNIR CCOPE'[DATE_OP], 0
    ),
    "DATE_OP",    'CLN_FNIR CCOPE'[DATE_OP],
    "OPERATEUR",  'CLN_FNIR CCOPE'[OPERATEUR],
    "NATURE_T",   'CLN_FNIR CCOPE'[NATURE_T],
    "CLIENT",     'CLN_FNIR CCOPE'[CLIENT],
    "ID_CCOPE",   'CLN_FNIR CCOPE'[ID_CCOPE],
    "MT.ENR",     'CLN_FNIR CCOPE'[MT.ENR],
    "NT.ENR",     'CLN_FNIR CCOPE'[NT.ENR],
    "MT.ANC",     'CLN_FNIR CCOPE'[MT.ANC],
    "NT.ANC",     'CLN_FNIR CCOPE'[NT.ANC],
    "MT.ANE",     'CLN_FNIR CCOPE'[MT.ANE],
    "NT.ANE",     'CLN_FNIR CCOPE'[NT.ANE],
    "MT.ANM",     'CLN_FNIR CCOPE'[MT.ANM],
    "NT.ANM",     'CLN_FNIR CCOPE'[NT.ANM],
    "MT.ANS",     'CLN_FNIR CCOPE'[MT.ANS],
    "NT.ANS",     'CLN_FNIR CCOPE'[NT.ANS],
    "MT.PAY",     'CLN_FNIR CCOPE'[MT.PAY],
    "NT.PAY",     'CLN_FNIR CCOPE'[NT.PAY],
    "MT.ACM",     'CLN_FNIR CCOPE'[MT.ACM],
    "NT.ACM",     'CLN_FNIR CCOPE'[NT.ACM],
    "MT.PAM",     'CLN_FNIR CCOPE'[MT.PAM],
    "NT.PAM",     'CLN_FNIR CCOPE'[NT.PAM],
    "M_AVANCE",   'CLN_FNIR CCOPE'[M_AVANCE],
    "M_RETRAIT",  'CLN_FNIR CCOPE'[M_RETRAIT]
)
`;
}

// ─── Normalisation ───────────────────────────────────────────────────────────

function getValue(r: PBRow, column: string) {
  return r[column]
    ?? r[`CLN_FNIR CCOPE[${column}]`]
    ?? r[`[${column}]`]
    ?? null;
}

function normalizeText(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return String(v);
}

function normalizeTimestamp(v: any) {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeNumber(v: any) {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

function mapRow(r: PBRow, idx: number) {
  const dateOp = normalizeTimestamp(getValue(r, "DATE_OP"));
  const dateKey = dateOp
    ? dateOp.substring(0, 10).replace(/-/g, "")
    : new Date().toISOString().substring(0, 10).replace(/-/g, "");
  const id_ccope = `${dateKey}_${String(idx).padStart(7, "0")}`;

  return {
    id_ccope,
    date_op:   dateOp,
    operateur: normalizeText(getValue(r, "OPERATEUR")),
    nature_t:  normalizeText(getValue(r, "NATURE_T")),
    client:    normalizeText(getValue(r, "CLIENT")),
    ref_ccope: normalizeText(getValue(r, "ID_CCOPE")),
    mt_enr:    normalizeNumber(getValue(r, "MT.ENR")),
    nt_enr:    normalizeNumber(getValue(r, "NT.ENR")),
    mt_anc:    normalizeNumber(getValue(r, "MT.ANC")),
    nt_anc:    normalizeNumber(getValue(r, "NT.ANC")),
    mt_ane:    normalizeNumber(getValue(r, "MT.ANE")),
    nt_ane:    normalizeNumber(getValue(r, "NT.ANE")),
    mt_anm:    normalizeNumber(getValue(r, "MT.ANM")),
    nt_anm:    normalizeNumber(getValue(r, "NT.ANM")),
    mt_ans:    normalizeNumber(getValue(r, "MT.ANS")),
    nt_ans:    normalizeNumber(getValue(r, "NT.ANS")),
    mt_pay:    normalizeNumber(getValue(r, "MT.PAY")),
    nt_pay:    normalizeNumber(getValue(r, "NT.PAY")),
    mt_acm:    normalizeNumber(getValue(r, "MT.ACM")),
    nt_acm:    normalizeNumber(getValue(r, "NT.ACM")),
    mt_pam:    normalizeNumber(getValue(r, "MT.PAM")),
    nt_pam:    normalizeNumber(getValue(r, "NT.PAM")),
    m_avance:  normalizeNumber(getValue(r, "M_AVANCE")),
    m_retrait: normalizeNumber(getValue(r, "M_RETRAIT")),
  };
}

// ─── Token Power BI ──────────────────────────────────────────────────────────

function canUseClientCredentials() {
  return Boolean(POWERBI_TENANT_ID && POWERBI_CLIENT_ID && POWERBI_CLIENT_SECRET);
}

// Garde-fou : un GUID Azure AD a strictement le format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars).
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function validateAzureSecrets() {
  const problems: string[] = [];
  const t = (POWERBI_TENANT_ID ?? '').trim();
  const c = (POWERBI_CLIENT_ID ?? '').trim();
  const s = (POWERBI_CLIENT_SECRET ?? '').trim();
  if (!t) problems.push('POWERBI_TENANT_ID est vide');
  else if (!GUID_RE.test(t)) problems.push(`POWERBI_TENANT_ID = "${t}" — format GUID Azure AD invalide (attendu : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)`);
  if (!c) problems.push('POWERBI_CLIENT_ID est vide');
  else if (!GUID_RE.test(c)) problems.push(`POWERBI_CLIENT_ID = "${c}" — format GUID Azure AD invalide (attendu : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Copiez la valeur "Application (client) ID" depuis Azure Portal → Entra ID → App registrations.`);
  if (!s) problems.push('POWERBI_CLIENT_SECRET est vide');
  else if (s.length < 20) problems.push(`POWERBI_CLIENT_SECRET semble tronqué (${s.length} caractères)`);
  if (problems.length > 0) {
    throw new Error('Configuration Azure AD invalide. ' + problems.join(' · '));
  }
}

async function fetchClientCredentialsToken() {
  if (!canUseClientCredentials()) return null;
  validateAzureSecrets();
  const tokenUrl = `https://login.microsoftonline.com/${POWERBI_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     POWERBI_CLIENT_ID!,
    client_secret: POWERBI_CLIENT_SECRET!,
    scope:         "https://analysis.windows.net/powerbi/api/.default",
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.access_token) {
    throw new Error(
      `Power BI token refresh error ${res.status}: ${payload?.error_description ?? payload?.error ?? "unknown"}`
    );
  }
  return payload.access_token as string;
}

async function getPowerBITokenCandidates() {
  const tokens: Array<{ source: string; token: string }> = [];
  if (POWERBI_ACCESS_TOKEN) tokens.push({ source: "POWERBI_ACCESS_TOKEN", token: POWERBI_ACCESS_TOKEN });
  if (canUseClientCredentials()) {
    const t = await fetchClientCredentialsToken();
    if (t) tokens.push({ source: "client_credentials", token: t });
  }
  if (!tokens.length) {
    throw new Error("Missing env vars: POWERBI_ACCESS_TOKEN, or POWERBI_TENANT_ID + POWERBI_CLIENT_ID + POWERBI_CLIENT_SECRET");
  }
  return tokens;
}

async function readPowerBIError(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  try {
    const p = JSON.parse(text);
    const e = p?.error;
    if (typeof e === "string") return e;
    return [e?.code, e?.message, p?.message].filter(Boolean).join(" - ") || text;
  } catch { return text; }
}

function buildPowerBIErrorMessage(status: number, detail: string, source: string) {
  if (/TokenExpired|Access token has expired/i.test(detail))
    return "Le jeton Power BI a expiré. Mettez à jour POWERBI_ACCESS_TOKEN ou configurez POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET.";
  if (status === 401) return `Power BI a refusé le token de ${source} (401). Détail : ${detail || "réponse vide"}`;
  if (status === 403) return `Power BI a refusé l'accès de ${source} (403). Vérifiez POWERBI_GROUP_ID, POWERBI_DATASET_ID. Détail : ${detail || "réponse vide"}`;
  return `Power BI erreur ${status} : ${detail || "réponse vide"}`;
}

// ─── Appel Power BI ──────────────────────────────────────────────────────────

async function fetchPowerBIRows(daxQuery: string) {
  if (!POWERBI_GROUP_ID || !POWERBI_DATASET_ID) {
    throw new Error("Missing env vars: POWERBI_GROUP_ID, POWERBI_DATASET_ID");
  }
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_GROUP_ID}/datasets/${POWERBI_DATASET_ID}/executeQueries`;
  const tokenCandidates = await getPowerBITokenCandidates();
  let lastError = "";

  for (let i = 0; i < tokenCandidates.length; i++) {
    const { source, token } = tokenCandidates[i];
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ queries: [{ query: daxQuery }], serializerSettings: { includeNulls: true } }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.results?.[0]?.tables?.[0]?.rows ?? [];
    }
    const detail = await readPowerBIError(res);
    lastError = buildPowerBIErrorMessage(res.status, detail, source);
    const canTryNext = i < tokenCandidates.length - 1
      && (res.status === 401 || res.status === 403 || /TokenExpired|Access token has expired/i.test(detail));
    if (!canTryNext) throw new Error(lastError);
  }
  throw new Error(lastError || "Power BI request failed.");
}

// ─── Sauvegarde (DELETE par date + INSERT) ───────────────────────────────────

async function saveRows(supabaseClient: any, payload: any[]) {
  const CHUNK = 500;

  const dates = [...new Set(
    payload.map((r) => r.date_op ? r.date_op.substring(0, 10) : null).filter((d): d is string => d !== null)
  )];

  for (const date of dates) {
    const nextDate = new Date(new Date(date + "T00:00:00Z").getTime() + 86_400_000)
      .toISOString().substring(0, 10);
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .delete()
      .gte("date_op", `${date}T00:00:00.000Z`)
      .lt("date_op",  `${nextDate}T00:00:00.000Z`);
    if (error) throw error;
  }

  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await supabaseClient.from(TABLE_NAME).insert(payload.slice(i, i + CHUNK));
    if (error) throw error;
  }

  return payload.length;
}

// ─── Purge données anciennes (> 6 mois) ──────────────────────────────────────

async function purgeOldRows(supabaseClient: any): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoff.toISOString().substring(0, 10) + "T00:00:00.000Z";
  const { count, error } = await supabaseClient
    .from(TABLE_NAME)
    .delete({ count: "exact" })
    .lt("date_op", cutoffISO);
  if (error) throw error;
  return count ?? 0;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    const supabaseUrl            = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    }

    // Paramètres optionnels dans le body :
    // { full: true }  → charge historique complète sur 6 mois (RETENTION_DAYS)
    // { days: N }     → fenêtre personnalisée (1–180 jours)
    // (défaut)        → actualisation incrémentielle sur 1 semaine (REFRESH_DAYS)
    let daysBack = REFRESH_DAYS;
    if (req.method === "POST") {
      try {
        const bodyText = await req.text();
        if (bodyText) {
          const body = JSON.parse(bodyText);
          if (body?.full === true) {
            daysBack = RETENTION_DAYS;
          } else if (body?.days && Number.isFinite(Number(body.days))) {
            daysBack = Math.min(Math.max(Number(body.days), 1), RETENTION_DAYS);
          }
        }
      } catch { /* body absent ou invalide */ }
    }

    console.log(`Syncing CCOPE [${daysBack} jours] en chunks de ${CHUNK_DAYS} jours`);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const purged = await purgeOldRows(supabaseClient);

    // Découpage en tranches pour éviter la limite 100 000 lignes de l'API Power BI
    const today = new Date();
    let totalFetched = 0;
    let totalUpserted = 0;
    let rowIndex = 0;
    let firstRowKeys: string[] | null = null;

    for (let offset = 0; offset < daysBack; offset += CHUNK_DAYS) {
      const chunkSize = Math.min(CHUNK_DAYS, daysBack - offset);

      // borne haute exclusive : +1 pour inclure le jour "offset" (ex: offset=0 → inclut aujourd'hui)
      const chunkEnd = new Date(today);
      chunkEnd.setDate(today.getDate() - offset + 1);

      // borne basse inclusive : pas de trou entre deux chunks adjacents
      const chunkStart = new Date(today);
      chunkStart.setDate(today.getDate() - (offset + chunkSize - 1));

      const daxQuery = buildDaxQuery(
        chunkStart.getFullYear(), chunkStart.getMonth() + 1, chunkStart.getDate(),
        chunkEnd.getFullYear(),   chunkEnd.getMonth()   + 1, chunkEnd.getDate()
      );

      console.log(`Chunk [${chunkStart.toISOString().substring(0, 10)} → ${chunkEnd.toISOString().substring(0, 10)}]`);

      const rows = await fetchPowerBIRows(daxQuery);
      if (!rows.length) continue;

      if (!firstRowKeys) firstRowKeys = Object.keys(rows[0]);

      const payload = rows.map((r: PBRow, i: number) => mapRow(r, rowIndex + i));
      rowIndex += rows.length;

      await saveRows(supabaseClient, payload);
      totalFetched  += rows.length;
      totalUpserted += payload.length;
    }

    if (firstRowKeys) console.log("Exemple de clés Power BI :", firstRowKeys);

    return new Response(
      JSON.stringify({ ok: true, fetched: totalFetched, upserted: totalUpserted, purged }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
