import { test, expect } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { assertNoCrash, settle, loginIfNeeded } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Centre de rapports (Exploitation) : connexion, puis génération RÉELLE de
//  chaque rapport (exécute les requêtes Supabase → détecte les colonnes/tables
//  erronées), et test d'un export CSV (téléchargement).
//  Ignoré si EXPLOITATION_EMAIL / EXPLOITATION_PASSWORD absents.
// ════════════════════════════════════════════════════════════════════════════

test.describe('Centre de rapports — Exploitation', () => {
  test.skip(!hasCreds(CREDS.exploitation), 'Identifiants EXPLOITATION_* non fournis');

  test.beforeEach(async ({ page }) => {
    await page.goto('/espace-exploitation/rapports');
    await settle(page, 600);
    await loginIfNeeded(page, CREDS.exploitation);
    // Après login on peut être redirigé : on revient sur la page Rapports.
    if (!page.url().includes('/rapports')) {
      await page.goto('/espace-exploitation/rapports');
      await settle(page, 800);
    }
    await assertNoCrash(page);
  });

  test('génère chaque rapport sans erreur de requête', async ({ page }) => {
    // Le 1er combobox de la page = sélecteur de rapport (Radix → role="combobox").
    const reportSelect = page.getByRole('combobox').first();
    await expect(reportSelect).toBeVisible({ timeout: 15000 });

    await reportSelect.click();
    const reportNames = (await page.getByRole('option').allTextContents())
      .map((s) => s.trim())
      .filter(Boolean);
    await page.keyboard.press('Escape');
    expect(reportNames.length, 'au moins un rapport disponible').toBeGreaterThan(0);

    for (const name of reportNames) {
      await reportSelect.click();
      await page.getByRole('option', { name, exact: true }).click();
      await page.getByRole('button', { name: /Générer/i }).click();
      await settle(page, 2000);
      await assertNoCrash(page);

      const errorCount = await page.getByText(/Erreur de génération/i).count();
      const headingLoc = page.getByText(/ligne\(s\)/).first();
      const heading = (await headingLoc.count())
        ? (await headingLoc.textContent().catch(() => null))
        : null;
      // eslint-disable-next-line no-console
      console.log(`[RAPPORT] ${name} → ${heading?.trim() || (errorCount ? 'ERREUR DE REQUÊTE' : 'aucun résultat affiché')}`);

      expect(errorCount, `Erreur de génération pour « ${name} »`).toBe(0);
    }
  });

  test('exporte un rapport en CSV (téléchargement)', async ({ page }) => {
    const reportSelect = page.getByRole('combobox').first();
    await expect(reportSelect).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Générer/i }).click();
    await settle(page, 2000);
    await assertNoCrash(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /^CSV$/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    // eslint-disable-next-line no-console
    console.log(`[EXPORT] CSV → ${download.suggestedFilename()}`);
  });
});
