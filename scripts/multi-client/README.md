# Gestion multi-clients (provisioning & migrations)

Outillage pour gérer plusieurs clients, **chacun avec son propre projet Supabase**
(isolation physique des données). Un seul dépôt de code, un déploiement + une base
par client.

> Socle : outils clients **PostgreSQL** (`psql`, `pg_dump`, version **15+**).
> Sous Windows, lancer les scripts depuis **Git Bash**.

## 1. Prérequis

- `psql` et `pg_dump` installés et dans le `PATH` (PostgreSQL 15+).
  Vérifier : `psql --version` et `pg_dump --version`.
- Pour chaque client, la chaîne de connexion Postgres de son projet Supabase
  (Project Settings → Database → Connection string → URI, port **5432** direct).

## 2. Déclarer un client

Copier l'exemple et renseigner la connexion :

```bash
cp scripts/multi-client/clients/_example.env.example scripts/multi-client/clients/pmu-mali.env
# éditer pmu-mali.env → DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
```

> ⚠ Les `clients/*.env` contiennent des secrets et sont **gitignorés**.
> `CLIENT_ID` doit correspondre au `VITE_CLIENT_ID` du déploiement du client.

## 3. Initialiser le suivi sur le client de référence (une fois)

La base PMU existante est déjà à jour : on marque les migrations comme appliquées
sans les rejouer (création de la table de suivi `_mc_migrations`).

```bash
bash scripts/multi-client/migrate.sh --baseline pmu-mali
```

## 4. Provisionner un NOUVEAU client

Créer d'abord un **projet Supabase vide** pour le client, déclarer son `.env`
(étape 2), puis cloner le schéma depuis la référence :

```bash
bash scripts/multi-client/provision-client.sh --from pmu-mali --to pmu-niger
# avec copie des données de référence (referentiel_parametres par défaut) :
bash scripts/multi-client/provision-client.sh --from pmu-mali --to pmu-niger --seed
```

Le script : clone le schéma (structure seule, **aucune donnée métier**), applique
au nouveau client, puis baseline les migrations. Ensuite, créer le déploiement
(Vercel) avec `VITE_CLIENT_ID=pmu-niger` + les `VITE_SUPABASE_*` du nouveau projet,
et créer le premier compte admin (mode bootstrap de l'Espace Exploitation).

## 5. Faire évoluer le schéma (migrations)

1. Ajouter le fichier `.sql` dans `supabase/migrations/`.
2. L'ajouter **en fin** de `supabase/migrations/manifest.txt` (l'ordre fait foi).
   Conseil : nommer la nouvelle migration `AAAAMMJJHHMM_description.sql`.
3. Appliquer :

```bash
bash scripts/multi-client/migrate.sh pmu-mali     # un client
bash scripts/multi-client/migrate.sh --all        # tous les clients déclarés
bash scripts/multi-client/migrate.sh --dry-run pmu-niger   # aperçu sans exécuter
```

Chaque migration est exécutée dans une **transaction** (tout ou rien) et tracée
dans `_mc_migrations` (rejeu impossible).

## Commandes

| Commande | Effet |
|---|---|
| `migrate.sh <client>` | Applique les migrations en attente à ce client |
| `migrate.sh --all` | Idem pour tous les clients déclarés |
| `migrate.sh --baseline <client>` | Marque les migrations comme appliquées sans les exécuter |
| `migrate.sh --dry-run <client>` | Liste les migrations en attente |
| `provision-client.sh --from <réf> --to <nouveau> [--seed]` | Crée un nouveau client par clonage de schéma |

## Notes de sécurité

- Les bases sont **isolées physiquement** (un projet Supabase par client). Aucun
  risque de fuite inter-clients.
- Les connexions (mots de passe DB) restent **locales et gitignorées**.
- Le clonage est **schema-only** : les données métier du client de référence ne
  sont jamais copiées (seules les tables `--seed` explicites le sont).
