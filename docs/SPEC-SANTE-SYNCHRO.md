# Cahier des charges — Santé de la synchro hors-ligne

> Statut : proposition (non implémenté). Objectif : rendre observable le mode
> hors-ligne (cache lecture + file d'écriture) qui est aujourd'hui une boîte noire.

## 1. Contrainte d'architecture (à connaître)

Le mode hors-ligne est **100 % côté appareil** :
- File d'écriture = IndexedDB **locale** (`offlineQueue` : items `{ id, op, type, table, payload, createdAt }`).
- À la reconnexion, `flushQueue()` rejoue les items ; en cas d'échec, l'item **reste en file** (aucune remontée au serveur).
- Le serveur ne voit donc **rien** de ce qui est en attente/bloqué sur un appareil tant que ce n'est pas synchronisé.

⟹ Un tableau « par agence » côté exploitation **n'est pas possible sans télémétrie** :
il faut que les appareils **remontent** leur état de synchro à une table serveur.

## 2. Trois directions possibles

### Option A — Télémétrie + tableau exploitation (le vrai « santé synchro »)
- Nouvelle table `sync_health` (1 ligne par appareil/utilisateur) : `user_id`,
  `role`, `agence_nom`, `pending_count`, `oldest_pending_at`, `failed_count`,
  `last_sync_at`, `last_seen_at`, `app_version`, `updated_at`.
- Les espaces écrivent un **heartbeat** (à l'ouverture, après chaque flush, et
  périodiquement) via `offlineSync`. Léger, best-effort.
- Enrichir les items de file avec `retries` / `lastError` pour compter les échecs.
- Écran Exploitation : agrégation **par agence/région**, tri par ancienneté des
  écritures en attente, badges « bloqué > X h », détail par utilisateur, alerte
  (cloche) au-delà d'un seuil.
- ➜ Donne la vraie supervision. Coût : 1 migration + heartbeat + écran.

### Option B — Panneau « Ma synchro » enrichi (rapide, sans serveur)
- Améliorer `OfflineSyncIndicator` en un panneau détaillé **par appareil** :
  items en attente par type/table, ancienneté, échecs, bouton « Tout
  synchroniser », détail des erreurs.
- ➜ Aide l'agent terrain, pas la supervision exploitation. Coût faible, sans migration.

### Option C — Inférence serveur (sans télémétrie)
- Tableau exploitation basé sur la **recence des données** : agences sans
  pointage/activité récente, écarts attendus, indicateur « silencieux depuis X ».
- ➜ Approximatif (ne distingue pas « hors-ligne » de « inactif »), mais zéro code
  appareil. Réutilise le suivi d'activité existant.

## 3. Recommandation

**Option A** pour un vrai outil de supervision (objectif initial), éventuellement
combinée avec **B** (le panneau local aide l'agent à débloquer lui-même). L'option
C seule reste un proxy imparfait.

## 4. Découpage (si Option A)

1. **Lot 1** : enrichir la file (retries/lastError) + heartbeat `sync_health` +
   écran Exploitation (liste par agence, pending/échecs/ancienneté) + flag.
2. **Lot 2** : alertes (cloche) au-delà d'un seuil + filtres région/secteur +
   rapport « Santé synchro » dans le Centre de rapports.
3. **Lot 3** : panneau « Ma synchro » enrichi côté agent (Option B).

## 5. Non fonctionnel

- Heartbeat **best-effort** (jamais bloquant, échec silencieux), respect du flag
  `offline_mode`. Multi-tenant (table par client). Activation via « Profil et
  Fonctionnalité ». Volume maîtrisé (1 ligne/appareil, upsert).
