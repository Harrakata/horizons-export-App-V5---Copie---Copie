import { defineConfig, devices } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════════════
//  Config Playwright — tests E2E « Gestion PDV »
//
//  • BASE_URL : URL de l'app à tester (défaut : serveur de dev local 5173).
//      BASE_URL=https://sonal.exemple.com npx playwright test
//  • Identifiants de connexion : voir tests/helpers/env.ts (variables d'env).
//  • webServer : démarre automatiquement `npm run dev` si on teste en local
//      (réutilise un serveur déjà lancé). Désactivé si BASE_URL est distant.
// ════════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,           // séquentiel : on partage l'état de session multi-espace
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                     // un seul worker (app multi-tenant à base unique)
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Décommentez pour étendre la couverture navigateur :
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
    // { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],

  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
