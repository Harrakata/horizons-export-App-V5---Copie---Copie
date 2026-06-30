# Cahier des charges — Tableau de bord Performance (cible vs réalisé)

> Statut : proposition. ⚠ Une partie existe déjà — voir §1.

## 1. Ce qui existe déjà (à NE PAS redévelopper)

`src/pages/exploitation/SalaireGuichetiereTab.jsx` contient un **moteur d'objectifs**
mûr :
- Table `objectifs_salaire` : `level` (national / région / agence / guichetière),
  `metric` (CA `mt_enr`, annulé, net, **versé `mt_verse`**, salaire, prime…),
  `period`, `target_key`, `target_value`, `target_formula`, `group_id`.
- Calcul du **réalisé** (`objectifsActuals`) en agrégeant CCOPE / versements /
  salaire par metric, avec **barres de progression** et **cascade hiérarchique**.

⟹ Le « CA réalisé vs objectif » et « versé vs objectif » sont **déjà couverts**.
Le tableau de bord doit **réutiliser** ces données, pas les recréer.

## 2. Le vrai manque (objet de cette fonctionnalité)

1. **Assiduité / présence** : taux de présence = jours pointés / jours planifiés
   (par guichetière / agence). Calculé localement dans le tab Salaire mais **pas
   exposé comme KPI de performance**.
2. **Classements** (rankings) agences & guichetières sur les indicateurs clés.
3. **Tendances** (évolution mensuelle) — courbes simples (recharts déjà présent).
4. **Écran dédié et lisible** : aujourd'hui tout est dans l'onglet Salaire (dense,
   orienté paie). Besoin d'un cockpit « Performance » digeste pour le pilotage.

## 3. Périmètre v1 (proposé)

Un onglet Exploitation **« Performance »** :
- **Sélecteurs** : période (mois), région/secteur/agence.
- **3 indicateurs cible vs réalisé** (réutilisent le moteur existant) :
  CA enregistré (`mt_enr`), Versements (`mt_verse`), + **Assiduité pointage** (nouveau).
- **Cartes KPI** : CA réalisé / objectif (% atteinte), versé / objectif, taux de présence.
- **Classement** : top/flop agences et guichetières (tri par % d'atteinte ou valeur).
- **Tendance** : courbe CA réalisé vs objectif sur les N derniers mois.
- **Export** : réutilise le Centre de rapports (nouveau rapport « Performance »).

## 4. Conception (réutilisation)

- Extraire la logique d'agrégation réalisé du tab Salaire dans un service partagé
  `src/lib/performance.js` (ou réutiliser `objectifsActuals` + ajout assiduité),
  pour ne pas dupliquer les requêtes CCOPE/versements/pointage.
- Écran `src/pages/exploitation/PerformancePage.jsx` (onglet `performance`),
  gardé par les permissions de profil + (option) un flag `performance`.
- Graphiques avec `recharts` (déjà utilisé).

## 5. Décisions à valider

- **Approche** : cockpit dédié réutilisant le moteur d'objectifs + assiduité/
  classements/tendances (recommandé) — vs autre.
- **Indicateurs v1** : CA + Versements + Assiduité (recommandé) — vs périmètre
  plus large dès le départ.
- **Assiduité** : « jours pointés / jours planifiés » sur le mois (proposé).

## 6. Découpage

1. **Lot 1** : service `performance.js` (agrégats réalisé + assiduité) + écran
   (sélecteurs, KPI, cible vs réalisé, classement) + onglet/flag.
2. **Lot 2** : tendances (courbes), rapport « Performance » exportable.
3. **Lot 3** : objectifs d'assiduité (cible de présence) + vues par espace (chef
   d'agence : sa performance).
