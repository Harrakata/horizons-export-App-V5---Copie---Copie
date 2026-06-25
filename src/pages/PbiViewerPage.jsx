import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useFeature, useClient } from '@/hooks/useFeatureFlags';

const DEFAULT_URL = 'https://app.powerbi.com/view?r=eyJrIjoiMTMzN2MxNGQtYjcxMy00NWM0LWE3ZGUtMzMxYjA1YWJkMGU0IiwidCI6IjZmNTc4MTczLTJlNGUtNGQ4Ni1hZTU1LWQ2MmFmYTcwYzkyMCIsImMiOjh9';

const PbiViewerPage = () => {
  // Fonctionnalité Power BI (multi-tenant) : si désactivée pour ce client, ne pas rediriger.
  const powerBiEnabled = useFeature('powerbi');
  const client = useClient();

  useEffect(() => {
    if (!powerBiEnabled) {
      document.title = 'Fonctionnalité désactivée';
      return;
    }
    document.title = `Rapport BI ${client.displayName}`;
    supabase.from('app_settings').select('value').eq('key', 'powerbi_ccope_url').maybeSingle()
      .then(({ data }) => {
        let target = DEFAULT_URL;
        if (data?.value?.url) {
          const raw = data.value.url;
          const clean = raw.trim().startsWith('<')
            ? (raw.match(/src=["']([^"']+)["']/) || [])[1] || raw
            : raw;
          if (clean && clean.includes('powerbi.com')) target = clean;
        }
        window.location.replace(target);
      });
  }, [powerBiEnabled, client.displayName]);

  if (!powerBiEnabled) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', gap: 12, padding: 24, textAlign: 'center',
      }}>
        <p style={{ color: '#0f172a', fontSize: 18, fontWeight: 600, margin: 0 }}>
          Rapports Power BI désactivés
        </p>
        <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
          Cette fonctionnalité n'est pas activée pour ce client.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, border: '4px solid #0078D4',
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#475569', fontSize: 15, margin: 0 }}>Chargement du rapport…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PbiViewerPage;
