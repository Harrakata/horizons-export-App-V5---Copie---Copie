import { createClient } from "npm:@supabase/supabase-js@2";

const TABLE_NAME = Deno.env.get("TABLE_NAME") ?? "cln_fnir_ccopeglob";

const POWERBI_ACCESS_TOKEN  = Deno.env.get("POWERBI_ACCESS_TOKEN");
const POWERBI_GROUP_ID      = Deno.env.get("POWERBI_GROUP_ID");
const POWERBI_DATASET_ID    = Deno.env.get("POWERBI_DATASET_ID");
const POWERBI_TENANT_ID     = Deno.env.get("POWERBI_TENANT_ID");
const POWERBI_CLIENT_ID     = Deno.env.get("POWERBI_CLIENT_ID");
const POWERBI_CLIENT_SECRET = Deno.env.get("POWERBI_CLIENT_SECRET");

// Default: sync last 3 months. Pass { days: N } in request body to override (max 365).
const DAYS_BACK_DEFAULT = 90;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PBRow = Record<string, any>;

function buildDaxQuery(year: number, month: number, day: number): string {
  return `
EVALUATE
SELECTCOLUMNS(
    FILTER(
        ALL('CLN_FNIR CCOPEGLOB'),
        NOT ISBLANK('CLN_FNIR CCOPEGLOB'[DATE_OP])
            && 'CLN_FNIR CCOPEGLOB'[DATE_OP] >= DATE(${year}, ${month}, ${day})
    ),
    "ID_CCOPEGLOB",      'CLN_FNIR CCOPEGLOB'[ID_CCOPEGLOB],
    "DATE_OP",           'CLN_FNIR CCOPEGLOB'[DATE_OP],
    "PREPOSE",           'CLN_FNIR CCOPEGLOB'[PREPOSE],
    "PARI",              'CLN_FNIR CCOPEGLOB'[PARI],
    "PDV",               'CLN_FNIR CCOPEGLOB'[PDV],
    "PDD",               'CLN_FNIR CCOPEGLOB'[PDD],
    "POS",               'CLN_FNIR CCOPEGLOB'[POS],
    "ATTRIB",            'CLN_FNIR CCOPEGLOB'[ATTRIB],
    "SITE",              'CLN_FNIR CCOPEGLOB'[SITE],
    "RESEAU",            'CLN_FNIR CCOPEGLOB'[RESEAU],
    "REF_CLIENT",        'CLN_FNIR CCOPEGLOB'[REF_CLIENT],
    "CLIENT",            'CLN_FNIR CCOPEGLOB'[CLIENT],
    "DATE_MOIS",         'CLN_FNIR CCOPEGLOB'[DATE_MOIS],
    "ORG",               'CLN_FNIR CCOPEGLOB'[ORG],
    "REUNION",           'CLN_FNIR CCOPEGLOB'[REUNION],
    "COURSE",            'CLN_FNIR CCOPEGLOB'[COURSE],
    "MT_VALID",          'CLN_FNIR CCOPEGLOB'[MT_VALID],
    "NB_VALID",          'CLN_FNIR CCOPEGLOB'[NB_VALID],
    "MT_PAYE",           'CLN_FNIR CCOPEGLOB'[MT_PAYE],
    "NB_PAYE",           'CLN_FNIR CCOPEGLOB'[NB_PAYE],
    "MT_PAYA",           'CLN_FNIR CCOPEGLOB'[MT_PAYA],
    "NB_PAYA",           'CLN_FNIR CCOPEGLOB'[NB_PAYA],
    "MT_TOTAL_ANUL",     'CLN_FNIR CCOPEGLOB'[MT_TOTAL_ANUL],
    "NB_TOTAL_ANUL",     'CLN_FNIR CCOPEGLOB'[NB_TOTAL_ANUL],
    "MT_TOTAL_ENJEUX",   'CLN_FNIR CCOPEGLOB'[MT_TOTAL_ENJEUX],
    "MT_TOTAL_GAIN",     'CLN_FNIR CCOPEGLOB'[MT_TOTAL_GAIN],
    "NB_TOTAL_TRANS",    'CLN_FNIR CCOPEGLOB'[NB_TOTAL_TRANS],
    "MT_TOTAL_IMPOT",    'CLN_FNIR CCOPEGLOB'[MT_TOTAL_IMPOT],
    "MT_TOTAL_REMBOUR",  'CLN_FNIR CCOPEGLOB'[MT_TOTAL_REMBOUR],
    "MT_ACM",            'CLN_FNIR CCOPEGLOB'[MT_ACM],
    "NB_ACM",            'CLN_FNIR CCOPEGLOB'[NB_ACM],
    "MT_ANCL",           'CLN_FNIR CCOPEGLOB'[MT_ANCL],
    "NB_ANCL",           'CLN_FNIR CCOPEGLOB'[NB_ANCL],
    "MT_ANEX",           'CLN_FNIR CCOPEGLOB'[MT_ANEX],
    "NB_ANEX",           'CLN_FNIR CCOPEGLOB'[NB_ANEX],
    "MT_ANMA",           'CLN_FNIR CCOPEGLOB'[MT_ANMA],
    "NB_ANMA",           'CLN_FNIR CCOPEGLOB'[NB_ANMA],
    "MT_ANSY",           'CLN_FNIR CCOPEGLOB'[MT_ANSY],
    "NB_ANSY",           'CLN_FNIR CCOPEGLOB'[NB_ANSY],
    "NB_VALIV_ANUL",     'CLN_FNIR CCOPEGLOB'[NB_VALIV_ANUL],
    "A VERSER",          'CLN_FNIR CCOPEGLOB'[A VERSER]
)
`;
}

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

async function fetchClientCredentialsToken() {
  if (!canUseClientCredentials()) return null;

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
    throw new Error(
      `Power BI token refresh error ${res.status}: ${payload?.error_description ?? payload?.error ?? "unknown error"}`
    );
  }

  return payload.access_token as string;
}

async function getPowerBITokenCandidates() {
  const tokens: Array<{ source: string; token: string }> = [];

  if (POWERBI_ACCESS_TOKEN) {
    tokens.push({ source: "POWERBI_ACCESS_TOKEN", token: POWERBI_ACCESS_TOKEN });
  }

  if (canUseClientCredentials()) {
    const clientToken = await fetchClientCredentialsToken();
    if (clientToken) tokens.push({ source: "client_credentials", token: clientToken });
  }

  if (!tokens.length) {
    throw new Error(
      "Missing env vars: POWERBI_ACCESS_TOKEN, or POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET"
    );
  }

  return tokens;
}

async function readPowerBIError(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return "";

  try {
    const payload = JSON.parse(text);
    const error = payload?.error;
    if (typeof error === "string") return error;
    return [error?.code, error?.message, payload?.message].filter(Boolean).join(" - ") || text;
  } catch {
    return text;
  }
}

function buildPowerBIErrorMessage(status: number, detail: string, source: string) {
  if (/TokenExpired|Access token has expired/i.test(detail)) {
    return "Power BI access token has expired. Update POWERBI_ACCESS_TOKEN or configure POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET.";
  }
  if (status === 401) {
    return `Power BI refused the token from ${source} (401). Details: ${detail || "empty response"}`;
  }
  if (status === 403) {
    return `Power BI refused access from ${source} (403). Check POWERBI_GROUP_ID, POWERBI_DATASET_ID and dataset permissions. Details: ${detail || "empty response"}`;
  }
  return `Power BI error ${status}: ${detail || "empty response"}`;
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

async function fetchPowerBIRows(daxQuery: string) {
  if (!POWERBI_GROUP_ID || !POWERBI_DATASET_ID) {
    throw new Error("Missing env vars: POWERBI_GROUP_ID, POWERBI_DATASET_ID");
  }

  const url = `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_GROUP_ID}/datasets/${POWERBI_DATASET_ID}/executeQueries`;
  const tokenCandidates = await getPowerBITokenCandidates();
  let lastError = "";

  for (let i = 0; i < tokenCandidates.length; i += 1) {
    const candidate = tokenCandidates[i];
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${candidate.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queries: [{ query: daxQuery }],
        serializerSettings: { includeNulls: true },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data?.results?.[0]?.tables?.[0]?.rows ?? [];
    }

    const detail = await readPowerBIError(res);
    lastError = buildPowerBIErrorMessage(res.status, detail, candidate.source);

    const canTryNextToken =
      i < tokenCandidates.length - 1
      && (res.status === 401 || res.status === 403 || /TokenExpired|Access token has expired/i.test(detail));

    if (!canTryNextToken) throw new Error(lastError);
  }

  throw new Error(lastError || "Power BI request failed.");
}

// UPSERT by id_ccopeglob — much faster than DELETE+INSERT per date
async function saveRows(supabaseClient: any, payload: any[]) {
  const CHUNK = 500;

  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .upsert(chunk, { onConflict: "id_ccopeglob", ignoreDuplicates: false });
    if (error) throw error;
  }

  return payload.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    }

    // Parse optional { days: N } from request body
    let daysBack = DAYS_BACK_DEFAULT;
    if (req.method === "POST") {
      try {
        const bodyText = await req.text();
        if (bodyText) {
          const body = JSON.parse(bodyText);
          if (body?.days && Number.isFinite(Number(body.days))) {
            daysBack = Math.min(Math.max(Number(body.days), 1), 365);
          }
        }
      } catch { /* ignore parse errors */ }
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startYear  = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const startDay   = startDate.getDate();

    console.log(`Syncing CCOPEGLOB from DATE(${startYear}, ${startMonth}, ${startDay}) [${daysBack} jours]`);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const daxQuery = buildDaxQuery(startYear, startMonth, startDay);
    const rows = await fetchPowerBIRows(daxQuery);

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ok: true, fetched: 0, upserted: 0 }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log("Exemple de clés Power BI:", Object.keys(rows[0]));

    const payload = rows
      .map((r: PBRow) => mapRow(r))
      .filter((r: any) => r.id_ccopeglob !== null);
    const skipped = rows.length - payload.length;

    if (skipped > 0) {
      console.warn(`${skipped} ligne(s) ignorée(s) car id_ccopeglob est null`);
    }

    const upserted = await saveRows(supabaseClient, payload);

    return new Response(
      JSON.stringify({ ok: true, fetched: rows.length, upserted, skipped }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
