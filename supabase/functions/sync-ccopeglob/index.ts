import { createClient } from "npm:@supabase/supabase-js@2";

const TABLE_NAME = Deno.env.get("TABLE_NAME") ?? "cln_fnir_ccopeglob";

const POWERBI_ACCESS_TOKEN = Deno.env.get("POWERBI_ACCESS_TOKEN");
const POWERBI_GROUP_ID = Deno.env.get("POWERBI_GROUP_ID");
const POWERBI_DATASET_ID = Deno.env.get("POWERBI_DATASET_ID");
const POWERBI_TENANT_ID = Deno.env.get("POWERBI_TENANT_ID");
const POWERBI_CLIENT_ID = Deno.env.get("POWERBI_CLIENT_ID");
const POWERBI_CLIENT_SECRET = Deno.env.get("POWERBI_CLIENT_SECRET");

const DAX_QUERY = `
EVALUATE
SUMMARIZECOLUMNS(
    'CLN_FNIR CCOPEGLOB'[DATE_OP],
    'CLN_FNIR CCOPEGLOB'[PREPOSE],
    'CLN_FNIR CCOPEGLOB'[PARI],
    'CLN_FNIR CCOPEGLOB'[PDV],
    'CLN_FNIR CCOPEGLOB'[PDD],
    'CLN_FNIR CCOPEGLOB'[POS],
    'CLN_FNIR CCOPEGLOB'[ATTRIB],
    'CLN_FNIR CCOPEGLOB'[SITE],
    'CLN_FNIR CCOPEGLOB'[RESEAU],
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
    'CLN_FNIR CCOPEGLOB'[COURSE],
    FILTER(
        ALL('CLN_FNIR CCOPEGLOB'),
        'CLN_FNIR CCOPEGLOB'[DATE_OP] >= EDATE(TODAY(), -3)
    )
)
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PBRow = Record<string, any>;

function getValue(r: PBRow, column: string) {
  return r[column] ?? r[`CLN_FNIR CCOPEGLOB[${column}]`];
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

async function fetchPowerBIAccessToken() {
  if (canUseClientCredentials()) {
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

  if (!POWERBI_ACCESS_TOKEN) {
    throw new Error(
      "Missing env vars: POWERBI_ACCESS_TOKEN, or POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET"
    );
  }

  return POWERBI_ACCESS_TOKEN;
}

function mapRow(r: PBRow, idx: number) {
  const dateOp = normalizeTimestamp(getValue(r, "DATE_OP"));

  // Clé : date + index séquentiel global — garantit l'unicité sans hypothèse sur les données.
  // Les anciennes lignes de la même date sont supprimées avant l'insert, donc pas de collision
  // entre syncs. L'index est global (pas par date) car les IDs d'autres dates restent en base.
  const dateKey = dateOp
    ? dateOp.substring(0, 10).replace(/-/g, "")
    : new Date().toISOString().substring(0, 10).replace(/-/g, "");
  const id_ccopeglob = `${dateKey}_${String(idx).padStart(7, "0")}`;

  return {
    id_ccopeglob,
    date_op:          dateOp,
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
  if (!POWERBI_GROUP_ID || !POWERBI_DATASET_ID) {
    throw new Error("Missing env vars: POWERBI_GROUP_ID, POWERBI_DATASET_ID");
  }

  const url =
    `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_GROUP_ID}/datasets/${POWERBI_DATASET_ID}/executeQueries`;
  const accessToken = await fetchPowerBIAccessToken();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queries: [{ query: DAX_QUERY }],
      serializerSettings: { includeNulls: true },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (/TokenExpired|Access token has expired/i.test(txt) && !canUseClientCredentials()) {
      throw new Error(
        "Power BI access token has expired. Update POWERBI_ACCESS_TOKEN or configure POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET."
      );
    }
    throw new Error(`Power BI error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return data?.results?.[0]?.tables?.[0]?.rows ?? [];
}

async function saveRows(supabase: any, payload: any[]) {
  const CHUNK = 1000;

  // Récupère les dates uniques du payload
  const dates = [...new Set(
    payload
      .map(r => r.date_op ? r.date_op.substring(0, 10) : null)
      .filter((d): d is string => d !== null)
  )];

  // Supprime les lignes existantes pour chaque date du payload :
  // - préserve l'historique des autres dates
  // - évite les doublons en cas de re-sync du même jour
  for (const date of dates) {
    const nextDate = new Date(new Date(date + "T00:00:00Z").getTime() + 86_400_000)
      .toISOString().substring(0, 10);

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .gte("date_op", `${date}T00:00:00.000Z`)
      .lt("date_op",  `${nextDate}T00:00:00.000Z`);

    if (error) throw error;
  }

  // Insère les lignes fraîches (l'ID est date-préfixé → pas de collision)
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabase.from(TABLE_NAME).insert(chunk);
    if (error) throw error;
  }
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

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const rows = await fetchPowerBIRows();

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ok: true, fetched: 0, upserted: 0 }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const payload = rows.map((r: PBRow, i: number) => mapRow(r, i));

    await saveRows(supabase, payload);

    return new Response(
      JSON.stringify({
        ok: true,
        fetched: rows.length,
        upserted: payload.length,
        skipped: 0,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
