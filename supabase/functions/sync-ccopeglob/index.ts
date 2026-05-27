import { createClient } from "npm:@supabase/supabase-js@2";

const TABLE_NAME     = Deno.env.get("TABLE_NAME") ?? "cln_fnir_ccopeglob";
const RETENTION_DAYS = 180;
const TOPN_ROWS      = 100000; // limite API Power BI

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

// TOPN + SUMMARIZECOLUMNS sans FILTER : rapide, pas de scan complet de la table
// TOPN(100000, ..., DATE_OP, 0) retourne les 100 000 lignes les plus récentes
const DAX_QUERY = `
EVALUATE
TOPN(
    ${TOPN_ROWS},
    SUMMARIZECOLUMNS(
        'CLN_FNIR CCOPEGLOB'[ID_CCOPEGLOB],
        'CLN_FNIR CCOPEGLOB'[DATE_OP],
        'CLN_FNIR CCOPEGLOB'[ATTRIB],
        'CLN_FNIR CCOPEGLOB'[SITE],
        'CLN_FNIR CCOPEGLOB'[RESEAU],
        'CLN_FNIR CCOPEGLOB'[PDV],
        'CLN_FNIR CCOPEGLOB'[PDD],
        'CLN_FNIR CCOPEGLOB'[POS],
        'CLN_FNIR CCOPEGLOB'[PREPOSE],
        'CLN_FNIR CCOPEGLOB'[PARI],
        'CLN_FNIR CCOPEGLOB'[MT_VALID],
        'CLN_FNIR CCOPEGLOB'[NB_VALID],
        'CLN_FNIR CCOPEGLOB'[MT_PAYE],
        'CLN_FNIR CCOPEGLOB'[NB_PAYE],
        'CLN_FNIR CCOPEGLOB'[MT_PAYA],
        'CLN_FNIR CCOPEGLOB'[NB_PAYA],
        'CLN_FNIR CCOPEGLOB'[MT_TOTAL_ANUL],
        'CLN_FNIR CCOPEGLOB'[NB_TOTAL_ANUL],
        'CLN_FNIR CCOPEGLOB'[MT_TOTAL_ENJEUX],
        'CLN_FNIR CCOPEGLOB'[MT_TOTAL_GAIN],
        'CLN_FNIR CCOPEGLOB'[NB_TOTAL_TRANS],
        'CLN_FNIR CCOPEGLOB'[MT_TOTAL_IMPOT],
        'CLN_FNIR CCOPEGLOB'[MT_TOTAL_REMBOUR],
        'CLN_FNIR CCOPEGLOB'[MT_ACM],
        'CLN_FNIR CCOPEGLOB'[NB_ACM],
        'CLN_FNIR CCOPEGLOB'[REF_CLIENT],
        'CLN_FNIR CCOPEGLOB'[CLIENT],
        'CLN_FNIR CCOPEGLOB'[MT_ANCL],
        'CLN_FNIR CCOPEGLOB'[NB_ANCL],
        'CLN_FNIR CCOPEGLOB'[MT_ANEX],
        'CLN_FNIR CCOPEGLOB'[NB_ANEX],
        'CLN_FNIR CCOPEGLOB'[MT_ANMA],
        'CLN_FNIR CCOPEGLOB'[NB_ANMA],
        'CLN_FNIR CCOPEGLOB'[MT_ANSY],
        'CLN_FNIR CCOPEGLOB'[NB_ANSY],
        'CLN_FNIR CCOPEGLOB'[DATE_MOIS],
        'CLN_FNIR CCOPEGLOB'[NB_VALIV_ANUL],
        'CLN_FNIR CCOPEGLOB'[A VERSER],
        'CLN_FNIR CCOPEGLOB'[ORG],
        'CLN_FNIR CCOPEGLOB'[REUNION],
        'CLN_FNIR CCOPEGLOB'[COURSE]
    ),
    'CLN_FNIR CCOPEGLOB'[DATE_OP], 0
)
`;

function getValue(r: PBRow, column: string) {
  return r[column]
    ?? r[`CLN_FNIR CCOPEGLOB[${column}]`]
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
    grant_type: "client_credentials",
    client_id: POWERBI_CLIENT_ID!,
    client_secret: POWERBI_CLIENT_SECRET!,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.access_token) {
    throw new Error(`Power BI token refresh error ${res.status}: ${payload?.error_description ?? payload?.error ?? "unknown"}`);
  }
  return payload.access_token as string;
}

async function getPowerBITokenCandidates() {
  const tokens: Array<{ source: string; token: string }> = [];

  // Priorité 1 : client credentials → token frais à chaque appel, jamais expiré
  if (canUseClientCredentials()) {
    const t = await fetchClientCredentialsToken();
    if (t) tokens.push({ source: "client_credentials", token: t });
  }

  // Priorité 2 : token statique (fallback si pas de client credentials)
  if (POWERBI_ACCESS_TOKEN) tokens.push({ source: "POWERBI_ACCESS_TOKEN", token: POWERBI_ACCESS_TOKEN });

  if (!tokens.length) throw new Error("Missing env vars: POWERBI_ACCESS_TOKEN, or POWERBI_TENANT_ID + POWERBI_CLIENT_ID + POWERBI_CLIENT_SECRET");
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
    return "Power BI access token has expired. Update POWERBI_ACCESS_TOKEN or configure client credentials.";
  if (status === 401) return `Power BI refused the token (401) from ${source}. Details: ${detail || "empty"}`;
  if (status === 403) return `Power BI refused access (403) from ${source}. Check POWERBI_GROUP_ID, POWERBI_DATASET_ID and permissions. Details: ${detail || "empty"}`;
  return `Power BI error ${status}: ${detail || "empty"}`;
}

function mapRow(r: PBRow) {
  return {
    id_ccopeglob:     normalizeText(getValue(r, "ID_CCOPEGLOB")),
    date_op:          normalizeTimestamp(getValue(r, "DATE_OP")),
    attrib:           normalizeText(getValue(r, "ATTRIB")),
    site:             normalizeText(getValue(r, "SITE")),
    reseau:           normalizeText(getValue(r, "RESEAU")),
    pdv:              normalizeText(getValue(r, "PDV")),
    pdd:              normalizeText(getValue(r, "PDD")),
    pos:              normalizeText(getValue(r, "POS")),
    prepose:          normalizeText(getValue(r, "PREPOSE")),
    pari:             normalizeText(getValue(r, "PARI")),
    mt_valid:         normalizeNumber(getValue(r, "MT_VALID")),
    nb_valid:         normalizeNumber(getValue(r, "NB_VALID")),
    mt_paye:          normalizeNumber(getValue(r, "MT_PAYE")),
    nb_paye:          normalizeNumber(getValue(r, "NB_PAYE")),
    mt_paya:          normalizeNumber(getValue(r, "MT_PAYA")),
    nb_paya:          normalizeNumber(getValue(r, "NB_PAYA")),
    mt_total_anul:    normalizeNumber(getValue(r, "MT_TOTAL_ANUL")),
    nb_total_anul:    normalizeNumber(getValue(r, "NB_TOTAL_ANUL")),
    mt_total_enjeux:  normalizeNumber(getValue(r, "MT_TOTAL_ENJEUX")),
    mt_total_gain:    normalizeNumber(getValue(r, "MT_TOTAL_GAIN")),
    nb_total_trans:   normalizeNumber(getValue(r, "NB_TOTAL_TRANS")),
    mt_total_impot:   normalizeNumber(getValue(r, "MT_TOTAL_IMPOT")),
    mt_total_rembour: normalizeNumber(getValue(r, "MT_TOTAL_REMBOUR")),
    mt_acm:           normalizeNumber(getValue(r, "MT_ACM")),
    nb_acm:           normalizeNumber(getValue(r, "NB_ACM")),
    ref_client:       normalizeText(getValue(r, "REF_CLIENT")),
    client:           normalizeText(getValue(r, "CLIENT")),
    mt_ancl:          normalizeNumber(getValue(r, "MT_ANCL")),
    nb_ancl:          normalizeNumber(getValue(r, "NB_ANCL")),
    mt_anex:          normalizeNumber(getValue(r, "MT_ANEX")),
    nb_anex:          normalizeNumber(getValue(r, "NB_ANEX")),
    mt_anma:          normalizeNumber(getValue(r, "MT_ANMA")),
    nb_anma:          normalizeNumber(getValue(r, "NB_ANMA")),
    mt_ansy:          normalizeNumber(getValue(r, "MT_ANSY")),
    nb_ansy:          normalizeNumber(getValue(r, "NB_ANSY")),
    date_mois:        normalizeTimestamp(getValue(r, "DATE_MOIS")),
    nb_valiv_anul:    normalizeNumber(getValue(r, "NB_VALIV_ANUL")),
    a_verser:         normalizeNumber(getValue(r, "A VERSER")),
    org:              normalizeText(getValue(r, "ORG")),
    reunion:          normalizeText(getValue(r, "REUNION")),
    course:           normalizeText(getValue(r, "COURSE")),
  };
}

async function fetchPowerBIRows() {
  if (!POWERBI_GROUP_ID || !POWERBI_DATASET_ID) throw new Error("Missing env vars: POWERBI_GROUP_ID, POWERBI_DATASET_ID");
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_GROUP_ID}/datasets/${POWERBI_DATASET_ID}/executeQueries`;
  const tokenCandidates = await getPowerBITokenCandidates();
  let lastError = "";

  for (let i = 0; i < tokenCandidates.length; i++) {
    const { source, token } = tokenCandidates[i];

    // Timeout 25 s pour éviter un EarlyDrop de Supabase
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 25000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ queries: [{ query: DAX_QUERY }], serializerSettings: { includeNulls: true } }),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(tid);
      if (e?.name === "AbortError") throw new Error("Power BI API timeout (>25s). Dataset may be too large or unresponsive.");
      throw e;
    }
    clearTimeout(tid);

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

async function purgeOldRows(supabaseClient: any): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoff.toISOString().substring(0, 10) + "T00:00:00.000Z";
  const { count, error } = await supabaseClient.from(TABLE_NAME).delete({ count: "exact" }).lt("date_op", cutoffISO);
  if (error) throw error;
  return count ?? 0;
}

async function saveRows(supabaseClient: any, payload: any[]) {
  const CHUNK = 1000; // chunks plus grands = moins de round-trips
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .upsert(payload.slice(i, i + CHUNK), { onConflict: "id_ccopeglob", ignoreDuplicates: false });
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (req.method !== "POST" && req.method !== "GET")
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log(`Syncing CCOPEGLOB — TOPN(${TOPN_ROWS}) most recent rows, no date filter`);

    const [rows, purged] = await Promise.all([
      fetchPowerBIRows(),
      purgeOldRows(supabaseClient),
    ]);

    console.log(`Power BI returned ${rows.length} rows. Exemple de clés:`, rows[0] ? Object.keys(rows[0]) : []);

    const payload = rows
      .map((r: PBRow) => mapRow(r))
      .filter((r: any) => r.id_ccopeglob !== null);
    const skipped = rows.length - payload.length;
    if (skipped > 0) console.warn(`${skipped} ligne(s) ignorée(s) (id_ccopeglob null)`);

    await saveRows(supabaseClient, payload);

    return new Response(
      JSON.stringify({ ok: true, fetched: rows.length, upserted: payload.length, skipped, purged }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("Sync error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
