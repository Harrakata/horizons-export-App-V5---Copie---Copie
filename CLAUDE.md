# CLAUDE.md

Guide pour travailler efficacement dans ce dépôt. Voir aussi `docs/ONBOARDING-NOUVEAU-CLIENT.md` (mise en service d'un client) et `database_setup.md` (schéma).

## Présentation

Application web (PWA) de **gestion de points de vente / agences** pour un opérateur de paris (PMU). Elle assure la continuité de l'activité pour tous les rôles terrain et back-office : guichetières, chefs d'agence, chefs de secteur, techniciens/maintenance, directeurs régionaux/généraux, exploitation.

Le produit est **multi-client** pour le compte d'un fournisseur de service : **un seul code**, décliné par client via configuration (voir « Multi-tenant »).

## Stack

- **Front** : React 18 + Vite 4, React Router 6, Tailwind + Radix UI (composants dans `src/components/ui/`), framer-motion, recharts, lucide-react.
- **Back** : Supabase (PostgreSQL, Auth, Storage, Edge Functions Deno dans `supabase/functions/`).
- **PWA** : `vite-plugin-pwa` (service worker, installable, mode hors-ligne).
- **Observabilité** : Sentry (`@sentry/react`).
- **Intégrations** : PowerBI (`powerbi-client`), MSAL (`@azure/msal-browser`), Twilio SMS (Edge Function `notify-parieur-sms`).
- **Tests** : Playwright E2E (`tests/`).

## Commandes

```bash
npm run dev              # serveur de dev Vite
npm run build            # build de production (vers dist/)
npm run preview          # prévisualiser le build
npm run test:e2e         # tests Playwright
npm run test:e2e:ui      # Playwright en mode UI
npm run test:e2e:report  # rapport du dernier run
```

## Architecture

- `src/App.jsx` — routing. Toutes les pages sont en `lazy()` + `Suspense` + `ErrorBoundary` ; un `Layout` enveloppe les routes authentifiées. `FeatureFlagsProvider` est monté au sommet.
- `src/pages/` — pages par espace : racine (`Espace*Page.jsx`) puis sous-dossiers `exploitation/`, `chef_agence/`, `guichetiere/`, `maintenance/`, `pointage/`, `technicien/`.
- `src/components/` — composants partagés ; `ui/` = primitives Radix/Tailwind ; sous-dossiers par domaine (`analytics/`, `maintenance/`, `paiement_gain/`, `mobile/`…).
- `src/hooks/` — hooks transverses (auth, cache Supabase, online status, feature flags, préférences…).
- `src/lib/` — logique métier et services (config client, profils exploitation, offline, géoloc, paiement gain, planning, pointage, audit…).
- `supabase/migrations/` — migrations SQL. `supabase/functions/` — Edge Functions.

## Multi-tenant (1 client = 1 projet Supabase + 1 déploiement)

Modèle : **codebase unique**, **un projet Supabase et un déploiement (Vercel) par client**. Trois couches de personnalisation, sans fork de code :

1. **Identité / branding** — `src/lib/clientConfig.js`. Vient des variables d'env du déploiement (`VITE_CLIENT_ID`, `VITE_CLIENT_NAME`, `VITE_CLIENT_LOGO_URL`, `VITE_STORAGE_BUCKET`), surchargeables en base via `app_settings/client_branding`.
2. **Fonctionnalités (modules/espaces)** — **source de vérité unique** : le système `functionalites_espaces` (cf. `src/lib/exploitationProfiles.js`, catalogue `APP_SPACE_FUNCTIONALITIES`), éditable dans l'app (Espace Exploitation → « Profil et Fonctionnalité »). Comme chaque client a sa base, c'est déjà par-client.
3. **Kill-switch de déploiement** — `VITE_FEATURES_DISABLED` / `VITE_FEATURES_ENABLED` (listes de clés du catalogue) forcent l'état d'une fonctionnalité, **priorité absolue** sur la base. Appliqué via `applyFeatureEnvOverrides`.

Le hook **`src/hooks/useFeatureFlags.jsx`** unifie le tout : il LIT les fonctionnalités (depuis le `localStorage` alimenté par `Layout.jsx` au boot, event `app-functionalities-updated`), applique l'override env, et charge branding + structure org. Ne pas créer de second fetch des fonctionnalités. Usage : `useFeature('ccope')` → bool ; `useFeatureFlags()` → `{ flags, client, org, ... }`.

Pour ajouter un module : l'ajouter au catalogue `APP_SPACE_FUNCTIONALITIES`, le router dans `App.jsx`, et le garder optionnel via un flag.

## Mode hors-ligne

Pensé pour le terrain en connexion instable. Voir `src/lib/offlineCache.js`, `offlineQueue.js`, `offlineSync.js` et le composant `OfflineSyncIndicator`.

- **Lecture** : `cachedQuery` met en cache (IndexedDB) le résultat des requêtes.
- **Écriture** : file d'attente (`enqueueOffline`) rejouée à la reconnexion.
- Activable par écran via les flags `offline_mode*`. Le **paiement gros gain est volontairement en lecture seule hors-ligne**.

## Conventions & pièges (IMPORTANT)

- **Alias `@` → `src/`** (`vite.config.js`). Importer en `@/lib/...`, `@/components/...`.
- **Ordre de résolution des extensions = `['.jsx', '.js', '.tsx', '.ts', '.json']`** (`vite.config.js`). ⚠ Un import **sans extension** charge le `.jsx` **avant** le `.js`. Ne jamais laisser coexister `foo.js` et `foo.jsx` : c'est une source de bugs silencieux (mauvaise version chargée). Toujours dédoublonner.
- Pages lazy-loadées : enrober tout nouvel écran dans le pattern `LazyRoute` existant.
- Le build terser **supprime `console.*` et `debugger`** en prod — ne pas compter sur les logs en production.
- `app_settings` n'a pas de contrainte unique garantie sur `key` : utiliser le pattern *select-then-update/insert* (cf. `saveClientBranding`).
- Audit & historique : `src/lib/auditLog.js` + historique SCD2 (`Scd2HistoryDialog`).

## Git / artefacts

- Travailler sur une branche dédiée ; ne committer/pusher que sur demande explicite.
- `dist/` est un artefact de build (généré par Vercel) — ne doit pas être suivi par git.
