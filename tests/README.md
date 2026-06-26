# Tests E2E (Playwright)

Suite de tests bout-en-bout qui parcourt **toutes les pages, onglets et boutons** de l'application
sans détruire de données (les actions destructrices / mutations / I-O sont volontairement évitées).

## Structure

| Fichier | Couverture |
|--------|------------|
| `01-public-smoke.spec.ts` | Accueil, en-tête, menu « Espaces », thème, toutes les routes d'espace répondent. |
| `02-exploitation.spec.ts` | Connexion admin Exploitation → **chaque onglet** (Guichetières, Agences, Régions, Secteurs, Directeurs régionaux, Direction Générale, Maintenance, Audit, etc.), ouverture des dialogues d'ajout, carte « Structure organisationnelle ». |
| `03-spaces.spec.ts` | Chef d'agence, Chef de secteur, Guichetière, Technicien, Directeur régional, Directeur général : connexion + parcours des onglets + balayage des boutons. |
| `04-crud-lifecycle.spec.ts` | **Cycle CRUD réel** : crée une Région de test (`E2E_REGION_…`), la **modifie**, puis la **supprime** (+ nettoyage de secours). ⚠ MUTE la base — voir ci-dessous. |
| `05-workflows.spec.ts` | **Processus métier** : Pointage, Paiement de gain, Configuration terminaux & sous-ensembles, Réparation, Saisie d'une maintenance. Découpés en `test.step`, tolérants — voir limites ci-dessous. |
| `06-seed.spec.ts` | **Seed des données de test** : crée Région → Secteur → Agence → Guichetière → Technicien (+ Terminal best-effort), puis purge. ⚠ MUTE la base. |
| `helpers/` | `env.ts` (identifiants + données via variables d'env), `actions.ts` (connexion, balayage non destructif), `seed.ts` (créateurs + purge). |

Chaque espace est **ignoré automatiquement** si ses identifiants ne sont pas fournis.

## Configuration

L'URL cible et les identifiants se règlent par variables d'environnement.

- `BASE_URL` (défaut : `http://localhost:5173`). En local, le serveur de dev (`npm run dev`)
  est démarré automatiquement. Pour tester un déploiement : `BASE_URL=https://…`.
- Identifiants par espace (tous optionnels) :

| Espace | Variables |
|--------|-----------|
| Exploitation | `EXPLOITATION_EMAIL`, `EXPLOITATION_PASSWORD` |
| Chef d'agence | `CHEF_AGENCE_EMAIL` ou `CHEF_AGENCE_IDENTIFIER`, `CHEF_AGENCE_PASSWORD` |
| Chef de secteur | `CHEF_SECTEUR_EMAIL` ou `CHEF_SECTEUR_IDENTIFIER`, `CHEF_SECTEUR_PASSWORD` |
| Guichetière | `GUICHETIERE_EMAIL` ou `GUICHETIERE_IDENTIFIER`, `GUICHETIERE_PASSWORD` |
| Technicien | `TECHNICIEN_EMAIL` ou `TECHNICIEN_IDENTIFIER`, `TECHNICIEN_PASSWORD` |
| Directeur régional | `DIR_REGIONAL_EMAIL`, `DIR_REGIONAL_PASSWORD` |
| Directeur général | `DIR_GENERAL_EMAIL`, `DIR_GENERAL_PASSWORD` |

Données optionnelles pour les **processus métier** (`05-workflows.spec.ts`) :

| Variable | Usage |
|----------|-------|
| `POINTAGE_MATRICULE` | Matricule d'une guichetière **planifiée aujourd'hui** → déroule l'identification du Pointage. |
| `PAIEMENT_TICKET` | N° de ticket gagnant → pré-remplit l'initiation d'un Paiement Gros Gain. |

## Lancer

```powershell
# 1) Installer les navigateurs Playwright (une seule fois)
npx playwright install

# 2) Renseigner au moins l'admin Exploitation (PowerShell)
$env:EXPLOITATION_EMAIL="admin@exemple.com"
$env:EXPLOITATION_PASSWORD="motdepasse"
# …et les autres espaces si souhaité

# 3) Lancer toute la suite (démarre le serveur de dev automatiquement)
npx playwright test

# Variantes utiles
npx playwright test --ui                     # mode interactif
npx playwright test tests/02-exploitation.spec.ts
npx playwright test --project=chromium
npx playwright show-report                    # rapport HTML après exécution

# Contre un déploiement distant (pas de serveur local lancé)
$env:BASE_URL="https://sonal.exemple.com"; npx playwright test
```

## Garde-fous

Le balayage de boutons (`sweepButtons`) **n'exécute pas** les libellés destructeurs ou mutants :
suppression, désactivation, déconnexion, soumission de formulaire (Créer/Enregistrer/Sauvegarder),
import/export de fichier, caméra, et bascules de configuration/structure (Actif/Inactif/Masqué…).
Il ouvre les dialogues, vérifie l'absence de crash (ErrorBoundary), puis les referme (Échap).
La page **Profil et Fonctionnalité** et les **Paramètres** sont exclus du balayage pour ne jamais
modifier la configuration persistée.

## Test CRUD mutant (création / modification / suppression réelles)

`04-crud-lifecycle.spec.ts` exécute un cycle complet sur une **Région de test** :
création → modification du nom → suppression, avec un nettoyage automatique de tout résidu `E2E_REGION_…`.

Il est **désactivé par défaut** (il écrit en base). Pour l'exécuter — de préférence sur la **pré-production** :

```powershell
$env:RUN_MUTATING_TESTS="1"
$env:EXPLOITATION_EMAIL="admin@exemple.com"
$env:EXPLOITATION_PASSWORD="motdepasse"
npx playwright test tests/04-crud-lifecycle.spec.ts
```

## Processus métier (`05-workflows.spec.ts`)

Chaque processus vérifie d'abord son **accessibilité** (UI chargée, pas de crash), puis déroule le
chemin nominal en *best-effort* (sélecteurs tolérants, étapes sautées si la donnée prérequise manque).
Les écritures réelles sont conditionnées à `RUN_MUTATING_TESTS=1`.

| Processus | Couverture automatisée | Limite |
|-----------|------------------------|--------|
| **Pointage** | Identification par matricule (étape 1). | Reconnaissance faciale (caméra) + signature manuscrite **non automatisables** ; nécessite une guichetière **planifiée du jour** (`POINTAGE_MATRICULE`). |
| **Paiement de gain** | Écran d'initiation (chef d'agence) + écrans de validation Exploitation (Autorisations, Directeurs). | Flux multi-acteurs complet (initiation → validations régionale/générale) à enchaîner manuellement ou avec plusieurs sessions. |
| **Config. terminaux & sous-ensembles** | Onglet Configuration + ouverture du formulaire terminal ; catalogue des pièces de sous-ensembles. | La création complète dépend d'agences existantes. |
| **Réparation** | Atelier / file des sous-ensembles à traiter ; action « À tester / Réparé » (si `RUN_MUTATING_TESTS`). | Nécessite des sous-ensembles défectueux déjà en stock. |
| **Maintenance** | Formulaire de saisie (agence → terminal → panne), sélection best-effort des 1res options. | Nécessite agences + terminaux existants ; la soumission finale est **commentée** (à activer en préprod). |

```powershell
# Exemple : dérouler le pointage et les flux mutants en préprod
$env:RUN_MUTATING_TESTS="1"
$env:POINTAGE_MATRICULE="00123"
$env:EXPLOITATION_EMAIL="..."; $env:EXPLOITATION_PASSWORD="..."
$env:CHEF_AGENCE_EMAIL="..."; $env:CHEF_AGENCE_PASSWORD="..."
$env:TECHNICIEN_EMAIL="..."; $env:TECHNICIEN_PASSWORD="..."
npx playwright test tests/05-workflows.spec.ts
```

## Seed des données de test (`06-seed.spec.ts`)

Crée un **jeu complet** préfixé `E2E_` pour pouvoir dérouler les processus métier :
**Région → Secteur → Agence → Guichetière (compte auth) → Technicien (compte auth)**, plus un
**Terminal + sous-ensembles** en best-effort (gated séparément).

```powershell
$env:RUN_MUTATING_TESTS="1"
$env:EXPLOITATION_EMAIL="admin@exemple.com"; $env:EXPLOITATION_PASSWORD="…"

# Créer le jeu (et le CONSERVER pour tester ensuite)
npx playwright test tests/06-seed.spec.ts -g "créer le jeu"

# Domaine maintenance : codes de pannes + pièces détachées + entrée de stock + équipements (7 sous-ensembles)
$env:SEED_MAINTENANCE="1"; npx playwright test tests/06-seed.spec.ts -g "jeu maintenance"

# Terminal + config sous-ensembles (crée d'abord les équipements pour être pleinement automatique)
$env:SEED_TERMINAL="1"; npx playwright test tests/06-seed.spec.ts -g "terminal"

# Simuler une réparation sur un sous-ensemble défectueux existant (→ À tester → Réparé)
$env:SEED_REPAIR="1"; npx playwright test tests/06-seed.spec.ts -g "simuler une réparation"

# CHAÎNE COMPLÈTE : équipements → terminal → maintenance(défaut) → réparation (nécessite TECHNICIEN_*)
$env:SEED_REPAIR_CHAIN="1"; $env:TECHNICIEN_EMAIL="…"; $env:TECHNICIEN_PASSWORD="…"
npx playwright test tests/06-seed.spec.ts -g "bout en bout"

# Purger TOUT le jeu E2E (maintenance incluse) une fois terminé
$env:SEED_TEARDOWN="1"; npx playwright test tests/06-seed.spec.ts -g "purger"
```

### Chaîne réparation de bout en bout

`SEED_REPAIR_CHAIN=1` (+ identifiants `TECHNICIEN_*`) déroule le cycle complet :
1. **Exploitation** : crée les 7 équipements + un terminal qui les référence ;
2. **Technicien** : saisit une **maintenance curative avec remplacement** d'un sous-ensemble →
   l'ancien part automatiquement en **stock défectueux** (logique app : `remplace='oui'` + référence
   de remplacement) ;
3. **Exploitation** : traite la réparation (assignation → « À tester » → « Réparé »).

> Prérequis : pour le remplacement, il faut **2 équipements du même type** (le monté + un de
> remplacement disponible). Le formulaire de maintenance est riche (cascade région→terminal,
> type d'intervention, remplacement) → **vérifiez/ajustez les sélecteurs avec `--ui`** au 1er passage.

### Purge étendue

`purgeAllSeed` supprime maintenant aussi le **domaine maintenance** : codes de pannes (`E2E_PANNE_…`,
confirmation `window.confirm` auto-acceptée), pièces (`E2E_PIECE_…`), terminaux (`E2ETRM…`) et
équipements (`E2EQ…`), avant la hiérarchie (guichetières → … → régions).

### Domaine maintenance / réparation

`SEED_MAINTENANCE=1` crée, via l'Espace Exploitation → Maintenance Terminaux :
- un **code de panne** (`EP…`) ;
- une **pièce détachée** au catalogue (`E2EPC…`) + une **entrée de stock pièces** ;
- un **équipement par sous-ensemble** : imprimante, écran, lecteur, afficheur, BUC, carrosserie, alimentation (`E2EQ…-IMP/ECR/…`).

Ces équipements rendent ensuite la création de **Terminal** (`SEED_TERMINAL=1`) pleinement automatique (références disponibles).

Le **stock défectueux / sous-ensemble à réparer** n'a pas de formulaire direct : il est **généré par une maintenance** qui marque un sous-ensemble défectueux (cf. *chaîne de bout en bout* ci-dessous). `SEED_REPAIR=1` simule le traitement (assignation → « À tester » → « Réparé ») sur le 1er élément de la file s'il existe.

**Ordre conseillé** : `06-seed` (créer) → `05-workflows` (les scénarios piochent les données E2E
ou la 1re disponible) → `06-seed` (purger).

> ⚠ Le seed est **best-effort** : les formulaires mêlent inputs, Select Radix et Combobox custom ;
> les comptes Guichetière/Technicien passent par l'edge function `admin-manage-user`. Vérifiez le
> premier passage avec `--ui` et ajustez les sélecteurs dans `helpers/seed.ts` si besoin.
> Le **Terminal** agrège 7 sous-ensembles choisis parmi des **équipements existants** (imprimante,
> lecteur, écran, afficheur, BUC, carrosserie, alimentation) : créez d'abord ces équipements, ou
> complétez `createTerminalBestEffort` selon votre référentiel.

## Cycle CRUD isolé

> Les Régions sont choisies car elles n'entraînent **ni compte d'authentification ni cascade lourde**.
> Pour étendre le CRUD à d'autres entités (Agences, Secteurs, Guichetières, Directeurs), dupliquez le
> modèle de `04-crud-lifecycle.spec.ts` en adaptant les sélecteurs du formulaire ; pour les entités qui
> créent un compte auth (Guichetières/Directeurs), prévoyez un email de test jetable et la suppression
> du compte associé.
