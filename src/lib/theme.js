import { supabase } from './supabaseClient';

export const THEME_STORAGE_KEY = 'theme_colors';
const THEME_LOCAL_KEY = 'app_theme_cache';

export const DEFAULT_THEME = {
  primaryHsl: '174 84% 32%',
  radius: 0.875,
  darkMode: false,
  fontId: 'inter',
  zoom: 16,
  animations: true,
  bgId: 'default',
  shadowId: 'soft',
  stripedTables: false,
  contentWidth: 'normal',
};

// ── Couleurs ──────────────────────────────────────────────────────────────────
export const COLOR_PRESETS = [
  { name: 'Sarcelle',  hex: '#0d9488', hsl: '174 84% 32%' },
  { name: 'Vert',      hex: '#22c55e', hsl: '142 71% 45%' },
  { name: 'Émeraude',  hex: '#10b981', hsl: '160 84% 39%' },
  { name: 'Bleu',      hex: '#3b82f6', hsl: '217 91% 60%' },
  { name: 'Indigo',    hex: '#6366f1', hsl: '239 84% 67%' },
  { name: 'Violet',    hex: '#8b5cf6', hsl: '258 90% 66%' },
  { name: 'Rose',      hex: '#f43f5e', hsl: '350 89% 60%' },
  { name: 'Orange',    hex: '#f97316', hsl: '25 95% 53%'  },
  { name: 'Ambre',     hex: '#f59e0b', hsl: '38 92% 50%'  },
  { name: 'Cyan',      hex: '#06b6d4', hsl: '192 91% 44%' },
  { name: 'Ardoise',   hex: '#64748b', hsl: '215 16% 47%' },
];

// ── Police ────────────────────────────────────────────────────────────────────
export const FONT_PRESETS = [
  { id: 'inter',   name: 'Inter',    stack: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { id: 'system',  name: 'Système',  stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'poppins', name: 'Poppins',  stack: "'Poppins', 'Segoe UI', sans-serif", googleFont: 'Poppins:wght@400;500;600;700' },
  { id: 'serif',   name: 'Géorgia',  stack: "Georgia, 'Times New Roman', serif" },
];

// ── Zoom ──────────────────────────────────────────────────────────────────────
export const ZOOM_OPTIONS = [
  { label: 'Compacte',  value: 14, hint: 'Affichage dense' },
  { label: 'Normale',   value: 16, hint: 'Par défaut' },
  { label: 'Grande',    value: 18, hint: 'Lecture facilitée' },
];

// ── Fond de page ──────────────────────────────────────────────────────────────
export const BG_PRESETS = [
  { id: 'default',  name: 'Défaut',    emoji: '⬜', css: '' },
  { id: 'soft',     name: 'Gris doux', emoji: '🌫️', css: `
    .dark body { background-color: hsl(224, 40%, 6%) !important; }
    body { background-color: hsl(220, 14%, 97%) !important; }
  ` },
  { id: 'gradient', name: 'Dégradé',   emoji: '🌅', css: `
    body { background: linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--background)) 55%) !important; }
  ` },
  { id: 'dots',     name: 'Pointillé', emoji: '✦', css: `
    body { background-image: radial-gradient(hsl(var(--primary) / 0.12) 1px, transparent 1px); background-size: 22px 22px; }
  ` },
  { id: 'grid',     name: 'Grille',    emoji: '⊞', css: `
    body { background-image: linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px); background-size: 28px 28px; }
  ` },
];

// ── Ombre des cartes ──────────────────────────────────────────────────────────
export const SHADOW_PRESETS = [
  { id: 'none',   name: 'Aucune',   hint: 'Plat',      css: `[class*="card"]:not(.card-description), .card { box-shadow: none !important; }` },
  { id: 'soft',   name: 'Légère',   hint: 'Défaut',    css: '' },
  { id: 'medium', name: 'Moyenne',  hint: 'Élevée',    css: `[class*="card"]:not(.card-description), .card { box-shadow: 0 4px 24px -4px rgba(0,0,0,0.14) !important; }` },
  { id: 'strong', name: 'Marquée',  hint: 'Profonde',  css: `[class*="card"]:not(.card-description), .card { box-shadow: 0 12px 40px -8px rgba(0,0,0,0.22) !important; }` },
];

// ── Largeur du contenu ────────────────────────────────────────────────────────
export const WIDTH_PRESETS = [
  { id: 'narrow', name: 'Étroite',  hint: '1024px', css: `main, [data-content] { max-width: 1024px !important; margin-inline: auto !important; }` },
  { id: 'normal', name: 'Normale',  hint: '1280px', css: '' },
  { id: 'wide',   name: 'Large',    hint: '1600px', css: `main, [data-content] { max-width: 1600px !important; }` },
  { id: 'full',   name: 'Pleine',   hint: '100%',   css: `main, [data-content] { max-width: 100% !important; }` },
];

// ── Utilitaires ───────────────────────────────────────────────────────────────
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslToHex(hsl) {
  const parts = hsl.split(' ');
  const h = Number(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const _loadedFonts = new Set();
function ensureGoogleFont(googleFont) {
  if (!googleFont || _loadedFonts.has(googleFont)) return;
  _loadedFonts.add(googleFont);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
  document.head.appendChild(link);
}

function injectStyle(id, css) {
  let el = document.getElementById(id);
  if (!css) { el?.remove(); return; }
  if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
  el.textContent = css;
}

// ── Application du thème ──────────────────────────────────────────────────────
export function applyTheme({
  primaryHsl, radius, darkMode,
  fontId, zoom, animations,
  bgId, shadowId, stripedTables, contentWidth,
} = {}) {
  const root = document.documentElement;

  // Mise en cache localStorage pour une application instantanée au prochain rechargement
  try {
    const prev = JSON.parse(localStorage.getItem(THEME_LOCAL_KEY) || '{}');
    const next = {
      ...prev,
      ...(primaryHsl !== undefined && { primaryHsl }),
      ...(radius !== undefined && { radius }),
      ...(darkMode !== undefined && { darkMode }),
      ...(fontId !== undefined && { fontId }),
      ...(zoom !== undefined && { zoom }),
      ...(animations !== undefined && { animations }),
      ...(bgId !== undefined && { bgId }),
      ...(shadowId !== undefined && { shadowId }),
      ...(stripedTables !== undefined && { stripedTables }),
      ...(contentWidth !== undefined && { contentWidth }),
    };
    localStorage.setItem(THEME_LOCAL_KEY, JSON.stringify(next));
  } catch { /* quota exceeded */ }

  // Couleur principale
  if (primaryHsl) {
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--ring', primaryHsl);
  }
  // Arrondi
  if (radius !== undefined && radius !== null)
    root.style.setProperty('--radius', `${radius}rem`);
  // Mode sombre
  if (darkMode !== undefined)
    root.classList.toggle('dark', darkMode);
  // Police
  if (fontId) {
    const preset = FONT_PRESETS.find(f => f.id === fontId);
    if (preset) {
      if (preset.googleFont) ensureGoogleFont(preset.googleFont);
      document.body.style.fontFamily = preset.stack;
    }
  }
  // Zoom
  if (zoom !== undefined && zoom !== null)
    root.style.fontSize = `${zoom}px`;
  // Animations
  if (animations !== undefined) {
    injectStyle('theme-no-animations', animations ? '' :
      '*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }'
    );
  }
  // Fond de page
  if (bgId !== undefined) {
    const bg = BG_PRESETS.find(b => b.id === bgId);
    injectStyle('theme-bg', bg?.css || '');
  }
  // Ombre des cartes
  if (shadowId !== undefined) {
    const sh = SHADOW_PRESETS.find(s => s.id === shadowId);
    injectStyle('theme-shadow', sh?.css || '');
  }
  // Tableaux rayés
  if (stripedTables !== undefined) {
    injectStyle('theme-striped', stripedTables
      ? 'tbody tr:nth-child(even) { background-color: hsl(var(--muted) / 0.5) !important; }'
      : ''
    );
  }
  // Largeur du contenu
  if (contentWidth !== undefined) {
    const w = WIDTH_PRESETS.find(x => x.id === contentWidth);
    injectStyle('theme-width', w?.css || '');
  }
}

export function getCurrentDarkMode() {
  return document.documentElement.classList.contains('dark');
}

export function applyThemeFromCache() {
  try {
    const cached = localStorage.getItem(THEME_LOCAL_KEY);
    if (cached) applyTheme(JSON.parse(cached));
  } catch { /* ignore */ }
}

export async function loadAndApplyTheme() {
  // 1. Application instantanée depuis le cache localStorage (0 ms)
  applyThemeFromCache();

  // 2. Synchronisation depuis Supabase (met à jour le cache si modifié)
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', THEME_STORAGE_KEY)
      .maybeSingle();
    if (data?.value) applyTheme(data.value);
  } catch {
    // Silently fail — le cache local garantit l'affichage correct
  }
}
