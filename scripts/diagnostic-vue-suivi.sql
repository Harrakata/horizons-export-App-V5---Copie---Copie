-- ============================================================
-- DIAGNOSTIC vue_suivi_trm_mobi_v2
-- Copier-coller dans l'éditeur SQL Supabase, exécuter bloc par bloc
-- ============================================================

-- ── 1. Métadonnées de la vue matérialisée ────────────────────
-- Date du dernier REFRESH + nombre de lignes
SELECT
  schemaname,
  relname,
  n_live_tup         AS lignes,
  last_analyze       AS dernier_analyze,
  last_autoanalyze   AS dernier_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'vue_suivi_trm_mobi_v2';

-- ── 2. Distribution des valeurs hors_service ─────────────────
-- Vérifie si les valeurs sont cohérentes (pas toutes à 0 ou 1)
SELECT
  hors_service,
  count(*) AS nb_terminaux
FROM public.vue_suivi_trm_mobi_v2
GROUP BY hors_service
ORDER BY hors_service;

-- ── 3. Comparer vue vs source FDW ────────────────────────────
-- Repère les terminaux avec un delta entre la vue et la source
-- (nécessite accès au schema FDW cln_fnir_remote)
SELECT
  v.id_trm_mobi,
  v.hors_service              AS vue_hors_service,
  f."HORS_SERVICE"            AS fdw_hors_service,
  v.derniere_utilisation      AS vue_derniere_util,
  f."DERNIERE_UTILISATION"    AS fdw_derniere_util
FROM public.vue_suivi_trm_mobi_v2 v
JOIN cln_fnir_remote."SUIVI_TRM_MOBI_V2" f
  ON f."ID_TRM_MOBI" = v.id_trm_mobi
WHERE v.hors_service IS DISTINCT FROM f."HORS_SERVICE"
   OR v.derniere_utilisation IS DISTINCT FROM f."DERNIERE_UTILISATION"
LIMIT 20;

-- ── 4. Nombre de lignes dans la source FDW ───────────────────
-- Si ce count diffère de la vue → le REFRESH n'est pas à jour
SELECT count(*) AS lignes_fdw FROM cln_fnir_remote."SUIVI_TRM_MOBI_V2";
SELECT count(*) AS lignes_vue FROM public.vue_suivi_trm_mobi_v2;

-- ── 5. Valeurs max/min de hors_service dans la source FDW ────
SELECT
  min("HORS_SERVICE") AS min_hs,
  max("HORS_SERVICE") AS max_hs,
  avg("HORS_SERVICE") AS avg_hs,
  count(*) FILTER (WHERE "HORS_SERVICE" = 0) AS nb_actifs,
  count(*) FILTER (WHERE "HORS_SERVICE" > 0) AS nb_hs
FROM cln_fnir_remote."SUIVI_TRM_MOBI_V2";

-- ── 6. Forcer le REFRESH maintenant (depuis SQL Editor) ──────
-- Bypasse Kong → pas de timeout
-- À exécuter si les requêtes ci-dessus montrent un delta
SELECT public.refresh_suivi_trm();
