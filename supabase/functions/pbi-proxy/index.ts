const ALLOWED_ORIGIN = 'https://app.powerbi.com';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    });
  }

  const reqUrl = new URL(req.url);
  const targetUrl = reqUrl.searchParams.get('url');

  // Log complet pour diagnostic
  console.log('=== PBI PROXY DEBUG ===');
  console.log('req.url:', req.url);
  console.log('searchParams keys:', [...reqUrl.searchParams.keys()]);
  console.log('targetUrl:', targetUrl);

  if (!targetUrl) {
    return new Response('Paramètre url manquant', { status: 400 });
  }
  if (!targetUrl.startsWith(ALLOWED_ORIGIN)) {
    return new Response(`URL non autorisée: ${targetUrl.slice(0, 80)}`, { status: 400 });
  }

  // Abort si Power BI ne répond pas dans les 8 secondes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    console.log('Fetching Power BI URL...');
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeoutId);

    console.log('Power BI responded with status:', response.status);
    console.log('Response headers X-Frame-Options:', response.headers.get('x-frame-options'));
    console.log('Response headers Location:', response.headers.get('location'));

    const contentType = response.headers.get('content-type') ?? 'text/html; charset=utf-8';
    let body = await response.text();
    console.log('Body length:', body.length);
    console.log('Body preview:', body.slice(0, 300));

    if (contentType.includes('text/html')) {
      body = body.replace(
        /(<head[^>]*>)/i,
        `$1<base href="https://app.powerbi.com/" target="_self">`,
      );
    }

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout ? 'Timeout : Power BI inaccessible depuis le serveur' : (err instanceof Error ? err.message : String(err));
    console.error('Fetch error:', message);
    return new Response(message, {
      status: isTimeout ? 504 : 502,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
