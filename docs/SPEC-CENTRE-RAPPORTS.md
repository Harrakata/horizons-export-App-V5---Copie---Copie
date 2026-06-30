# Cahier des charges — Centre de rapports exportables

> Statut : **Lot 1 + Lot 2 implémentés**. Fonctionnalité optionnelle (gating par permissions de profil), multi-client.
>
> Implémenté :
> - 6 rapports (`src/lib/reportsService.js`) : Planning, Pointages, État de caisse (versements), Maintenance terminaux, Paiement gros gains, Chiffre d'affaires (CCOPE, exploitation uniquement).
> - Exporteurs CSV / Excel / PDF (`src/lib/exporters.js`, libs en import dynamique).
> - Page réutilisable selon le périmètre (`src/pages/exploitation/RapportsPage.jsx`) : filtres période + région/secteur/agence.
> - Périmètre par rôle : Exploitation (tout), Chef d'agence (son agence), Chef de secteur (agences de son secteur).
> - Audit des exports (`AUDIT_ACTIONS.EXPORT` / entité `rapport`).
>
> Reste (Lot 3) : rapports planifiés (Edge Function + cron + envoi e-mail/SMS) ; filtre région/secteur réservé à l'exploitation ; le rapport CA est un extrait brut CCOPE (colonnes dynamiques) non scopé par agence.

## 1. Objectif & valeur

Offrir un **point d'accès unique** aux rapports métier, exportables en **CSV, Excel (.xlsx) et PDF**, avec filtres (période, agence, secteur, région) et planification optionnelle (envoi périodique par e-mail/SMS). Aujourd'hui l'export existe mais est **éparpillé et CSV-only** (ex. `PlanningGeneralPage.handleExport`, `EtatCaissePage`, `ChiffresDaffairesPage`). On centralise, on enrichit les formats, et on rend l'ensemble cohérent et réutilisable.

Bénéfices : argument commercial différenciant, autonomie du client (moins de demandes ad hoc), conformité (traçabilité des exports).

## 2. Périmètre (rapports v1)

| Rapport | Source | Filtres |
|---|---|---|
| Planning général | `planning` (+ guichetières, agences) | période, agence, chef, secteur |
| Pointages / présence | pointages | période, agence, guichetière |
| États de caisse | états de caisse | période, agence |
| Chiffres d'affaires / comptable | CA existant | période, région, secteur, agence |
| Maintenance terminaux | parc + réparations | période, agence, statut |
| Paiement gros gains | paiement gain | période, agence, statut |

v2 (hors périmètre initial) : rapports RH, écarts GPS, audit.

## 3. Exigences fonctionnelles

1. **Sélecteur de rapport** + panneau de filtres standardisé (réutiliser les composants de filtre période/agence existants).
2. **Aperçu** tabulaire avant export (réutiliser les tables existantes).
3. **Export multi-format** :
   - CSV (existant — à factoriser).
   - **Excel** : en-têtes formatés, types corrects (dates/nombres), une feuille par regroupement si pertinent.
   - **PDF** : en-tête avec **logo + nom du client** (issus de `clientConfig`), période, totaux, pagination.
4. **Respect des droits** : un rapport n'est listé que si la fonctionnalité associée est active (`useFeature`) et que le rôle y a accès (profils exploitation existants).
5. **Périmètre de données par rôle** : un chef d'agence n'exporte que ses agences ; l'exploitation voit tout (réutiliser le filtrage déjà en place dans chaque espace).
6. **Traçabilité** : chaque export journalisé via `auditLog` (qui, quoi, période, format, horodatage).
7. (Option v2) **Rapports planifiés** : cron → génération → envoi e-mail/SMS (réutiliser l'Edge Function de notification).

## 4. Exigences non fonctionnelles

- **Multi-tenant** : aucun texte/donnée en dur ; branding via `clientConfig`, libellés via le catalogue de fonctionnalités.
- **Feature flag** : nouvelle clé `centre-rapports` (et sous-clés par rapport) dans `APP_SPACE_FUNCTIONALITIES` → activable par client sans toucher au code.
- **Hors-ligne** : lecture seule depuis le cache si dispo ; export désactivé proprement si données non disponibles (cohérent avec l'architecture offline).
- **Volumétrie** : pour les gros exports, génération **côté Edge Function** (pagination/streaming) pour ne pas bloquer le navigateur ; petits exports possibles côté client.
- **Performance** : génération PDF/Excel asynchrone avec retour visuel (toast + spinner), pas de gel d'UI.

## 5. Conception technique proposée

- **Couche service** `src/lib/reportsService.js` :
  - `getReportDefinitions()` → liste des rapports (clé, libellé, colonnes, requête, flag requis).
  - `runReport(key, filters)` → données normalisées `{ columns, rows, meta }`.
  - `exportReport(data, format)` → délègue aux exporteurs.
- **Exporteurs** `src/lib/exporters/{csv,xlsx,pdf}.js` — interface commune `export(data, meta) → Blob`. Factoriser le CSV existant ici.
  - Excel : `xlsx`/`exceljs`. PDF : `jspdf` + `jspdf-autotable` (léger, pas de serveur).
- **UI** : page `src/pages/exploitation/RapportsPage.jsx` (lazy route) + panneau filtres + table d'aperçu + boutons d'export. Entrées par espace (chef d'agence, etc.) réutilisant le même service avec périmètre restreint.
- **Edge Function** (gros volumes / planifié) : `supabase/functions/generate-report/` qui réutilise `reportsService` côté Deno.
- **Catalogue** : ajouter `centre-rapports` à `APP_SPACE_FUNCTIONALITIES` + router dans `App.jsx` (pattern `LazyRoute`).

## 6. Découpage en lots

1. **Lot 1 (socle)** : `reportsService` + exporteurs CSV/Excel/PDF + page Exploitation avec 2 rapports (planning, pointages) + flag + audit. → Valeur immédiate.
2. **Lot 2** : brancher les rapports restants + périmètre par rôle (chef d'agence/secteur).
3. **Lot 3** : rapports planifiés (Edge Function + cron + envoi).

## 7. Critères d'acceptation (Lot 1)

- [ ] La page n'apparaît que si `centre-rapports` est actif pour le client.
- [ ] Export CSV/Excel/PDF d'un planning sur une période donnée, données correctes et filtrées par périmètre du rôle.
- [ ] Le PDF porte le logo + nom du client courant.
- [ ] Chaque export crée une entrée d'audit.
- [ ] `npm run build` OK ; aucun gel d'UI sur un export de référence.
