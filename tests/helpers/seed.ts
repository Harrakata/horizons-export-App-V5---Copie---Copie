import { Page, expect } from '@playwright/test';
import { settle, assertNoCrash } from './actions';

// ════════════════════════════════════════════════════════════════════════════
//  Jeu de données de test (seed) piloté par l'UI Exploitation.
//  Crée la chaîne : Région → Secteur → Agence → Guichetière + Technicien
//  (+ Terminal best-effort). Tous les enregistrements portent le préfixe E2E_
//  pour être repérés et purgés. À utiliser sur PRÉPRODUCTION.
//
//  ⚠ Best-effort : les formulaires mêlent inputs simples, Select Radix et
//  Combobox custom. Les sélecteurs ci-dessous sont déduits du code ; vérifiez/
//  ajustez au premier run (`--ui`). Les créations de comptes (Guichetière /
//  Technicien) passent par l'edge function admin-manage-user.
// ════════════════════════════════════════════════════════════════════════════

export const SEED = {
  prefix: 'E2E_',
  stamp: () => Date.now().toString().slice(-6),
};

export interface SeedIds {
  stamp: string;
  region: { code: string; nom: string };
  secteur: { code: string; nom: string };
  agence: { nom: string; codePDV: string };
  guichetiere: { matricule: string; code: string; nom: string; email: string };
  technicien: { matricule: string; nom: string; email: string };
  codePanne: { code: string; libelle: string };
  piece: { nom: string; reference: string };
  /** Référence de base des équipements de sous-ensembles (1 par type). */
  equipRefBase: string;
}

export function buildSeedIds(): SeedIds {
  const s = SEED.stamp();
  return {
    stamp: s,
    region: { code: `E2E${s}`, nom: `${SEED.prefix}REGION_${s}` },
    secteur: { code: `E2ES${s}`, nom: `${SEED.prefix}SECTEUR_${s}` },
    agence: { nom: `${SEED.prefix}AGENCE_${s}`, codePDV: `E2EA${s}` },
    guichetiere: { matricule: `E2EG${s}`, code: `E2EC${s}`, nom: `${SEED.prefix}GUICH_${s}`, email: `e2e.guich.${s}@e2e.test` },
    technicien: { matricule: `E2ET${s}`, nom: `${SEED.prefix}TECH_${s}`, email: `e2e.tech.${s}@e2e.test` },
    codePanne: { code: `EP${s}`, libelle: `${SEED.prefix}PANNE_${s}` },
    piece: { nom: `${SEED.prefix}PIECE_${s}`, reference: `E2EPC${s}` },
    equipRefBase: `E2EQ${s}`,
  };
}

// Les 7 sous-ensembles d'un terminal (onglets d'EquipmentManager dans Configuration).
export const EQUIP_TABS: Array<{ label: RegExp; key: string }> = [
  { label: /imprimante/i,        key: 'IMP' },
  { label: /écran|ecran/i,       key: 'ECR' },
  { label: /lecteur/i,           key: 'LEC' },
  { label: /afficheur/i,         key: 'AFF' },
  { label: /buc/i,               key: 'BUC' },
  { label: /carrosserie/i,       key: 'CAR' },
  { label: /alimentation/i,      key: 'ALM' },
];

// ── Helpers de saisie génériques ─────────────────────────────────────────────

/** Sélectionne une option dans un Select Radix (clic trigger → clic option). */
async function pickRadix(page: Page, trigger: ReturnType<Page['locator']>, optionName: RegExp | string) {
  await trigger.click();
  await page.waitForTimeout(250);
  const opt = page.getByRole('option', { name: optionName }).first();
  if (await opt.count()) { await opt.click(); }
  else { await page.getByRole('option').first().click().catch(() => {}); }
  await page.waitForTimeout(200);
}

/** Clique un Combobox (par texte du trigger) et choisit l'option E2E_ ou la 1re dispo. */
async function pickComboboxFirst(page: Page, triggerName: RegExp) {
  const trigger = page.getByRole('button', { name: triggerName }).first();
  if (!(await trigger.count())) return;
  await trigger.click().catch(() => {});
  await page.waitForTimeout(250);
  const e2e = page.getByRole('option', { name: /E2E/i }).first();
  if (await e2e.count()) await e2e.click().catch(() => {});
  else await page.getByRole('option').first().click().catch(() => {});
  await page.waitForTimeout(200);
}

/** Sélectionne une valeur dans un Combobox custom (clic trigger → recherche → option). */
async function pickCombobox(page: Page, triggerName: RegExp, value: string) {
  const trigger = page.getByRole('button', { name: triggerName }).first();
  await trigger.click().catch(() => {});
  await page.waitForTimeout(250);
  const search = page.getByPlaceholder(/rechercher/i).last();
  if (await search.count()) { await search.fill(value).catch(() => {}); await page.waitForTimeout(300); }
  const opt = page.getByRole('option', { name: new RegExp(value, 'i') }).first();
  if (await opt.count()) await opt.click().catch(() => {});
  else await page.getByText(new RegExp(value, 'i')).last().click().catch(() => {});
  await page.waitForTimeout(200);
}

const dlg = (page: Page) => page.getByRole('dialog');

/** Clique un onglet (role=tab) ou un texte d'onglet ; renvoie false si introuvable. */
async function clickTab(page: Page, name: RegExp): Promise<boolean> {
  const tab = page.getByRole('tab', { name }).first();
  if (await tab.count()) { await tab.click().catch(() => {}); await settle(page, 400); return true; }
  const txt = page.getByText(name).first();
  if (await txt.count()) { await txt.click().catch(() => {}); await settle(page, 400); return true; }
  return false;
}

async function gotoMaintenance(page: Page) {
  await page.goto('/espace-exploitation/maintenance-terminaux');
  await settle(page, 700);
}

// ── Créateurs par entité ─────────────────────────────────────────────────────

export async function createRegion(page: Page, ids: SeedIds) {
  await page.goto('/espace-exploitation/regions');
  await settle(page, 500);
  await page.getByRole('button', { name: /ajouter une région/i }).click();
  await dlg(page).locator('#codeRegion').fill(ids.region.code);
  await dlg(page).locator('#nom').fill(ids.region.nom);
  await dlg(page).locator('#description').fill('Seed E2E');
  await dlg(page).getByRole('button', { name: 'Ajouter', exact: true }).click();
  await settle(page, 600);
  await assertNoCrash(page);
}

export async function createSecteur(page: Page, ids: SeedIds) {
  await page.goto('/espace-exploitation/secteurs');
  await settle(page, 500);
  await page.getByRole('button', { name: /ajouter un secteur/i }).click();
  const d = dlg(page);
  await d.getByPlaceholder(/SEC-01|code/i).first().fill(ids.secteur.code).catch(async () => {
    await d.locator('input').first().fill(ids.secteur.code);
  });
  // Le nom est le 2e input du formulaire secteur.
  await d.locator('input').nth(1).fill(ids.secteur.nom);
  // Région : Select Radix.
  const regionTrigger = d.getByRole('combobox').first();
  if (await regionTrigger.count()) await pickRadix(page, regionTrigger, new RegExp(ids.region.nom, 'i'));
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await settle(page, 600);
  await assertNoCrash(page);
}

export async function createAgence(page: Page, ids: SeedIds) {
  await page.goto('/espace-exploitation/agences');
  await settle(page, 500);
  await page.getByRole('button', { name: /ajouter une agence/i }).click();
  const d = dlg(page);
  await d.locator('#nom').fill(ids.agence.nom);
  await d.locator('#codePDV').fill(ids.agence.codePDV);
  // Région (Combobox) ; le secteur se déduit ou se choisit ensuite.
  await pickCombobox(page, /sélectionner une région|région/i, ids.region.nom);
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await settle(page, 600);
  await assertNoCrash(page);
}

export async function createGuichetiere(page: Page, ids: SeedIds) {
  await page.goto('/espace-exploitation/guichetieres');
  await settle(page, 500);
  await page.getByRole('button', { name: /ajouter une guichetière/i }).click();
  const d = dlg(page);
  await d.locator('#matricule').fill(ids.guichetiere.matricule);
  await d.locator('#codePrepose').fill(ids.guichetiere.code);
  await d.locator('#nom').fill(ids.guichetiere.nom);
  await d.locator('#prenom').fill('E2E');
  await d.locator('#email').fill(ids.guichetiere.email);
  await d.locator('#mdpPrepose').fill('E2eTestPwd!');
  // Agence (Combobox) si visible.
  await pickCombobox(page, /sélectionner une agence|agence/i, ids.agence.nom).catch(() => {});
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await settle(page, 1500); // création de compte auth
  await assertNoCrash(page);
}

export async function createTechnicien(page: Page, ids: SeedIds) {
  await page.goto('/espace-exploitation/techniciens');
  await settle(page, 500);
  await page.getByRole('button', { name: /ajouter un technicien/i }).click();
  const d = dlg(page);
  await d.locator('#matricule').fill(ids.technicien.matricule);
  await d.locator('#nom').fill(ids.technicien.nom);
  await d.locator('#prenom').fill('E2E');
  await d.locator('#telephone').fill('0700000000');
  await d.locator('#email').fill(ids.technicien.email);
  await d.locator('#motDePasse').fill('E2eTestPwd!');
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await settle(page, 1500); // création de compte auth
  await assertNoCrash(page);
}

/**
 * Terminal + sa configuration de sous-ensembles — BEST-EFFORT séparé.
 * Un terminal agrège 7 sous-ensembles (imprimante, lecteur, écran, afficheur, BUC,
 * carrosserie, alimentation) choisis parmi des ÉQUIPEMENTS déjà saisis. Cette
 * fonction ouvre le formulaire, remplit les champs texte visibles (référence/
 * position) et sélectionne la 1re option de chaque liste (région, agence, type,
 * sous-ensembles). À VÉRIFIER/ajuster avec `--ui` ; nécessite des équipements
 * existants pour les sous-ensembles. Renvoie la référence générée.
 */
export async function createTerminalBestEffort(page: Page, ids: SeedIds): Promise<string> {
  const ref = `E2ETRM${ids.stamp}`;
  await page.goto('/espace-exploitation/maintenance-terminaux');
  await settle(page, 700);

  // Onglet Configuration
  const cfgTab = page.getByRole('tab', { name: /configuration/i }).first();
  if (await cfgTab.count()) { await cfgTab.click().catch(() => {}); await settle(page, 500); }

  const add = page.getByRole('button', { name: /ajouter.*terminal|nouveau terminal|ajouter/i }).first();
  if (!(await add.count())) return ref;
  await add.click().catch(() => {});
  await settle(page, 400);
  const d = dlg(page);

  // Champs texte (référence, position) repérés par placeholder/label tolérant.
  await d.getByPlaceholder(/référence|reference/i).first().fill(ref).catch(() => {});
  await d.getByPlaceholder(/position/i).first().fill('E2E-POS').catch(() => {});

  // Sélections : région E2E, agence E2E, puis 1re option pour type + sous-ensembles.
  const combos = d.getByRole('combobox');
  const n = await combos.count();
  for (let i = 0; i < n; i++) {
    const c = combos.nth(i);
    await c.click().catch(() => {});
    await page.waitForTimeout(200);
    // Essaie l'option E2E (région/agence) sinon la 1re disponible.
    const e2e = page.getByRole('option', { name: /E2E_/i }).first();
    if (await e2e.count()) await e2e.click().catch(() => {});
    else await page.getByRole('option').first().click().catch(() => {});
    await page.waitForTimeout(200);
  }

  await d.getByRole('button', { name: /enregistrer|ajouter|créer|valider/i }).first().click().catch(() => {});
  await settle(page, 800);
  await assertNoCrash(page);
  return ref;
}

// ── Domaine maintenance / réparation ─────────────────────────────────────────

/** Code de panne (table codes_pannes) — Réparation → Codes. */
export async function createCodePanne(page: Page, ids: SeedIds) {
  await gotoMaintenance(page);
  await clickTab(page, /réparation/i);
  await clickTab(page, /^codes$|codes/i);
  // La carte « codes de panne » est la première ; son bouton « Ajouter ».
  await page.getByRole('button', { name: /^ajouter$/i }).first().click().catch(() => {});
  await settle(page, 300);
  const d = dlg(page);
  await d.getByPlaceholder(/Ex: P01|code/i).first().fill(ids.codePanne.code).catch(() => {});
  await d.getByPlaceholder(/Ex: Bourrage|libellé/i).first().fill(ids.codePanne.libelle).catch(() => {});
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click().catch(() => {});
  await settle(page, 500);
  await assertNoCrash(page);
}

/** Pièce détachée (catalogue pieces_sous_ensembles) — Réparation → Pièces détachées → Catalogue. */
export async function createPieceDetachee(page: Page, ids: SeedIds) {
  await gotoMaintenance(page);
  await clickTab(page, /réparation/i);
  await clickTab(page, /pièces? détachées|sous-ensembles|pièces/i);
  await clickTab(page, /catalogue/i);
  await page.getByRole('button', { name: /ajouter.*pièce|ajouter/i }).first().click().catch(() => {});
  await settle(page, 300);
  const d = dlg(page);
  await d.getByPlaceholder(/Ex: Capteur papier|nom/i).first().fill(ids.piece.nom).catch(() => {});
  await d.getByPlaceholder(/Ex: CAP-PAP-001|référence/i).first().fill(ids.piece.reference).catch(() => {});
  await d.getByRole('button', { name: /sauvegarder|ajouter/i }).last().click().catch(() => {});
  await settle(page, 500);
  await assertNoCrash(page);
}

/** Entrée de stock pour la pièce créée — Réparation → Pièces détachées → Stock Pièces. */
export async function createStockPieceEntry(page: Page, ids: SeedIds) {
  await gotoMaintenance(page);
  await clickTab(page, /réparation/i);
  await clickTab(page, /pièces? détachées|pièces/i);
  await clickTab(page, /stock pièces|stock/i);
  // Ouvre le dialogue de mouvement de stock (libellé tolérant).
  const open = page.getByRole('button', { name: /mouvement|entrée|ajouter au stock|nouveau mouvement|stock/i }).first();
  if (await open.count()) {
    await open.click().catch(() => {});
    await settle(page, 300);
    const d = dlg(page);
    // Sélection de la pièce (combobox/select) → notre pièce E2E.
    await pickCombobox(page, /choisir une pièce|pièce|sélectionner/i, ids.piece.nom).catch(() => {});
    // Quantité (1er input numérique) + validation.
    await d.locator('input[type="number"]').first().fill('5').catch(() => {});
    await d.getByRole('button', { name: /enregistrer|valider|ajouter/i }).last().click().catch(() => {});
    await settle(page, 500);
  }
  await assertNoCrash(page);
}

/**
 * Crée un équipement pour CHAQUE sous-ensemble (imprimante, écran, lecteur,
 * afficheur, BUC, carrosserie, alimentation) — Configuration → EquipmentManager.
 * Rend ensuite la création de Terminal pleinement automatique (références dispo).
 */
export async function createAllEquipements(page: Page, ids: SeedIds) {
  await gotoMaintenance(page);
  await clickTab(page, /configuration/i);
  // L'EquipmentManager peut être sous un sous-onglet « Équipements ».
  await clickTab(page, /équipements|equipements/i).catch(() => {});

  for (const eq of EQUIP_TABS) {
    const ref = `${ids.equipRefBase}-${eq.key}`;
    await clickTab(page, eq.label);
    const add = page.getByRole('button', { name: /^ajouter$/i }).first();
    if (!(await add.count())) continue;
    await add.click().catch(() => {});
    await settle(page, 300);
    const d = dlg(page);
    await d.locator('#reference').fill(ref).catch(() => {});
    await d.locator('#marque').fill('E2E').catch(() => {});
    // Modèle : input libre ou Select selon le référentiel — best-effort.
    const modeleInput = d.getByPlaceholder(/laserjet|modèle/i).first();
    if (await modeleInput.count()) await modeleInput.fill('E2E-MOD').catch(() => {});
    else {
      const combo = d.getByRole('combobox').first();
      if (await combo.count()) await pickRadix(page, combo, /.*/);
    }
    await d.getByRole('button', { name: 'Ajouter', exact: true }).click().catch(() => {});
    await settle(page, 500);
    await assertNoCrash(page);
  }
}

/**
 * Saisit une MAINTENANCE CURATIVE avec REMPLACEMENT d'un sous-ensemble, ce qui
 * génère une entrée en STOCK DÉFECTUEUX (logique app : remplace='oui' + référence
 * de remplacement → l'ancien sous-ensemble part en stock défectueux).
 *
 * Prérequis : être sur l'onglet Maintenance de l'espace Technicien, avec une agence
 * possédant un terminal configuré et DEUX équipements du même type (celui monté +
 * un de remplacement disponible). Best-effort : à valider/ajuster avec `--ui`.
 */
export async function createMaintenanceWithDefectBestEffort(page: Page) {
  await clickTab(page, /maintenance/i);
  await settle(page, 500);

  // Cascade région → secteur → agence → terminal (Combobox : E2E_ ou 1re option).
  for (const trig of [/région|region/i, /secteur/i, /agence/i, /terminal/i]) {
    await pickComboboxFirst(page, trig);
  }
  // Type « Curative » (par défaut) puis sous-ensemble concerné.
  await page.getByText(/curative/i).first().click().catch(() => {});
  await pickComboboxFirst(page, /sous-ensemble/i);

  // Remplacement = Oui → choisir une référence de remplacement disponible.
  const oui = page.getByRole('radio', { name: /^oui$/i }).first();
  if (await oui.count()) await oui.click().catch(() => {});
  else await page.getByText(/^oui$/i).first().click().catch(() => {});
  await page.waitForTimeout(200);
  await pickComboboxFirst(page, /remplacement|référence de remplacement|remplacer/i);

  // Code panne (curatif) si demandé.
  await pickComboboxFirst(page, /panne|code/i);

  // Soumission de l'intervention (libellé tolérant) + validation éventuelle.
  await page.getByRole('button', { name: /enregistrer|valider|soumettre|ajouter l|créer l|terminer/i }).last().click().catch(() => {});
  await settle(page, 800);
  // Une 2e confirmation (récapitulatif) peut apparaître.
  await page.getByRole('button', { name: /confirmer|valider|enregistrer/i }).last().click().catch(() => {});
  await settle(page, 800);
  await assertNoCrash(page);
}

/**
 * Simule le PROCESSUS DE RÉPARATION sur un sous-ensemble défectueux existant :
 * Réparation → Atelier/Stock défectueux → assigner technicien → « À tester » → « Réparé ».
 * Best-effort : agit sur le 1er élément de la file s'il y en a un. Les entrées de
 * « stock défectueux / sous-ensemble à réparer » sont normalement générées par une
 * MAINTENANCE qui marque un sous-ensemble défectueux (cf. processus Maintenance).
 */
export async function simulateRepairBestEffort(page: Page) {
  await gotoMaintenance(page);
  await clickTab(page, /réparation/i);
  await clickTab(page, /atelier|stock défectueux|réparation/i);
  await settle(page, 400);

  // Assigner un technicien si un dialogue d'assignation est proposé.
  const assign = page.getByRole('button', { name: /assigner|prendre en charge|affecter/i }).first();
  if (await assign.count()) {
    await assign.click().catch(() => {});
    await settle(page, 300);
    const combo = dlg(page).getByRole('combobox').first();
    if (await combo.count()) await pickRadix(page, combo, /E2E_|.*/);
    await dlg(page).getByRole('button', { name: /valider|assigner|confirmer|enregistrer/i }).first().click().catch(() => {});
    await settle(page, 400);
  }

  // Marquer « À tester » puis « Réparé » sur le 1er sous-ensemble.
  for (const label of [/à tester/i, /réparé/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.count()) { await btn.click().catch(() => {}); await settle(page, 500); }
    await assertNoCrash(page);
  }
}

// ── Purge générique (teardown) ───────────────────────────────────────────────

/**
 * Supprime, sur une page de liste donnée, toutes les lignes contenant `prefix`.
 * Tolérant : bouton de suppression repéré par titre/icône, confirmation par tout
 * bouton « Supprimer… » visible. Boucle limitée pour éviter l'infini.
 */
export async function purgeRows(page: Page, route: string, searchPlaceholder: RegExp, prefix = SEED.prefix) {
  await page.goto(route);
  await settle(page, 500);
  const search = page.getByPlaceholder(searchPlaceholder).first();
  for (let i = 0; i < 15; i++) {
    if (await search.count()) { await search.fill(prefix); await page.waitForTimeout(400); }
    const row = page.locator('tr', { hasText: prefix }).first();
    if (!(await row.count())) break;

    // Bouton de suppression de la ligne : par titre, sinon le dernier bouton.
    const delBtn = row.locator('button[title*="Supprim" i]').first();
    if (await delBtn.count()) await delBtn.click().catch(() => {});
    else await row.locator('button').last().click().catch(() => {});
    await page.waitForTimeout(300);

    // Confirmation (dialog) : « Supprimer » ou « Supprimer définitivement ».
    const confirm = page.getByRole('dialog').getByRole('button', { name: /supprimer/i }).first();
    if (await confirm.count()) { await confirm.click().catch(() => {}); }
    await settle(page, 500);
    await assertNoCrash(page);
  }
}

/**
 * Supprime, dans l'onglet courant, toutes les lignes contenant `match` (sans champ
 * de recherche dédié). Accepte les confirmations natives (window.confirm) ET les
 * dialogues. Tolérant et borné.
 */
async function purgeVisibleRows(page: Page, match: RegExp) {
  for (let i = 0; i < 15; i++) {
    const row = page.locator('tr', { hasText: match }).first();
    if (!(await row.count())) break;
    const del = row.locator('button[title*="Supprim" i]').first();
    if (await del.count()) await del.click().catch(() => {});
    else await row.locator('button').last().click().catch(() => {});
    await page.waitForTimeout(300);
    // Confirmation par dialogue (les window.confirm sont gérés par le handler global).
    const confirm = page.getByRole('dialog').getByRole('button', { name: /supprimer|confirmer/i }).first();
    if (await confirm.count()) await confirm.click().catch(() => {});
    await settle(page, 400);
    await assertNoCrash(page);
  }
}

/** Purge les entités du domaine maintenance (codes, pièces, équipements, terminaux). */
export async function purgeMaintenanceSeed(page: Page) {
  // Accepte automatiquement les confirmations natives (codes de pannes).
  page.on('dialog', (d) => d.accept().catch(() => {}));

  // Codes de pannes (libellé E2E_PANNE_).
  await gotoMaintenance(page);
  await clickTab(page, /réparation/i); await clickTab(page, /codes/i);
  await purgeVisibleRows(page, /E2E_PANNE/i);

  // Pièces détachées (nom E2E_PIECE_).
  await gotoMaintenance(page);
  await clickTab(page, /réparation/i); await clickTab(page, /pièces? détachées|pièces/i); await clickTab(page, /catalogue/i);
  await purgeVisibleRows(page, /E2E_PIECE/i);

  // Terminaux (réf E2ETRM) puis équipements (réf E2EQ) — onglet Configuration.
  await gotoMaintenance(page);
  await clickTab(page, /configuration/i);
  await purgeVisibleRows(page, /E2ETRM/i);
  await clickTab(page, /équipements|equipements/i).catch(() => {});
  for (const eq of EQUIP_TABS) {
    await clickTab(page, eq.label);
    await purgeVisibleRows(page, /E2EQ/i);
  }
}

/** Purge tout le jeu E2E dans l'ordre des dépendances (enfants → parents). */
export async function purgeAllSeed(page: Page, { maintenance = true } = {}) {
  if (maintenance) await purgeMaintenanceSeed(page);
  await purgeRows(page, '/espace-exploitation/guichetieres', /rechercher une guichetière|rechercher/i);
  await purgeRows(page, '/espace-exploitation/techniciens', /rechercher/i);
  await purgeRows(page, '/espace-exploitation/agences', /rechercher une agence|rechercher/i);
  await purgeRows(page, '/espace-exploitation/secteurs', /rechercher un secteur|rechercher/i);
  await purgeRows(page, '/espace-exploitation/regions', /rechercher une région|rechercher/i);
}
