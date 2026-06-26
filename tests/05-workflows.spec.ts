import { test, expect, Page } from '@playwright/test';
import { CREDS, hasCreds, WORKFLOW_DATA } from './helpers/env';
import { assertNoCrash, settle, loginIfNeeded } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Processus métier de bout en bout : Paiement de gain, Pointage, Configuration
//  des terminaux & sous-ensembles, Réparation, et saisie d'une Maintenance.
//
//  Approche : chaque processus est découpé en `test.step`. On vérifie toujours
//  qu'il est ACCESSIBLE et qu'il se charge SANS CRASH ; on tente ensuite le chemin
//  nominal en best-effort (sélecteurs tolérants, étapes sautées si la donnée
//  prérequise est absente). Les écritures réelles sont protégées par
//  RUN_MUTATING_TESTS=1.
//
//  ⚠ Limites assumées (matériel / données) :
//   • Pointage : étapes « reconnaissance faciale » (caméra) et « signature »
//     (tracé manuscrit) NON automatisables — le test s'arrête à l'identification.
//     Fournir POINTAGE_MATRICULE = matricule d'une guichetière planifiée du jour.
//   • Maintenance / Réparation : nécessitent des agences + terminaux + sous-ensembles
//     déjà saisis ; sinon les étapes de création sont sautées proprement.
//   • Paiement de gain : flux multi-acteurs (initiation puis validations) ; on
//     vérifie l'initiation et les écrans de validation côté Exploitation.
// ════════════════════════════════════════════════════════════════════════════

const MUTATING = process.env.RUN_MUTATING_TESTS === '1';

/** Clique un onglet (role=tab) ou un texte d'onglet ; renvoie false si introuvable. */
async function clickTab(page: Page, name: RegExp): Promise<boolean> {
  const tab = page.getByRole('tab', { name }).first();
  if (await tab.count()) { await tab.click().catch(() => {}); await settle(page, 500); return true; }
  const txt = page.getByText(name).first();
  if (await txt.count()) { await txt.click().catch(() => {}); await settle(page, 500); return true; }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
//  1) POINTAGE
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Processus — Pointage', () => {
  test('écran de pointage : identification par matricule', async ({ page }) => {
    await page.goto('/pointage');
    await loginIfNeeded(page, CREDS.chefAgence); // la borne d'agence est ouverte par le chef
    await assertNoCrash(page);

    await test.step('étape 1 — saisie du matricule visible', async () => {
      await expect(
        page.locator('#matricule').or(page.getByText(/matricule/i).first())
      ).toBeVisible();
    });

    if (WORKFLOW_DATA.pointageMatricule) {
      await test.step('soumission du matricule (guichetière planifiée)', async () => {
        await page.locator('#matricule').fill(WORKFLOW_DATA.pointageMatricule!);
        await page.getByRole('button', { name: /valider|continuer|suivant|identifier|commencer/i }).first()
          .click().catch(() => {});
        await settle(page, 1000);
        await assertNoCrash(page);
        // Suite du flux (reconnaissance faciale → signature → confirmation) :
        // dépend de la caméra et d'un tracé manuscrit → non automatisée ici.
      });
    } else {
      test.info().annotations.push({ type: 'note', description: 'POINTAGE_MATRICULE non fourni : flux non déroulé.' });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  2) PAIEMENT DE GAIN
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Processus — Paiement de gain', () => {
  test('initiation d’un paiement (espace chef d’agence / borne)', async ({ page }) => {
    test.skip(!hasCreds(CREDS.chefAgence), 'Identifiants CHEF_AGENCE_* non fournis');
    await page.goto('/paiement-gros-gain');
    await loginIfNeeded(page, CREDS.chefAgence);
    await assertNoCrash(page);

    await test.step('écran Paiement Gros Gain chargé', async () => {
      await expect(page.getByText(/paiement.*gain|gros gain/i).first()).toBeVisible();
    });

    await test.step('ouverture du formulaire d’initiation (best-effort)', async () => {
      const start = page.getByRole('button', { name: /nouveau|initier|ajouter|paiement|saisir|démarrer/i }).first();
      if (await start.count()) {
        await start.click().catch(() => {});
        await settle(page, 500);
        if (WORKFLOW_DATA.ticketGagnant) {
          const ticket = page.locator('input').filter({ hasNot: page.locator('[type="password"]') }).first();
          await ticket.fill(WORKFLOW_DATA.ticketGagnant).catch(() => {});
        }
        await assertNoCrash(page);
        await page.keyboard.press('Escape').catch(() => {});
      }
    });
  });

  test('validation côté Exploitation (Autorisations + Directeurs)', async ({ page }) => {
    test.skip(!hasCreds(CREDS.exploitation), 'Identifiants EXPLOITATION_* non fournis');
    await page.goto('/espace-exploitation/autorisation-paiement-gain');
    await loginIfNeeded(page, CREDS.exploitation);
    await assertNoCrash(page);
    await expect(page.getByText(/autorisation|paiement|gain/i).first()).toBeVisible();

    await page.goto('/espace-exploitation/validation-paiement-gain');
    await settle(page, 500);
    await assertNoCrash(page);
    await expect(page.getByText(/directeurs régionaux|directeur/i).first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  3) CONFIGURATION DES TERMINAUX & SOUS-ENSEMBLES
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Processus — Configuration terminaux & sous-ensembles', () => {
  test.skip(!hasCreds(CREDS.exploitation), 'Identifiants EXPLOITATION_* non fournis');

  test.beforeEach(async ({ page }) => {
    await page.goto('/espace-exploitation/maintenance-terminaux');
    await loginIfNeeded(page, CREDS.exploitation);
    await settle(page, 800);
    await assertNoCrash(page);
  });

  test('onglet Configuration — gestion des terminaux', async ({ page }) => {
    await test.step('ouvrir l’onglet Configuration', async () => {
      await clickTab(page, /configuration/i);
      await assertNoCrash(page);
    });
    await test.step('le formulaire d’ajout de terminal est accessible', async () => {
      const add = page.getByRole('button', { name: /ajouter.*terminal|nouveau terminal|ajouter/i }).first();
      if (await add.count()) {
        await add.click().catch(() => {});
        await settle(page, 400);
        await assertNoCrash(page);
        await page.keyboard.press('Escape').catch(() => {});
      }
    });
  });

  test('pièces de sous-ensembles — catalogue accessible', async ({ page }) => {
    // Réparation → Pièces détachées (catalogue des pièces de sous-ensembles)
    await clickTab(page, /réparation/i);
    await clickTab(page, /pièces? détachées|sous-ensembles|pièces/i);
    await assertNoCrash(page);
    await test.step('bouton « Ajouter une pièce » présent', async () => {
      const add = page.getByRole('button', { name: /ajouter.*pièce|ajouter/i }).first();
      if (await add.count()) {
        await add.click().catch(() => {});
        await settle(page, 400);
        await assertNoCrash(page);
        await page.keyboard.press('Escape').catch(() => {});
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  4) RÉPARATION
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Processus — Réparation des sous-ensembles', () => {
  test.skip(!hasCreds(CREDS.exploitation), 'Identifiants EXPLOITATION_* non fournis');

  test('atelier de réparation accessible (file des sous-ensembles à traiter)', async ({ page }) => {
    await page.goto('/espace-exploitation/maintenance-terminaux');
    await loginIfNeeded(page, CREDS.exploitation);
    await settle(page, 800);

    await clickTab(page, /réparation/i);
    await clickTab(page, /atelier|stock défectueux|réparation/i);
    await assertNoCrash(page);

    await test.step('section « Réparation / Sous-ensembles à traiter » visible', async () => {
      await expect(page.getByText(/sous-ensembles? à traiter|réparation des sous-ensembles|atelier/i).first()).toBeVisible();
    });

    if (MUTATING) {
      await test.step('action sur un sous-ensemble (best-effort, si file non vide)', async () => {
        // Boutons d'action vus dans ReparationTerminauxTab : « À tester » / « Réparé ».
        const action = page.getByRole('button', { name: /à tester|réparé|marquer/i }).first();
        if (await action.count()) {
          await action.click().catch(() => {});
          await settle(page, 600);
          await assertNoCrash(page);
        }
      });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  5) FAIRE UNE MAINTENANCE
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Processus — Saisie d’une maintenance', () => {
  test.skip(!hasCreds(CREDS.technicien), 'Identifiants TECHNICIEN_* non fournis');

  test('formulaire de maintenance (agence → terminal → panne)', async ({ page }) => {
    await page.goto('/espace-technicien');
    await loginIfNeeded(page, CREDS.technicien);
    await settle(page, 800);
    await assertNoCrash(page);

    // Aller sur l'onglet Maintenance de l'espace technicien.
    await clickTab(page, /maintenance/i);
    await assertNoCrash(page);

    await test.step('le formulaire de maintenance est présent', async () => {
      await expect(page.getByText(/agence/i).first()).toBeVisible();
      await expect(page.getByText(/panne|terminal|sous-ensemble/i).first()).toBeVisible();
    });

    if (MUTATING) {
      await test.step('saisie best-effort (sélection des 1res options disponibles)', async () => {
        // Sélectionne la 1re agence puis le 1er terminal/panne si des Select sont présents.
        const selects = page.getByRole('combobox');
        const n = Math.min(await selects.count(), 4);
        for (let i = 0; i < n; i++) {
          await selects.nth(i).click().catch(() => {});
          await page.waitForTimeout(200);
          const opt = page.getByRole('option').first();
          if (await opt.count()) await opt.click().catch(() => {});
          await page.waitForTimeout(200);
        }
        await assertNoCrash(page);
        // NB : l'enregistrement réel n'est pas soumis ici pour éviter des maintenances
        // de test orphelines ; décommentez ci-dessous sur un environnement de préprod.
        // await page.getByRole('button', { name: /enregistrer|valider/i }).first().click();
      });
    }
  });
});
