import { test, expect, Page } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { settle, loginIfNeeded, assertNoCrash } from './helpers/actions';
import {
  buildSeedIds, SeedIds,
  createRegion, createSecteur, createAgence, createGuichetiere, createTechnicien,
  createCodePanne, createPieceDetachee, createStockPieceEntry, createAllEquipements,
  createTerminalBestEffort, createMaintenanceWithDefectBestEffort,
  simulateRepairBestEffort, purgeAllSeed,
} from './helpers/seed';

// ════════════════════════════════════════════════════════════════════════════
//  Seed du jeu de données de test (création) + teardown (purge).
//
//  • Création :   RUN_MUTATING_TESTS=1                       → crée et CONSERVE le jeu.
//  • Purge :      RUN_MUTATING_TESTS=1  SEED_TEARDOWN=1      → supprime tout E2E_.
//
//  La création laisse les données en place (utiles pour dérouler manuellement les
//  processus métier — pointage, maintenance…). Lancez la purge quand vous avez fini.
//
//  Lancer (PowerShell) :
//    $env:RUN_MUTATING_TESTS="1"; $env:EXPLOITATION_EMAIL="…"; $env:EXPLOITATION_PASSWORD="…"
//    npx playwright test tests/06-seed.spec.ts -g "créer"      # création
//    $env:SEED_TEARDOWN="1"; npx playwright test tests/06-seed.spec.ts -g "purger"  # purge
// ════════════════════════════════════════════════════════════════════════════

const MUTATING = process.env.RUN_MUTATING_TESTS === '1';
const TEARDOWN = process.env.SEED_TEARDOWN === '1';

async function loginExploitation(page: Page) {
  await page.goto('/espace-exploitation');
  await settle(page);
  await loginIfNeeded(page, CREDS.exploitation);
  await assertNoCrash(page);
}

test.describe.serial('Seed des données de test', () => {
  test.skip(!MUTATING, 'RUN_MUTATING_TESTS=1 requis (création/suppression en base)');
  test.skip(!hasCreds(CREDS.exploitation), 'Identifiants EXPLOITATION_* non fournis');

  test('créer le jeu E2E (Région → Secteur → Agence → Guichetière + Technicien)', async ({ page }) => {
    const ids: SeedIds = buildSeedIds();
    test.info().annotations.push({ type: 'seed', description: `stamp=${ids.stamp}` });
    await loginExploitation(page);

    await test.step('Région', async () => {
      await createRegion(page, ids);
      await page.getByPlaceholder(/rechercher une région/i).fill(ids.region.nom);
      await page.waitForTimeout(400);
      await expect(page.locator('tr', { hasText: ids.region.nom }).first()).toBeVisible();
    });

    await test.step('Secteur', async () => {
      await createSecteur(page, ids);
      await page.getByPlaceholder(/rechercher un secteur/i).fill(ids.secteur.nom);
      await page.waitForTimeout(400);
      await expect(page.locator('tr', { hasText: ids.secteur.nom }).first()).toBeVisible();
    });

    await test.step('Agence', async () => {
      await createAgence(page, ids);
      await page.getByPlaceholder(/rechercher une agence/i).fill(ids.agence.nom);
      await page.waitForTimeout(400);
      await expect(page.locator('tr', { hasText: ids.agence.nom }).first()).toBeVisible();
    });

    await test.step('Guichetière (compte auth)', async () => {
      await createGuichetiere(page, ids);
      await page.getByPlaceholder(/rechercher une guichetière|rechercher/i).first().fill(ids.guichetiere.nom);
      await page.waitForTimeout(400);
      await expect(page.locator('tr', { hasText: ids.guichetiere.nom }).first()).toBeVisible();
    });

    await test.step('Technicien (compte auth)', async () => {
      await createTechnicien(page, ids);
      await page.getByPlaceholder(/rechercher/i).first().fill(ids.technicien.nom);
      await page.waitForTimeout(400);
      await expect(page.locator('tr', { hasText: ids.technicien.nom }).first()).toBeVisible();
    });

    test.info().annotations.push({ type: 'note', description: 'Jeu de données conservé. Lancez la purge (-g "purger" SEED_TEARDOWN=1) pour nettoyer.' });
  });

  test('créer le jeu maintenance (codes pannes, pièces détachées, stock, équipements)', async ({ page }) => {
    test.skip(process.env.SEED_MAINTENANCE !== '1', 'SEED_MAINTENANCE=1 requis (domaine maintenance/réparation)');
    const ids = buildSeedIds();
    await loginExploitation(page);

    await test.step('Code de panne', () => createCodePanne(page, ids));
    await test.step('Pièce détachée (catalogue)', () => createPieceDetachee(page, ids));
    await test.step('Entrée de stock pièce', () => createStockPieceEntry(page, ids));
    await test.step('Équipements des 7 sous-ensembles', () => createAllEquipements(page, ids));

    test.info().annotations.push({ type: 'seed', description: `maintenance stamp=${ids.stamp}` });
    await assertNoCrash(page);
  });

  test('créer un terminal + sa configuration de sous-ensembles (best-effort)', async ({ page }) => {
    test.skip(process.env.SEED_TERMINAL !== '1', 'SEED_TERMINAL=1 requis (formulaire complexe, à vérifier)');
    const ids = buildSeedIds();
    await loginExploitation(page);
    // Crée d'abord les équipements pour que le terminal puisse les référencer.
    await createAllEquipements(page, ids).catch(() => {});
    const ref = await createTerminalBestEffort(page, ids);
    test.info().annotations.push({ type: 'seed', description: `terminal ref tenté = ${ref}` });
    await assertNoCrash(page);
  });

  test('simuler une réparation (sous-ensemble à réparer → À tester → Réparé)', async ({ page }) => {
    test.skip(process.env.SEED_REPAIR !== '1', 'SEED_REPAIR=1 requis (nécessite des sous-ensembles défectueux)');
    await loginExploitation(page);
    await simulateRepairBestEffort(page);
    await assertNoCrash(page);
  });

  test('chaîne réparation de bout en bout (équipements → terminal → maintenance défaut → réparation)', async ({ page }) => {
    test.skip(process.env.SEED_REPAIR_CHAIN !== '1', 'SEED_REPAIR_CHAIN=1 requis (chaîne complète)');
    test.skip(!hasCreds(CREDS.technicien), 'Identifiants TECHNICIEN_* requis (saisie de maintenance)');
    const ids = buildSeedIds();

    await test.step('Exploitation : équipements + terminal', async () => {
      await loginExploitation(page);
      await createAllEquipements(page, ids).catch(() => {});
      await createTerminalBestEffort(page, ids).catch(() => {});
    });

    await test.step('Technicien : maintenance curative avec remplacement (→ stock défectueux)', async () => {
      await page.goto('/espace-technicien');
      await loginIfNeeded(page, CREDS.technicien);
      await settle(page, 800);
      await createMaintenanceWithDefectBestEffort(page);
    });

    await test.step('Exploitation : traitement de la réparation', async () => {
      await loginExploitation(page);
      await simulateRepairBestEffort(page);
    });

    await assertNoCrash(page);
  });

  test('purger tout le jeu E2E', async ({ page }) => {
    test.skip(!TEARDOWN, 'SEED_TEARDOWN=1 requis pour exécuter la purge');
    await loginExploitation(page);
    await purgeAllSeed(page);
    await assertNoCrash(page);
  });
});
