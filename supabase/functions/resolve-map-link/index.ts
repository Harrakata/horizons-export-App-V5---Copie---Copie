const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 12000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function isValidCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCoordinates(value: string) {
  const text = safeDecode(String(value || ""));
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /(?:[?&](?:q|ll|query)=)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/,
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  return null;
}

function isAllowedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (hostname === "maps.app.goo.gl" ||
        hostname === "goo.gl" ||
        hostname === "maps.google.com" ||
        hostname === "www.google.com" ||
        hostname.endsWith(".google.com"))
    );
  } catch {
    return false;
  }
}

async function fetchMapUrl(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => null);
  const targetUrl = String(body?.url || "").trim();

  if (!targetUrl) {
    return jsonResponse({ error: "URL manquante" }, 400);
  }

  if (!isAllowedGoogleMapsUrl(targetUrl)) {
    return jsonResponse({ error: "URL Google Maps non autorisée" }, 400);
  }

  try {
    const response = await fetchMapUrl(targetUrl);
    const finalUrl = response.url;
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const coordinates = parseCoordinates([finalUrl, text].join("\n"));

    return jsonResponse({
      ok: Boolean(coordinates),
      coordinates,
      finalUrl,
      status: response.status,
      contentType,
      content: coordinates ? undefined : text.slice(0, 5000),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return jsonResponse(
      {
        error: isTimeout
          ? "Timeout : lien Google Maps inaccessible"
          : error instanceof Error
            ? error.message
            : String(error),
      },
      isTimeout ? 504 : 502
    );
  }
});
