import { Page, expect } from '@playwright/test';
import type { Creds } from './env';

// ════════════════════════════════════════════════════════════════════════════
//  Utilitaires d'actions réutilisables pour la suite E2E.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Libellés de boutons à NE PAS cliquer lors du balayage. On évite :
 *  - les actions destructrices (suppression, désactivation, déconnexion) ;
 *  - les soumissions de formulaire (création/enregistrement → mutation de données) ;
 *  - les entrées/sorties (import fichier, export, caméra) qui ouvrent des dialogues OS ;
 *  - les bascules de configuration/structure (changent l'état global de l'app).
 * Le balayage reste ainsi non destructif : il ouvre des dialogues et vérifie l'absence
 * de crash, puis les referme (Échap) sans rien persister.
 */
export const DANGEROUS_LABELS = [
  // Destructeur / sortie
  /supprim/i, /delete/i, /déconn/i, /logout/i, /se déconnecter/i, /retirer/i,
  /désactiver/i, /réinitialiser/i, /vider/i, /effacer/i, /quitter/i,
  /confirmer/i, /tout (dés)?activer/i,
  // Soumission de formulaire (mutation)
  /^créer/i, /^enregistrer/i, /^sauvegarder/i, /mettre à jour/i, /^valider/i, /^modifier le/i,
  // Entrées/sorties
  /import/i, /export/i, /prendre photo/i, /caméra|camera|photo/i, /télécharger|download/i,
  // Bascules de configuration / structure
  /^actif$/i, /^inactif$/i, /^masqué$/i, /^obligatoire$/i, /^optionnel$/i, /^activer$/i,
];

const isDangerous = (label: string) => DANGEROUS_LABELS.some((re) => re.test(label));

/**
 * Vérifie qu'aucune ErrorBoundary n'est affichée (« Une erreur est survenue »).
 * C'est notre sentinelle : si l'app crashe sur une action, ce texte apparaît.
 */
export async function assertNoCrash(page: Page) {
  await expect(
    page.getByText('Une erreur est survenue', { exact: false }),
    'La page a planté (ErrorBoundary affichée)'
  ).toHaveCount(0);
}

/** Attend que le réseau se calme et que l'app soit stable. */
export async function settle(page: Page, ms = 400) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Connexion générique à un espace : remplit email/identifiant + mot de passe, soumet.
 * Tolérant : trouve les champs par type/placeholder/label, et le bouton par son texte.
 */
export async function loginGeneric(page: Page, creds: Creds) {
  // Champ email ou identifiant
  const login = creds.email || creds.identifier || '';
  const emailField = page
    .locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[placeholder*="identifiant" i], input[placeholder*="matricule" i], input[type="text"]')
    .first();
  await emailField.fill(login);

  // Login en 2 étapes (ex. Chef d'agence) : identifiant → « Continuer » → mot de passe.
  if (!(await page.locator('input[type="password"]').count())) {
    const next = page.getByRole('button', { name: /continuer|suivant/i }).first();
    if (await next.count()) {
      await next.click().catch(() => {});
      await settle(page, 700);
    }
  }

  const pwField = page.locator('input[type="password"]').first();
  if (await pwField.count()) await pwField.fill(creds.password || '');

  // Bouton de connexion (texte tolérant)
  const submit = page.getByRole('button', { name: /connexion|connecter|se connecter|valider|entrer|accéder/i }).first();
  await submit.click();
  await settle(page, 1200);
}

/** Connecte l'espace courant si un écran de connexion (mot de passe ou étape identifiant) est présent. */
export async function loginIfNeeded(page: Page, creds: Creds) {
  const hasPassword = await page.locator('input[type="password"]').count();
  const hasContinue = await page.getByRole('button', { name: /continuer|suivant/i }).count();
  if (hasPassword || hasContinue) {
    await loginGeneric(page, creds);
  }
  await settle(page, 600);
}

/**
 * Balaye TOUS les boutons visibles et activés d'une page : clique chacun (sauf
 * libellés destructeurs), vérifie l'absence de crash, puis ferme tout dialogue
 * éventuel (Échap). Donne une couverture large sans muter les données.
 */
export async function sweepButtons(page: Page, opts: { max?: number } = {}) {
  const { max = 60 } = opts;
  const buttons = page.locator('button:visible:not([disabled])');
  const count = Math.min(await buttons.count(), max);

  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const label = ((await btn.textContent().catch(() => '')) || (await btn.getAttribute('aria-label').catch(() => '')) || '').trim();
    if (!label || isDangerous(label)) continue;

    await btn.click({ trial: false, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(150);
    await assertNoCrash(page);

    // Ferme un éventuel dialogue/menu ouvert pour ne pas bloquer les clics suivants.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(80);
  }
}

/**
 * Ouvre le menu déroulant « Espaces » (en-tête) et clique l'entrée demandée.
 */
export async function openEspace(page: Page, espaceLabel: RegExp | string) {
  await page.goto('/');
  await settle(page);
  await page.getByRole('button', { name: /espaces/i }).first().click().catch(async () => {
    // Variante : le déclencheur peut être un lien/texte
    await page.getByText(/espaces/i).first().click();
  });
  await page.waitForTimeout(300);
  await page.getByText(espaceLabel).first().click();
  await settle(page, 800);
}
