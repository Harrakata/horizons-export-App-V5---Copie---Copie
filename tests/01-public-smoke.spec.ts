import { test, expect } from '@playwright/test';
import { assertNoCrash, settle } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Smoke public : ce qui est accessible sans authentification.
//  Vérifie le chargement, l'en-tête, le menu « Espaces » et la non-régression
//  globale (pas d'ErrorBoundary).
// ════════════════════════════════════════════════════════════════════════════

test.describe('Accueil & navigation publique', () => {
  test("l'application se charge sans crash", async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveTitle(/.+/);
    await assertNoCrash(page);
  });

  test("l'en-tête affiche les accès principaux", async ({ page }) => {
    await page.goto('/');
    await settle(page);
    // Liens d'en-tête vus dans Layout (selon fonctionnalités activées).
    await expect(page.getByText(/Page d'Accueil|Accueil/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /espaces/i }).first()).toBeVisible();
    await assertNoCrash(page);
  });

  test('le menu « Espaces » liste les espaces disponibles', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.getByRole('button', { name: /espaces/i }).first().click();
    await page.waitForTimeout(400);
    // Au moins l'Espace Exploitation est toujours présent.
    await expect(page.getByText(/Espace Exploitation/i).first()).toBeVisible();
    await assertNoCrash(page);
  });

  test('le basculement de thème ne casse pas la page', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    // Bouton de thème (icône lune/soleil) — sélection tolérante.
    const themeBtn = page.locator('header button').last();
    await themeBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    await assertNoCrash(page);
  });

  test('chaque route d’espace répond (login ou contenu, sans crash)', async ({ page }) => {
    const routes = [
      '/espace-exploitation',
      '/espace-chef-agence',
      '/espace-guichetiere',
      '/espace-chef-secteur',
      '/espace-technicien',
      '/espace-validation-paiement-gain',
      '/espace-directeur-general',
      '/pointage',
    ];
    for (const route of routes) {
      await page.goto(route);
      await settle(page, 600);
      await assertNoCrash(page);
    }
  });
});
