import { useEffect, useRef, useState, useCallback } from 'react';
import { BarChart2, LogIn, AlertCircle, RefreshCw } from 'lucide-react';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// ─── Config Azure AD ──────────────────────────────────────────────────────────
const TENANT_ID  = import.meta.env.VITE_AZURE_TENANT_ID ?? '';
const CLIENT_ID  = import.meta.env.VITE_AZURE_CLIENT_ID ?? '';
const PBI_SCOPES = ['https://analysis.windows.net/powerbi/api/.default'];

// Instance MSAL singleton
let _msal = null;

async function getMsal() {
  if (!CLIENT_ID || !TENANT_ID) {
    throw new Error(
      'Configurez VITE_AZURE_TENANT_ID et VITE_AZURE_CLIENT_ID dans le fichier .env'
    );
  }
  if (!_msal) {
    _msal = new PublicClientApplication({
      auth: {
        clientId:    CLIENT_ID,
        authority:   `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    });
    await _msal.initialize();
    // Gérer le retour de redirect si nécessaire
    await _msal.handleRedirectPromise().catch(() => null);
  }
  return _msal;
}

async function acquireSilent() {
  const msal = await getMsal();
  const accounts = msal.getAllAccounts();
  if (!accounts.length) return null;
  try {
    const r = await msal.acquireTokenSilent({ account: accounts[0], scopes: PBI_SCOPES });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) return null;
    throw e;
  }
}

async function acquirePopup() {
  const msal     = await getMsal();
  const r        = await msal.acquireTokenPopup({ scopes: PBI_SCOPES });
  return r.accessToken;
}

// ─── Composant ────────────────────────────────────────────────────────────────
const PowerBiEmbedPanel = ({ reportId, embedUrl, height = 580 }) => {
  const containerRef = useRef(null);
  const serviceRef   = useRef(null);

  // 'init' | 'loading' | 'ready' | 'need-auth' | 'error'
  const [status,   setStatus]   = useState('init');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Embed avec un token valide ──────────────────────────────────────────────
  const embed = useCallback(async (accessToken) => {
    if (!containerRef.current) return;
    setStatus('loading');

    try {
      const pbi = await import('powerbi-client');

      // Réinitialiser l'éventuel embed précédent
      if (serviceRef.current && containerRef.current) {
        try { serviceRef.current.reset(containerRef.current); } catch {}
      }

      const powerbiService = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory
      );
      serviceRef.current = powerbiService;

      const report = powerbiService.embed(containerRef.current, {
        type:        'report',
        id:          reportId,
        embedUrl,
        tokenType:   pbi.models.TokenType.Aad,
        accessToken,
        settings: {
          panes: {
            filters:        { visible: false },
            pageNavigation: { visible: true  },
          },
        },
      });

      report.on('loaded', () => setStatus('ready'));
      report.on('error',  (event) => {
        const d = event?.detail;
        setErrorMsg(typeof d === 'string' ? d : d?.message ?? JSON.stringify(d ?? 'Erreur inconnue'));
        setStatus('error');
      });
    } catch (err) {
      setErrorMsg(err?.message ?? String(err));
      setStatus('error');
    }
  }, [reportId, embedUrl]);

  // ── Tentative d'auth silencieuse au montage ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await acquireSilent();
        if (cancelled) return;
        if (token) {
          await embed(token);
        } else {
          setStatus('need-auth');
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err?.message ?? String(err));
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (serviceRef.current && containerRef.current)
          serviceRef.current.reset(containerRef.current);
      } catch {}
    };
  }, [embed]);

  // ── Connexion via popup ─────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErrorMsg('');
    try {
      const token = await acquirePopup();
      await embed(token);
    } catch (err) {
      if (err?.errorCode === 'user_cancelled') {
        setStatus('need-auth'); // l'utilisateur a fermé la fenêtre
      } else {
        setErrorMsg(err?.message ?? String(err));
        setStatus('error');
      }
    }
  };

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>

      {/* Spinner chargement */}
      {(status === 'init' || status === 'loading') && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Chargement du rapport Power BI…
          </div>
        </div>
      )}

      {/* Authentification requise */}
      {status === 'need-auth' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-background/95 p-8">
          <div className="rounded-2xl bg-[#0078D4]/10 p-5">
            <BarChart2 className="h-10 w-10 text-[#0078D4]" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">Connexion Microsoft 365 requise</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Ce rapport Power BI nécessite votre compte Microsoft 365.
              Une fenêtre de connexion va s'ouvrir.
            </p>
          </div>
          <button
            onClick={handleLogin}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0078D4] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#006cbd] active:scale-95 transition-all"
          >
            <LogIn className="h-4 w-4" />
            Se connecter avec Microsoft 365
          </button>
        </div>
      )}

      {/* Erreur */}
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/95 p-8">
          <div className="rounded-2xl bg-red-50 p-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-foreground">Le rapport n'a pas pu se charger</p>
          {errorMsg && (
            <pre className="max-w-sm overflow-auto rounded-lg bg-muted px-3 py-2 text-[10px] text-muted-foreground">
              {errorMsg}
            </pre>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setStatus('need-auth'); setErrorMsg(''); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" /> Réessayer la connexion
            </button>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0078D4] px-4 py-2 text-xs font-semibold text-white hover:bg-[#006cbd] transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" /> Ouvrir dans Power BI ↗
            </a>
          </div>
        </div>
      )}

      {/* Conteneur SDK Power BI */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

export default PowerBiEmbedPanel;
