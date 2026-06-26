import { test, expect, Page } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { assertNoCrash, settle, loginGeneric } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Cycle de vie CRUD RÉEL (création → modification → suppression) sur une entité
//  référentielle SÛRE : les Régions (pas de compte auth, cascade minimale).
//
//  ⚠ Ce test MUTE la base. Il est désactivé par défaut et ne s'exécute QUE si :
//      RUN_MUTATING_TESTS=1   (+ identifiants EXPLOITATION_* fournis)
//  Les enregistrements créés portent le préfixe « E2E_REGION_ » et sont supprimés
//  en fin de test ; un nettoyage de secours (afterEach) retire tout résidu E2E.
//
//  À privilégier sur un environnement de PRÉ-PRODUCTION.
//
//  Lancer :  $env:RUN_MUTATING_TESTS="1"; npx playwright test tests/04-crud-lifecycle.spec.ts
// ════════════════════════════════════════════════════════════════════════════

const E2E_PREFIX = 'E2E_REGION_';
const MUTATING = process.env.RUN_MUTATING_TESTS === '1';

// ── Helpers UI (Régions) ─────────────────────────────────────────────────────
async function gotoRegions(page: Page) {
  await page.goto('/espace-exploitation/regions');
  await settle(page, 600);
}

async function searchRegion(page: Page, term: string) {
  const search = page.getByPlaceholder(/rechercher une région/i);
  await search.fill(term);
  await page.waitForTimeout(400);
}

async function createRegion(page: Page, code: string, nom: string) {
  await page.getByRole('button', { name: /ajouter une région/i }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('#codeRegion').fill(code);
  await dlg.locator('#nom').fill(nom);
  await dlg.locator('#description').fill('Enregistrement de test E2E (à supprimer).');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await settle(page, 600);
}

async function editRegionNom(page: Page, currentNom: string, newNom: string) {
  await searchRegion(page, currentNom);
  const row = page.locator('tr', { hasText: currentNom }).first();
  await expect(row).toBeVisible();
  await row.locator('button').first().click();            // bouton « Modifier » (1er du groupe d'actions)
  const dlg = page.getByRole('dialog');
  await dlg.locator('#nom').fill(newNom);
  await dlg.getByRole('button', { name: 'Sauvegarder', exact: true }).click();
  await settle(page, 600);
}

async function deleteRegion(page: Page, nom: string) {
  await searchRegion(page, nom);
  const row = page.locator('tr', { hasText: nom }).first();
  await expect(row).toBeVisible();
  await row.locator('button[title="Supprimer la région"]').click();
  const confirmDlg = page.getByRole('dialog');
  await confirmDlg.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await settle(page, 600);
}

/** Nettoyage de secours : supprime toutes les régions résiduelles préfixées E2E_. */
async function cleanupE2ERegions(page: Page) {
  try {
    await gotoRegions(page);
    await searchRegion(page, E2E_PREFIX);
    for (let i = 0; i < 10; i++) {
      const row = page.locator('tr', { hasText: E2E_PREFIX }).first();
      if (!(await row.count())) break;
      await row.locator('button[title="Supprimer la région"]').click();
      const confirmDlg = page.getByRole('dialog');
      await confirmDlg.getByRole('button', { name: 'Supprimer', exact: true }).click();
      await settle(page, 500);
      await searchRegion(page, E2E_PREFIX);
    }
  } catch {
    /* best-effort */
  }
}

test.describe.serial('Cycle CRUD Région (création / modification / suppression)', () => {
  test.skip(!MUTATING, 'RUN_MUTATING_TESTS=1 requis (ce test modifie la base)');
  test.skip(!hasCreds(CREDS.exploitation), 'Identifiants EXPLOITATION_* non fournis');

  test.beforeEach(async ({ page }) => {
    await page.goto('/espace-exploitation');
    await settle(page);
    if (await page.locator('input[type="password"]').count()) {
      await loginGeneric(page, CREDS.exploitation);
    }
    await settle(page, 800);
    await assertNoCrash(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupE2ERegions(page);
  });

  test('création → modification → suppression d’une région', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const code = `E2E${stamp}`;
    const nom = `${E2E_PREFIX}${stamp}`;
    const nomModifie = `${nom}_MODIF`;

    await gotoRegions(page);

    // 1) CRÉATION
    await createRegion(page, code, nom);
    await searchRegion(page, nom);
    await expect(page.locator('tr', { hasText: nom }).first(), 'la région créée apparaît dans la liste').toBeVisible();
    await assertNoCrash(page);

    // 2) MODIFICATION
    await editRegionNom(page, nom, nomModifie);
    await searchRegion(page, nomModifie);
    await expect(page.locator('tr', { hasText: nomModifie }).first(), 'le nom modifié apparaît').toBeVisible();
    await assertNoCrash(page);

    // 3) SUPPRESSION
    await deleteRegion(page, nomModifie);
    await searchRegion(page, nomModifie);
    await expect(page.locator('tr', { hasText: nomModifie }), 'la région supprimée a disparu').toHaveCount(0);
    await assertNoCrash(page);
  });
});
