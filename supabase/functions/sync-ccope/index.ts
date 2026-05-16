import { createClient } from "npm:@supabase/supabase-js@2";

const TABLE_NAME = Deno.env.get("TABLE_NAME") ?? "cln_fnir_ccope";

const POWERBI_ACCESS_TOKEN = Deno.env.get("POWERBI_ACCESS_TOKEN");
const POWERBI_GROUP_ID     = Deno.env.get("POWERBI_GROUP_ID");
const POWERBI_DATASET_ID   = Deno.env.get("POWERBI_DATASET_ID");

if (!POWERBI_ACCESS_TOKEN || !POWERBI_GROUP_ID || !POWERBI_DATASET_ID) {
  throw new Error("Missing env vars: POWERBI_ACCESS_TOKEN, POWERBI_GROUP_ID, POWERBI_DATASET_ID");
}

const DAX_QUERY = `
EVALUATE
SUMMARIZECOLUMNS(
    'CLN_FNIR CCOPE'[DATE_OP],
    'CLN_FNIR CCOPE'[OPERATEUR],
    'CLN_FNIR CCOPE'[NATURE_T],
    'CLN_FNIR CCOPE'[MT.ENR],
    'CLN_FNIR CCOPE'[NT.ENR],
    'CLN_FNIR CCOPE'[MT.ANC],
    'CLN_FNIR CCOPE'[NT.ANC],
    'CLN_FNIR CCOPE'[MT.ANE],
    'CLN_FNIR CCOPE'[NT.ANE],
    'CLN_FNIR CCOPE'[MT.ANM],
    'CLN_FNIR CCOPE'[NT.ANM],
    'CLN_FNIR CCOPE'[MT.ANS],
    'CLN_FNIR CCOPE'[NT.ANS],
    'CLN_FNIR CCOPE'[MT.PAY],
    'CLN_FNIR CCOPE'[NT.PAY],
    'CLN_FNIR CCOPE'[MT.ACM],
    'CLN_FNIR CCOPE'[NT.ACM],
    'CLN_FNIR CCOPE'[MT.PAM],
    'CLN_FNIR CCOPE'[NT.PAM],
    'CLN_FNIR CCOPE'[M_AVANCE],
    'CLN_FNIR CCOPE'[M_RETRAIT],
    'CLN_FNIR CCOPE'[CLIENT],
    'CLN_FNIR CCOPE'[ID_CCOPE],
    FILTER(
        ALL('CLN_FNIR CCOPE'),
        'CLN_FNIR CCOPE'[DATE_OP] >= EDATE(TODAY(), -3)
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
  return r[column] ?? r[`CLN_FNIR CCOPE[${column}]`];
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
    date_op:    dateOp,
    operateur:  normalizeText(getValue(r, "OPERATEUR")),
    nature_t:   normalizeText(getValue(r, "NATURE_T")),
    client:     normalizeText(getValue(r, "CLIENT")),
    ref_ccope:  normalizeText(getValue(r, "ID_CCOPE")),
    mt_enr:     normalizeNumber(getValue(r, "MT.ENR")),
    nt_enr:     normalizeNumber(getValue(r, "NT.ENR")),
    mt_anc:     normalizeNumber(getValue(r, "MT.ANC")),
    nt_anc:     normalizeNumber(getValue(r, "NT.ANC")),
    mt_ane:     normalizeNumber(getValue(r, "MT.ANE")),
    nt_ane:     normalizeNumber(getValue(r, "NT.ANE")),
    mt_anm:     normalizeNumber(getValue(r, "MT.ANM")),
    nt_anm:     normalizeNumber(getValue(r, "NT.ANM")),
    mt_ans:     normalizeNumber(getValue(r, "MT.ANS")),
    nt_ans:     normalizeNumber(getValue(r, "NT.ANS")),
    mt_pay:     normalizeNumber(getValue(r, "MT.PAY")),
    nt_pay:     normalizeNumber(getValue(r, "NT.PAY")),
    mt_acm:     normalizeNumber(getValue(r, "MT.ACM")),
    nt_acm:     normalizeNumber(getValue(r, "NT.ACM")),
    mt_pam:     normalizeNumber(getValue(r, "MT.PAM")),
    nt_pam:     normalizeNumber(getValue(r, "NT.PAM")),
    m_avance:   normalizeNumber(getValue(r, "M_AVANCE")),
    m_retrait:  normalizeNumber(getValue(r, "M_RETRAIT")),
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

async function saveRows(supabase: any, payload: any[]) {
  const CHUNK = 1000;

  const dates = [...new Set(
    payload
      .map(r => r.date_op ? r.date_op.substring(0, 10) : null)
      .filter((d): d is string => d !== null)
  )];

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
