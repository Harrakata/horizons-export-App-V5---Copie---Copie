---
name: multi-tenant-architecture
description: Stratégie multi-clients (multi-tenant) de l'app Gestion PDV et où vit chaque pièce
metadata:
  type: project
---

L'app Gestion PDV (React/Vite + Supabase + Vercel) doit servir 2 à ~15 clients
B2B, aux **fonctionnalités divergentes**. Modèle retenu (juin 2026) : **silo —
un projet Supabase + un déploiement Vercel par client**, codebase unique.
Isolation physique des données ; pas de `tenant_id`/RLS partagée.

**Pièces livrées :**
- Identité/branding client : `src/lib/clientConfig.js` (env `VITE_CLIENT_ID/NAME/LOGO_URL`
  + override en base `app_settings/client_branding`) ; hook `src/hooks/useFeatureFlags.jsx`
  (`useFeature`, `useClient`, `FeatureGate`) ; carte admin `src/components/ClientIdentityCard.jsx`.
- Provisioning/migrations : `scripts/multi-client/` (psql/pg_dump, clonage schema-only
  depuis client de référence, suivi via table `_mc_migrations`, ordre dans
  `supabase/migrations/manifest.txt`).

**Contrainte clé — UNE seule source de vérité pour les bascules de fonctionnalités :**
le système EXISTANT `functionalites_espaces` (catalogue `APP_SPACE_FUNCTIONALITIES`
dans `src/lib/exploitationProfiles.js`, page admin « Profil et Fonctionnalité »,
chargé par `Layout.jsx`). `useFeature` ne fait que LE lire + appliquer l'override
env. **Ne PAS recréer un magasin de flags parallèle.** Comme chaque client a sa
base, ce système est déjà naturellement par-client.

**Why:** éviter deux sources de vérité divergentes ; réutiliser l'admin existant.
**How to apply:** pour ajouter un flag → entrée dans `APP_SPACE_FUNCTIONALITIES`
(apparaît auto dans l'admin) ; le brancher via `useFeature('clé')` et/ou
`EXPLOITATION_FEATURE_PATH_MAP`.

**Onboarding nouveau client :** procédure complète dans
`docs/ONBOARDING-NOUVEAU-CLIENT.md` (Supabase → Vercel → config in-app).
Bucket de stockage : configurable via `VITE_STORAGE_BUCKET` (constante `STORAGE_BUCKET`
dans clientConfig.js, défaut `pmu-mali-storage`). Chaque nouveau projet Supabase doit
créer son bucket + policies (le clonage `pg_dump --schema=public` n'inclut PAS le schéma
`storage`). Edge Functions (8) + leurs secrets Power BI/Twilio à déployer par projet.
