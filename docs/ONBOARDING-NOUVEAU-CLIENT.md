# Onboarding d'un nouveau client (multi-tenant)

Guide complet pour mettre en service un nouveau client. Modèle : **1 projet
Supabase + 1 déploiement Vercel par client**, codebase unique.

Dans tout ce guide, l'exemple utilise :
- client de **référence** = `pmu-mali` (base existante, déjà à jour)
- **nouveau** client = `pmu-niger`

> Remplacez `pmu-niger` par l'identifiant réel du nouveau client partout.

---

## Vue d'ensemble (3 couches)

| Couche | Quoi | Outils |
|---|---|---|
| **1. Données** | Projet Supabase : schéma, stockage, Edge Functions, auth | Dashboard Supabase + `scripts/multi-client/` |
| **2. Déploiement** | App front (Vercel) pointant vers ce projet | Vercel + variables d'env |
| **3. Configuration** | Identité, fonctionnalités, données de référence | Dans l'app (Espace Exploitation) |

Temps indicatif : ~45–60 min pour un client.

---

## Prérequis (une seule fois pour toute l'équipe)

1. **Outils clients PostgreSQL 15+** (`psql`, `pg_dump`) installés et dans le PATH.
   Vérifier : `psql --version` && `pg_dump --version`.
2. **Supabase CLI** (pour déployer les Edge Functions) : `npm i -g supabase`
   ou via `npx supabase ...`. Vérifier : `npx supabase --version`.
3. Le client de référence déclaré et **baseliné** une fois :
   ```bash
   cp scripts/multi-client/clients/_example.env.example scripts/multi-client/clients/pmu-mali.env
   # éditer pmu-mali.env → DATABASE_URL du projet PMU
   bash scripts/multi-client/migrate.sh --baseline pmu-mali
   ```

---

## COUCHE 1 — Données (projet Supabase)

### Étape 1.1 — Créer le projet Supabase

1. https://supabase.com/dashboard → **New project**.
2. Choisir l'**organisation**, un **nom** (ex. `pmu-niger`), une **région** proche
   des utilisateurs, et un **mot de passe de base de données fort** (le noter).
3. Attendre la fin du provisioning (~2 min).

### Étape 1.2 — Récupérer les identifiants du projet

Dans **Project Settings** :
- **API** → `Project URL` (= `VITE_SUPABASE_URL`) et `anon public` (= `VITE_SUPABASE_ANON_KEY`).
- **API** → `service_role` (secret, pour les Edge Functions — ne JAMAIS l'exposer au front).
- **Database** → `Connection string` → **URI** (connexion **directe**, port `5432`).

### Étape 1.3 — Déclarer le client dans le registre

```bash
cp scripts/multi-client/clients/_example.env.example scripts/multi-client/clients/pmu-niger.env
```
Éditer `scripts/multi-client/clients/pmu-niger.env` :
```
CLIENT_ID=pmu-niger
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres
# SEED_TABLES="referentiel_parametres"   # optionnel
```
> ⚠ Ce fichier contient le mot de passe DB → il est **gitignoré**, ne jamais le committer.

### Étape 1.4 — Provisionner le schéma (clonage depuis la référence)

```bash
# Sous Windows : lancer depuis Git Bash
bash scripts/multi-client/provision-client.sh --from pmu-mali --to pmu-niger
# Avec copie des données de référence (referentiel_parametres) :
bash scripts/multi-client/provision-client.sh --from pmu-mali --to pmu-niger --seed
```
Le script : clone le **schéma** (structure + RLS du schéma `public`, **aucune donnée
métier**), l'applique au nouveau client, puis **baseline** les migrations.

> Vérifier ensuite l'état des migrations : `bash scripts/multi-client/migrate.sh --dry-run pmu-niger`
> (doit indiquer « 0 en attente »).

### Étape 1.5 — Créer le bucket de stockage

Le bucket de stockage (photos de profils, pièces jointes maintenance, signatures…)
est désormais **configurable** via `VITE_STORAGE_BUCKET` (défaut : `pmu-mali-storage`).
Chaque projet étant isolé, il faut créer le bucket dans le nouveau projet :

1. Choisir un nom de bucket (ex. `pmu-niger-storage`) — ou garder le défaut.
2. Dashboard → **Storage** → **New bucket** → ce nom exact.
3. Le déclarer **public** ou privé **à l'identique** du projet de référence
   (vérifier dans le projet PMU : Storage → le bucket → Configuration).
4. Recréer les **policies Storage** (Storage → Policies). Le clonage SQL ne copie
   PAS le schéma `storage` ; reportez les mêmes règles que sur PMU (lecture/écriture
   selon rôle authentifié).
5. Si le nom diffère du défaut, définir `VITE_STORAGE_BUCKET=<nom>` dans Vercel
   (étape 2.2). Sinon, ne rien définir (le défaut `pmu-mali-storage` s'applique).

### Étape 1.6 — Déployer les Edge Functions

Les fonctions vivent dans `supabase/functions/`. Déployer celles utiles au client
(certaines sont liées à des fonctionnalités optionnelles) :

| Fonction | Utilité | À déployer si… |
|---|---|---|
| `admin-manage-user` | création/gestion comptes auth | toujours |
| `pbi-proxy` | proxy Power BI | flag `powerbi` actif |
| `powerquerieCCOPETGLOB`, `sync-ccope`, `sync-ccopeglob` | synchro CCOPE | flag `ccope` actif |
| `sync-suivi-trm-mobi` | synchro PDV mobi | flag `point-de-vente-mobi` actif |
| `notify-parieur-sms` | SMS parieur (Twilio) | notifications SMS utilisées |
| `resolve-map-link` | résolution liens carte/GPS | flag GPS utilisé |
| `send-push` | envoi des notifications push (Web Push) | notifications push souhaitées |

⚠ **Sans déploiement, la création de comptes/profils échoue** avec
« Failed to send a request to the Edge Function » (la fonction `admin-manage-user`
n'existe pas sur le projet).

**Prérequis & pièges :**
- **Docker Desktop doit tourner** (le bundling utilise l'image edge-runtime).
- **Lancer depuis la RACINE du dépôt de l'app** (celle qui contient
  `supabase/functions/` ET `supabase/config.toml`). Sinon la CLI « remonte » et
  prend un mauvais workdir (ex. `C:\Users\<user>`) → erreur
  « entrypoint path does not exist ». Le `supabase/config.toml` du dépôt sert
  d'ancre ; le projet distant est choisi avec `--project-ref`.

```bash
cd "<racine-du-dépôt>"           # dossier contenant supabase/functions/
npx supabase login               # une fois

# Déployer une fonction sur le bon projet (ref = identifiant du projet Supabase)
npx supabase functions deploy admin-manage-user --project-ref <ref-du-projet>

# Ou TOUTES les fonctions d'un coup :
npx supabase functions deploy --project-ref <ref-du-projet>
```
La CLI doit afficher `Using workdir …/<dépôt>` (et non le dossier home).

**Secrets des Edge Functions** (Dashboard → Edge Functions → Secrets, ou
`npx supabase secrets set CLE=valeur`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` sont **injectés automatiquement** — ne pas les définir.
À renseigner selon les fonctions déployées :

- Power BI : `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`,
  `POWERBI_GROUP_ID`, `POWERBI_DATASET_ID` (et éventuellement `POWERBI_ACCESS_TOKEN`).
- SMS (Twilio) : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` ou
  `TWILIO_MESSAGING_SID`, `SMS_DEFAULT_COUNTRY_CODE` (optionnel, défaut `+226`).
  Procédure détaillée : voir `docs/TWILIO-SMS-PAIEMENT-GAIN.md`.
- **Notifications push** (`send-push`) : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (ex. `mailto:contact@client.com`). Générer **une paire VAPID par
  client** : `npx web-push generate-vapid-keys`. La clé **publique** va AUSSI côté
  front (`VITE_VAPID_PUBLIC_KEY`, étape 2.2) ; la **privée** reste un secret serveur.

### Étape 1.7 — Configurer l'authentification

Dashboard → **Authentication** :
- **URL Configuration** → `Site URL` = l'URL Vercel du client (étape 2.3) ;
  ajouter les `Redirect URLs` (dont `…/reset-password`).
- **Providers** → Email activé (mot de passe). SMTP custom optionnel pour les
  emails (réinitialisation de mot de passe).
- **Email Templates** → adapter au nom du client si souhaité.

---

## COUCHE 2 — Déploiement (Vercel)

### Étape 2.1 — Créer le projet Vercel

Nouveau projet Vercel pointant sur **le même dépôt Git** (branche de production).
Build : `npm run build` — Output : `dist` (Vite, déjà configuré).

### Étape 2.2 — Variables d'environnement

Project Settings → **Environment Variables** (toutes en `Production`, et `Preview`
si besoin). Voir `.env.example` pour la liste de référence.

| Variable | Valeur | Obligatoire |
|---|---|---|
| `VITE_CLIENT_ID` | `pmu-niger` | ✅ (doit matcher le `.env` du registre) |
| `VITE_CLIENT_NAME` | `PMU Niger` | ✅ — titre d'onglet + **nom de la PWA** (build-time → redeploy requis) |
| `VITE_CLIENT_LOGO_URL` | URL du logo (sinon réglable en base) | optionnel |
| `VITE_STORAGE_BUCKET` | nom du bucket si ≠ `pmu-mali-storage` | si nom custom |
| `VITE_SUPABASE_URL` | Project URL (étape 1.2) | ✅ |
| `VITE_SUPABASE_ANON_KEY` | clé anon (étape 1.2) | ✅ |
| `VITE_AZURE_TENANT_ID` / `VITE_AZURE_CLIENT_ID` | identifiants Azure AD (Power BI) | si `powerbi` actif |
| `VITE_VAPID_PUBLIC_KEY` | clé **publique** VAPID (= celle du secret `send-push`) | si notifications push |
| `VITE_SENTRY_DSN` | DSN Sentry | optionnel |
| `VITE_FEATURES_DISABLED` | ex. `ccope,powerbi` (kill-switch) | optionnel |
| `VITE_FEATURES_ENABLED` | forçage inverse | optionnel |

### Étape 2.3 — Déployer

Lancer le déploiement. Récupérer l'URL de production et **revenir à l'étape 1.7**
pour renseigner `Site URL` / `Redirect URLs` dans Supabase Auth.

---

## COUCHE 3 — Configuration dans l'app

### Étape 3.1 — Créer le premier administrateur (bootstrap)

La base est vide de profils → l'app passe en **mode bootstrap** :
1. Ouvrir `…/espace-exploitation`.
2. Créer un utilisateur auth (Dashboard → Authentication → Add user) **ou** se
   connecter : le 1er compte sans profil lié obtient un accès **super-admin**
   temporaire (cf. logique de `EspaceExploitationPage`).
3. Dans l'app, créer immédiatement votre **profil Exploitation** et le lier à ce
   compte (onglet « Profil et Fonctionnalité »).

### Étape 3.2 — Définir l'identité du client

Espace Exploitation → **Profil et Fonctionnalité** → carte **« Identité client »** :
- Nom affiché (ex. `PMU Niger`) et URL du logo.
- (L'identifiant technique `pmu-niger` est figé par `VITE_CLIENT_ID`.)
→ Le header, le pied de page et l'accueil reprennent automatiquement nom + logo.

### Étape 3.3 — Activer/désactiver les fonctionnalités

Même page → section **« Espaces & Fonctionnalités »** : cocher/décocher les
modules selon le périmètre vendu au client (CCOPE, Power BI, Audit, Notifications,
Planning, Maintenance, PDV mobi, Pointage, Paiement gros gain, **Tickets / Incidents**,
**Demandes d'absence**, espaces…).

> Nouveaux onglets exploitation livrés (gérés via **« Profil et Fonctionnalité »**
> → droits par profil) : **Rapports**, **Tickets / Incidents**, **Demandes d'absence**,
> **Santé synchro** (visible si « Usage hors-ligne » actif), **Performance**. Activés
> par défaut pour l'admin ; à accorder aux autres profils si nécessaire. Les tables
> associées (absences, tickets, sync_health, message_lectures, push_subscriptions…)
> sont créées automatiquement par les migrations (manifest, étape 1.4).

### Étape 3.4 — Données de référence & paramètres

Si vous n'avez pas utilisé `--seed`, renseigner :
- **Référentiel Paramètres** (onglet dédié).
- **Paramètres** : créneaux de pointage, durées de session, thème, formules de
  salaire/prime/prélèvements, liens Power BI (`powerbi_ccope_url`)…
- Ces réglages vivent dans `app_settings`. Pour partir des gabarits de la référence,
  renseigner `SEED_APP_SETTINGS_KEYS` dans le `.env` du client (ex. `general
  salaire_guichetiere_config prelevements_config`) AVANT le `--seed` : seules ces
  clés sont copiées. ⚠ Ne jamais y mettre `client_branding`, `functionalites_espaces`,
  `feature_flags` ni `powerbi_ccope_url` (spécifiques à chaque client).

### Étape 3.5 — Tests de fumée (checklist)

- [ ] Connexion à `…/espace-exploitation` OK.
- [ ] Nom + logo client visibles (header/accueil).
- [ ] Titre de l'onglet = nom du client ; nom de la PWA à l'installation = nom du client.
- [ ] Création d'un profil + upload d'une photo (vérifie le bucket Storage).
- [ ] Un module désactivé est bien masqué (ex. couper `ccope` → onglet comptable absent).
- [ ] Power BI s'affiche (si activé) — sinon message « désactivé ».
- [ ] Réinitialisation de mot de passe (email) fonctionne.
- [ ] (Si SMS) un envoi test passe.

---

## Dépannage (erreurs réellement rencontrées)

**« La nouvelle app affiche les données de l'ancien client »**
Le déploiement pointe encore sur l'ancienne base. Causes :
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` du nouveau projet Vercel pas (ou mal)
  réglés. ⚠ Les variables `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` créées par
  l'intégration Vercel↔Supabase sont **ignorées** (l'app est en Vite, lit `VITE_*`).
- **Vite fige les variables au BUILD** → après modif, **Redeploy** (sans cache).
- **PWA** : le service worker sert l'ancien bundle. F12 → Application → Service
  Workers → Unregister, puis Clear site data, puis Ctrl+Shift+R.
- Vérif : F12 → Network → une requête `*.supabase.co` doit cibler le bon `ref`.

**« No suitable key or wrong key type » à l'enregistrement (écriture)**
Session périmée : un jeton émis par l'**ancien** projet est encore en cache et envoyé
au **nouveau** (les lectures passent via un fallback sans `Authorization`, pas les
écritures). → Clear site data + **re-login** sur le nouveau projet. Si ça persiste,
utiliser la clé **anon legacy (JWT `eyJ…`)** comme `VITE_SUPABASE_ANON_KEY` (pas la
clé `sb_publishable_…`).

**« Failed to send a request to the Edge Function » (création de profil)**
La fonction `admin-manage-user` n'est pas déployée sur le projet → voir étape 1.6.

**`entrypoint path does not exist` au deploy d'une fonction**
La CLI n'est pas lancée depuis la racine du dépôt (workdir incorrect) → `cd` dans le
dépôt (qui contient `supabase/config.toml`) et utiliser `--project-ref`.

---

## Faire évoluer un client après coup

Nouvelle migration de schéma :
1. Ajouter le `.sql` dans `supabase/migrations/`.
2. L'ajouter **en fin** de `supabase/migrations/manifest.txt`.
3. Appliquer : `bash scripts/multi-client/migrate.sh pmu-niger`
   (ou `--all` pour tous les clients).

Nouvelle version de l'app : push Git → Vercel redéploie chaque client. Pour figer
un client sur une version antérieure, épingler son déploiement sur un tag.

---

## Récapitulatif express (copier/coller)

```bash
# 1. Déclarer le client
cp scripts/multi-client/clients/_example.env.example scripts/multi-client/clients/pmu-niger.env
#   → éditer DATABASE_URL

# 2. Provisionner le schéma
bash scripts/multi-client/provision-client.sh --from pmu-mali --to pmu-niger --seed
bash scripts/multi-client/migrate.sh --dry-run pmu-niger     # doit être à 0

# 3. Edge Functions
npx supabase link --project-ref <ref-niger>
npx supabase functions deploy admin-manage-user
#   … + fonctions selon features ; puis secrets (Power BI / Twilio)

# 3bis. (si notifications push) paire VAPID PAR CLIENT + déploiement send-push
npx web-push generate-vapid-keys
npx supabase functions deploy send-push
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...

# 4. Dashboard : bucket "pmu-mali-storage" + policies, Auth (Site URL/redirects)

# 5. Vercel : nouveau projet + variables VITE_* (dont VITE_VAPID_PUBLIC_KEY si push) ; déployer

# 6. Dans l'app : bootstrap admin → Identité client → Fonctionnalités → paramètres
```

---

## Améliorations futures (optionnelles)

- ✅ ~~Nom de bucket configurable~~ — **fait** : `VITE_STORAGE_BUCKET` (défaut
  `pmu-mali-storage`).
- ✅ ~~Script de seed étendu~~ — **fait** : `SEED_APP_SETTINGS_KEYS` (clés
  `app_settings` sélectionnées) en plus de `SEED_TABLES`.
- ✅ ~~Branding dans les en-têtes internes~~ — **fait** : nom/logo client dans la
  sidebar Exploitation via `useClient()`.
```
