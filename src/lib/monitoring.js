// Monitoring d'erreurs en production via Sentry — entièrement OPTIONNEL.
// Sentry n'est chargé (import dynamique) que si VITE_SENTRY_DSN est défini :
//   → aucun impact sur le bundle ni l'exécution sans DSN.
// Pour l'activer : créer un projet Sentry, puis définir VITE_SENTRY_DSN
// (en local dans .env, en prod dans les variables d'environnement Vercel).

let sentry = null;

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Échantillonnage léger des traces de performance.
      tracesSampleRate: 0.1,
      // Pas de session replay par défaut (vie privée + coût).
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
    sentry = Sentry;
  } catch {
    /* Le monitoring est optionnel : on n'interrompt jamais l'app. */
  }
}

export function captureError(error, context) {
  try {
    if (sentry && error) {
      sentry.captureException(error, context ? { extra: context } : undefined);
    }
  } catch {
    /* noop */
  }
}

export function isMonitoringEnabled() {
  return Boolean(sentry);
}
