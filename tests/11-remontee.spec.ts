import { test, expect } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { settle, loginIfNeeded, assertNoCrash } from './helpers/actions';

// Vérifie que l'envoi d'une remontée (agent → exploitation) aboutit sur la base réelle.
test('Remontée — envoi depuis Guichetière', async ({ page }) => {
  test.skip(!hasCreds(CREDS.guichetiere), 'GUICHETIERE_* non fournis');
  await page.goto('/espace-guichetiere');
  await settle(page, 600);
  await loginIfNeeded(page, CREDS.guichetiere);
  await settle(page, 800);
  await assertNoCrash(page);

  await page.getByRole('button', { name: /Contacter l'exploitation/i }).first().click();
  await settle(page, 400);
  await page.getByPlaceholder(/Ex\. Probl/i).fill(`Test remontée ${Date.now()}`);
  await page.getByRole('button', { name: /^Envoyer$/ }).click();
  await settle(page, 1800);
  await assertNoCrash(page);

  const ok = await page.getByText(/Message envoyé/i).count();
  const ko = await page.getByText(/Échec de l'envoi/i).count();
  if (ko) {
    const msg = await page.getByText(/Échec de l'envoi/i).first().textContent().catch(() => '');
    // eslint-disable-next-line no-console
    console.log(`[REMONTEE] échec → ${msg}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[REMONTEE] envoyé=${ok} échec=${ko}`);
  expect(ok, 'La remontée doit être envoyée').toBeGreaterThan(0);
});
