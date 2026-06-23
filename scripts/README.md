# Scripts

## `schema.sql` — schéma complet (filet de sécurité)

`scripts/schema.sql` est l'**export consolidé de toute la structure de la base**
(toutes les tables `public`, colonnes, contraintes, index, clés étrangères,
séquences, vues). Il sert de référence et de sauvegarde du modèle. Il ne contient
**aucune donnée métier** ni secret (dump *schema-only*) → il est versionné dans git.

### Le générer / le mettre à jour

```bash
# 1) (une seule fois) renseigner le mot de passe DB dans le fichier de connexion :
#    scripts/multi-client/clients/pmu-mali.env   (host déjà pré-rempli, gitignoré)

# 2) générer / régénérer le fichier :
bash scripts/dump-schema.sh
```

Le script détecte automatiquement le client unique (`pmu-mali`). Pour viser un
autre client : `bash scripts/dump-schema.sh <client-id>`. Pour une connexion
ponctuelle sans fichier : `SUPABASE_DB_URL="postgresql://…" bash scripts/dump-schema.sh`.

**Prérequis** (l'un OU l'autre) :
- `pg_dump` (outils clients PostgreSQL 15+) dans le PATH, **ou**
- **Docker Desktop démarré** — la CLI Supabase lance alors `pg_dump` dans un
  conteneur, sans rien installer. C'est le plus simple ici (Docker est déjà
  installé sur le poste).

### ⚠ Maintenir à jour

Le schéma vit dans Supabase ; `schema.sql` n'est qu'un reflet. À chaque
**modification de structure** :

1. Écrire la modification comme **migration** dans `supabase/migrations/` et
   l'ajouter en fin de `supabase/migrations/manifest.txt` (source d'ordre).
2. Appliquer la migration (`scripts/multi-client/migrate.sh <client>`).
3. **Relancer `bash scripts/dump-schema.sh`** pour rafraîchir `schema.sql`, puis
   committer le fichier mis à jour.

Ainsi `schema.sql` reste le reflet exact et complet de la base à tout instant.

## Autres scripts

- `multi-client/` — provisioning et migrations multi-tenants (un projet Supabase
  par client). Voir `multi-client/README.md`.
- `*.sql` — correctifs / vues / index ponctuels (déjà appliqués en base).
- `gen-icons.mjs` — génération des icônes PWA.
