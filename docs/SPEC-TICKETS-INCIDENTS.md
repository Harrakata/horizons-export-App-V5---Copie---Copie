# Cahier des charges — Module Tickets / Incidents

> Statut : proposition (non implémenté). Fonctionnalité optionnelle, multi-client,
> calquée sur les patterns existants (modification_requests, absences, audit).

## 1. Objectif & valeur

Permettre de **signaler et suivre** un problème terrain (terminal en panne, matériel,
réseau, autre) depuis sa déclaration jusqu'à sa résolution, avec traçabilité et
priorité. Capitalise sur le **parc terminaux** existant (`terminaux`, `agences`,
`codes_pannes`) et complète le système de **maintenance** (interventions) en lui
apportant l'amont manquant : la **remontée d'incident** par le terrain.

Aujourd'hui : les interventions de maintenance sont planifiées/saisies par les
techniciens, mais **aucun flux ne permet à une guichetière/un chef de signaler un
incident**. Ce module comble ce trou.

## 2. Modèle de données (proposition)

Table `tickets_incidents` (migration dédiée, RLS permissive comme les autres) :

| Champ | Type | Notes |
|---|---|---|
| id | BIGSERIAL PK | |
| code | TEXT | référence lisible (ex. INC-2026-0001), générée |
| titre | TEXT NOT NULL | résumé court |
| description | TEXT | détail |
| categorie | TEXT | `terminal` \| `materiel` \| `reseau` \| `autre` |
| priorite | TEXT | `basse` \| `normale` \| `haute` \| `urgente` |
| statut | TEXT | `ouvert` \| `en_cours` \| `resolu` \| `cloture` \| `annule` |
| agence_nom | TEXT | agence concernée |
| terminal_id | TEXT | terminal concerné (optionnel, ref `terminaux`) |
| createur_role / createur_id / createur_nom | TEXT | déclarant |
| assigne_a_id / assigne_a_nom | TEXT | technicien/responsable assigné |
| commentaire_resolution | TEXT | |
| resolu_par / date_resolution | TEXT / TIMESTAMPTZ | |
| created_at / updated_at | TIMESTAMPTZ | |

(Option) table `tickets_incidents_events` pour l'historique des changements de
statut/commentaires (calquée sur `paiement_gain_workflow_events`).

## 3. Rôles & flux (à valider — cf. décisions)

- **Déclaration** : guichetière / chef d'agence (terrain) → crée un ticket.
- **Triage / assignation** : exploitation (ou chef) assigne à un technicien et
  fixe la priorité.
- **Traitement** : le technicien passe `en_cours` → `resolu` (avec commentaire),
  peut lier à une intervention de maintenance existante.
- **Clôture** : exploitation (ou créateur) clôture.

## 4. UI (réutilise les patterns existants)

- Composant `TicketsPanel` réutilisable (liste + filtres statut/priorité + détail),
  décliné par rôle (création vs traitement), comme les panneaux Absences.
- Intégration par espace : déclaration côté Guichetière/Chef d'agence ; file de
  traitement côté Technicien/Maintenance et Exploitation.
- Vue Kanban/colonnes par statut (option v2) ; badges de priorité ; lien terminal.
- Notifications (réutilise `NotificationBell` / `useSpaceNotifications`) sur
  création et changement de statut.

## 5. Non fonctionnel

- **Multi-tenant** : aucune donnée en dur ; flag/onglets via le système
  `functionalites_espaces` + permissions de profil (comme Rapports/Absences).
- **Hors-ligne** : création possible via la file d'écriture (`enqueueOffline`) ;
  lecture via cache. (Option — à confirmer.)
- **Audit** : journalisation des créations/résolutions (`auditLog`, nouvelle entité
  `ticket`).
- **SLA** (option v2) : délai cible par priorité + indicateur de retard.

## 6. Découpage en lots

1. **Lot 1 (socle)** : table + service + création (guichetière/chef) + file de
   traitement (exploitation) avec changement de statut + assignation + audit + flag.
2. **Lot 2** : espace technicien (mes tickets assignés), lien terminal↔intervention,
   notifications, filtres avancés.
3. **Lot 3** : SLA / priorité avec alertes, vue Kanban, statistiques (intégrables au
   Centre de rapports : nouveau rapport « Tickets »).

## 7. Critères d'acceptation (Lot 1)

- [ ] Une guichetière/un chef crée un ticket (titre, catégorie, priorité, agence,
      terminal optionnel) → statut `ouvert`.
- [ ] L'exploitation voit la file, assigne, change le statut, ajoute un commentaire.
- [ ] Chaque création/résolution est auditée.
- [ ] L'onglet n'apparaît que si la fonctionnalité est activée pour le profil/client.
- [ ] `npm run build` OK + smoke E2E vert.
