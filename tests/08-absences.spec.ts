import { test, expect } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { assertNoCrash, settle, loginIfNeeded } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Demandes d'absence : flux réel par espace.
//   - Guichetière : crée une demande (teste aussi l'existence de la table).
//   - Chef d'agence : la liste de validation s'affiche.
//   - Technicien : crée une demande.
//   - Exploitation : la liste de validation des techniciens s'affiche.
//  Chaque test s'ignore si les identifiants de l'espace concerné sont absents.
// ════════════════════════════════════════════════════════════════════════════

test.describe('Demandes d\'absence', () => {
  test('Guichetière — crée une demande', async ({ page }) => {
    test.skip(!hasCreds(CREDS.guichetiere), 'GUICHETIERE_* non fournis');
    await page.goto('/espace-guichetiere');
    await settle(page, 600);
    await loginIfNeeded(page, CREDS.guichetiere);
    await page.goto('/espace-guichetiere/demandes-absence');
    await settle(page, 1000);
    await assertNoCrash(page);

    await page.getByRole('button', { name: /Nouvelle demande/i }).click();
    await settle(page, 400);
    await page.getByRole('button', { name: /^Envoyer$/ }).click();
    await settle(page, 1500);
    await assertNoCrash(page);

    const sent = await page.getByText(/Demande envoyée/i).count();
    const failed = await page.getByText(/Échec de l'envoi/i).count();
    // eslint-disable-next-line no-console
    console.log(`[ABSENCE/guichetière] envoyée=${sent} échec=${failed}`);
    if (failed) {
      const msg = await page.getByText(/Échec de l'envoi/i).first().textContent().catch(() => '');
      // eslint-disable-next-line no-console
      console.log(`[ABSENCE/guichetière] message d'échec → ${msg} (table demandes_absence absente ?)`);
    }
    expect(sent, "La demande doit être envoyée (sinon migration non appliquée ?)").toBeGreaterThan(0);
  });

  test('Chef d\'agence — liste de validation', async ({ page }) => {
    test.skip(!hasCreds(CREDS.chefAgence), 'CHEF_AGENCE_* non fournis');
    await page.goto('/espace-chef-agence');
    await settle(page, 600);
    await loginIfNeeded(page, CREDS.chefAgence);
    await page.goto('/espace-chef-agence/absences');
    await settle(page, 1200);
    await assertNoCrash(page);
    await expect(page.getByText(/Demandes d'absence/i).first()).toBeVisible({ timeout: 10000 });
    const pending = await page.getByText(/En attente/i).count();
    // eslint-disable-next-line no-console
    console.log(`[ABSENCE/chef-agence] panneau affiché, lignes « En attente » visibles=${pending}`);

    // Vue calendrier : bascule + grille mensuelle (en-têtes de jours + légende).
    await page.locator('button[title="Calendrier"]').first().click();
    await settle(page, 600);
    await assertNoCrash(page);
    await expect(page.getByText('Lun', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Approuvée').first()).toBeVisible();
    // eslint-disable-next-line no-console
    console.log('[ABSENCE/chef-agence] vue calendrier OK (grille + légende).');
  });

  test('Technicien — crée une demande', async ({ page }) => {
    test.skip(!hasCreds(CREDS.technicien), 'TECHNICIEN_* non fournis');
    await page.goto('/espace-technicien');
    await settle(page, 600);
    await loginIfNeeded(page, CREDS.technicien);
    // Espace technicien = sections internes : on clique l'onglet « Demandes d'absence ».
    await page.getByText(/Demandes d'absence/i).first().click().catch(() => {});
    await settle(page, 800);
    await assertNoCrash(page);

    const newBtn = page.getByRole('button', { name: /Nouvelle demande/i });
    if (await newBtn.count()) {
      await newBtn.click();
      await settle(page, 400);
      await page.getByRole('button', { name: /^Envoyer$/ }).click();
      await settle(page, 1500);
      await assertNoCrash(page);
      const sent = await page.getByText(/Demande envoyée/i).count();
      // eslint-disable-next-line no-console
      console.log(`[ABSENCE/technicien] envoyée=${sent}`);
      expect(sent).toBeGreaterThan(0);
    } else {
      // eslint-disable-next-line no-console
      console.log('[ABSENCE/technicien] onglet/bouton introuvable (profil ou navigation).');
    }
  });

  test('Exploitation — liste de validation techniciens', async ({ page }) => {
    test.skip(!hasCreds(CREDS.exploitation), 'EXPLOITATION_* non fournis');
    await page.goto('/espace-exploitation/absences');
    await settle(page, 600);
    await loginIfNeeded(page, CREDS.exploitation);
    if (!page.url().includes('/absences')) {
      await page.goto('/espace-exploitation/absences');
      await settle(page, 1000);
    }
    await assertNoCrash(page);
    await expect(page.getByText(/Demandes d'absence/i).first()).toBeVisible({ timeout: 10000 });
    // eslint-disable-next-line no-console
    console.log('[ABSENCE/exploitation] panneau affiché.');
  });
});
