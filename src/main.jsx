
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';
import { initMonitoring } from '@/lib/monitoring';

// Monitoring d'erreurs optionnel (no-op si VITE_SENTRY_DSN absent).
initMonitoring();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
