import { createClient } from "npm:@supabase/supabase-js@2";

const TABLE_NAME = Deno.env.get("TABLE_NAME") ?? "suivi_trm_mobi_v2_export";

const POWERBI_ACCESS_TOKEN = Deno.env.get("POWERBI_ACCESS_TOKEN");
const POWERBI_GROUP_ID = Deno.env.get("POWERBI_GROUP_ID");
const POWERBI_DATASET_ID = Deno.env.get("POWERBI_DATASET_ID");

if (!POWERBI_ACCESS_TOKEN || !POWERBI_GROUP_ID || !POWERBI_DATASET_ID) {
  throw new Error("Missing env vars: POWERBI_ACCESS_TOKEN, POWERBI_GROUP_ID, POWERBI_DATASET_ID");
}

const DAX_QUERY = `
EVALUATE
SUMMARIZECOLUMNS(
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[ID_TRM_MOBI],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[AGE_D'UTILISATION],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[PREMIERE_UTILISATION],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[DERNIERE_UTILISATION],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[HORS_SERVICE],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[CUMUL_ENJEUX],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[CLIENT],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[PREMIER_PREPOSE],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[DERNIER_PREPOSE],
    'CLN_FNIR SUIVI_TRM_MOBI_V2'[LISTE_PREPOSE]
)
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PBRow = Record<string, any>;

function getValue(r: PBRow, column: string) {
  return r[column] ?? r[`CLN_FNIR SUIVI_TRM_MOBI_V2[${column}]`];
}

function normalizeText(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
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

function mapRow(r: PBRow) {
  return {
    id_trm_mobi:          normalizeText(getValue(r, "ID_TRM_MOBI")),
    age_d_utilisation:    normalizeNumber(getValue(r, "AGE_D'UTILISATION")),
    premiere_utilisation: normalizeTimestamp(getValue(r, "PREMIERE_UTILISATION")),
    derniere_utilisation: normalizeTimestamp(getValue(r, "DERNIERE_UTILISATION")),
    hors_service:         normalizeNumber(getValue(r, "HORS_SERVICE")),
    cumul_enjeux:         normalizeNumber(getValue(r, "CUMUL_ENJEUX")),
    client:               normalizeText(getValue(r, "CLIENT")),
    premier_prepose:      normalizeText(getValue(r, "PREMIER_PREPOSE")),
    dernier_prepose:      normalizeText(getValue(r, "DERNIER_PREPOSE")),
    liste_prepose:        normalizeText(getValue(r, "LISTE_PREPOSE")),
  };
}

async function fetchPowerBIRows() {
  const url =
    `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_GROUP_ID}/datasets/${POWERBI_DATASET_ID}/executeQueries`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POWERBI_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queries: [{ query: DAX_QUERY }],
      serializerSettings: { includeNulls: true },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Power BI error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return data?.results?.[0]?.tables?.[0]?.rows ?? [];
}

async function upsertRows(supabase: any, payload: any[]) {
  const CHUNK = 1000;

  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(chunk, { onConflict: "id_trm_mobi" });

    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rows = await fetchPowerBIRows();

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ok: true, fetched: 0, upserted: 0 }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const payload = rows.map(mapRow).filter(r => r.id_trm_mobi !== null);

    await upsertRows(supabase, payload);

    return new Response(
      JSON.stringify({ ok: true, fetched: rows.length, upserted: payload.length }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
