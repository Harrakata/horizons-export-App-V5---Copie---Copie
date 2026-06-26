import { test, expect, Page } from '@playwright/test';
import { CREDS, hasCreds, Creds } from './helpers/env';
import { assertNoCrash, settle, loginGeneric, sweepButtons } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Espaces métiers : pour chaque espace dont les identifiants sont fournis, on
//  se connecte, on parcourt ses onglets (via la barre de navigation) et on balaie
//  les boutons sans rien détruire.
//
//  Chaque espace est ignoré automatiquement si ses identifiants ne sont pas fournis.
// ════════════════════════════════════════════════════════════════════════════

interface SpaceDef {
  name: string;
  route: string;
  creds: Creds;
  /** Libellés d'onglets attendus dans la navigation (cliqués un par un). */
  tabs: RegExp[];
}

const SPACES: SpaceDef[] = [
  {
    name: "Chef d'agence",
    route: '/espace-chef-agence',
    creds: CREDS.chefAgence,
    tabs: [/Mon Planning/i, /Mes Guichetières/i, /Maintenance/i, /Suivi Pointage/i, /Point de Vente Mobi/i, /Paiement Gros Gain/i],
  },
  {
    name: 'Chef de secteur',
    route: '/espace-chef-secteur',
    creds: CREDS.chefSecteur,
    tabs: [/Agences|Mes agences/i, /Pointages/i, /Maintenance/i, /Paiements/i],
  },
  {
    name: 'Guichetière',
    route: '/espace-guichetiere',
    creds: CREDS.guichetiere,
    tabs: [/Mon Planning/i, /Mes Pointages/i, /Points de Vente Mobi/i, /État de Caisse/i],
  },
  {
    name: 'Technicien',
    route: '/espace-technicien',
    creds: CREDS.technicien,
    tabs: [/Maintenance/i, /Planning/i],
  },
  {
    name: 'Directeur régional',
    route: '/espace-validation-paiement-gain',
    creds: CREDS.directeurRegional,
    tabs: [/Paiement/i, /Maintenance/i, /Pointage/i, /comptable/i],
  },
  {
    name: 'Directeur général',
    route: '/espace-directeur-general',
    creds: CREDS.directeurGeneral,
    tabs: [/Paiement/i, /Maintenance/i, /Pointage/i, /comptable/i],
  },
];

async function ensureLoggedIn(page: Page, def: SpaceDef) {
  await page.goto(def.route);
  await settle(page);
  if (await page.locator('input[type="password"]').count()) {
    await loginGeneric(page, def.creds);
  }
  await settle(page, 800);
}

for (const def of SPACES) {
  test.describe(`Espace ${def.name}`, () => {
    test.skip(!hasCreds(def.creds), `Identifiants non fournis pour « ${def.name} »`);

    test('connexion sans crash', async ({ page }) => {
      await ensureLoggedIn(page, def);
      await assertNoCrash(page);
      // On ne doit plus voir de champ mot de passe après connexion.
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    });

    test('parcours des onglets + balayage des boutons', async ({ page }) => {
      await ensureLoggedIn(page, def);
      for (const tab of def.tabs) {
        const link = page.getByText(tab).first();
        if (await link.count()) {
          await link.click().catch(() => {});
          await settle(page, 500);
          await assertNoCrash(page);
          await sweepButtons(page, { max: 30 });
          await assertNoCrash(page);
        }
      }
    });
  });
}
