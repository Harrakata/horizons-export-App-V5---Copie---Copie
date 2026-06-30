import { test, expect } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { assertNoCrash, settle, loginIfNeeded } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Tickets / Incidents : création depuis les espaces (déclarants).
//   - Guichetière : crée un ticket (teste aussi l'existence de la table).
//   - Chef d'agence : crée un ticket pour son agence.
//  S'ignore si les identifiants de l'espace concerné sont absents.
// ════════════════════════════════════════════════════════════════════════════

const createTicketFrom = async (page, route: string) => {
  await page.goto(route);
  await settle(page, 1000);
  await assertNoCrash(page);

  await page.getByRole('button', { name: /Signaler/i }).first().click();
  await settle(page, 500);
  await page.getByPlaceholder(/Ex\. Terminal/i).fill(`Test E2E ${Date.now()}`);
  await page.getByRole('button', { name: /^Créer$/ }).click();
  await settle(page, 1800);
  await assertNoCrash(page);

  const ok = await page.getByText(/Ticket créé/i).count();
  const ko = await page.getByText(/Échec de la création/i).count();
  if (ko) {
    const msg = await page.getByText(/Échec de la création/i).first().textContent().catch(() => '');
    // eslint-disable-next-line no-console
    console.log(`[TICKET] échec → ${msg} (migration tickets_incidents appliquée ?)`);
  }
  // eslint-disable-next-line no-console
  console.log(`[TICKET] ${route} → créé=${ok} échec=${ko}`);
  expect(ok, 'Le ticket doit être créé (sinon migration non appliquée ?)').toBeGreaterThan(0);
};

test('Guichetière — crée un ticket', async ({ page }) => {
  test.skip(!hasCreds(CREDS.guichetiere), 'GUICHETIERE_* non fournis');
  await page.goto('/espace-guichetiere');
  await settle(page, 600);
  await loginIfNeeded(page, CREDS.guichetiere);
  await createTicketFrom(page, '/espace-guichetiere/tickets');
});

test('Chef d\'agence — crée un ticket', async ({ page }) => {
  test.skip(!hasCreds(CREDS.chefAgence), 'CHEF_AGENCE_* non fournis');
  await page.goto('/espace-chef-agence');
  await settle(page, 600);
  await loginIfNeeded(page, CREDS.chefAgence);
  await createTicketFrom(page, '/espace-chef-agence/tickets');
});
