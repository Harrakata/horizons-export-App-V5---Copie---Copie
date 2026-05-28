-- setup-vue-suivi-trm-mobi.sql
-- Crée une vue matérialisée locale pour SUIVI_TRM_MOBI_V2 (table distante FDW),
-- avec colonnes en minuscules, + index + fonction RPC de rafraîchissement.
--
-- Source  : cln_fnir_remote."SUIVI_TRM_MOBI_V2"  (colonnes MAJUSCULES)
-- Cible    : public.vue_suivi_trm_mobi_v2         (colonnes minuscules, indexée)
--
-- Table de RÉFÉRENCE (≈ 1 ligne par terminal) → pas de fenêtre de date.
--
-- À exécuter UNE fois :
--   docker compose exec -T db psql -U supabase_admin -d postgres < setup-vue-suivi-trm-mobi.sql

-- ── 1. Supprimer l'objet cible existant (quel que soit son type) ──────────────
DO $$
DECLARE kind "char";
BEGIN
  SELECT c.relkind INTO kind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'vue_suivi_trm_mobi_v2';

  IF kind = 'v'    THEN EXECUTE 'DROP VIEW public.vue_suivi_trm_mobi_v2';
  ELSIF kind = 'm' THEN EXECUTE 'DROP MATERIALIZED VIEW public.vue_suivi_trm_mobi_v2';
  ELSIF kind = 'r' THEN EXECUTE 'DROP TABLE public.vue_suivi_trm_mobi_v2';
  ELSIF kind = 'f' THEN EXECUTE 'DROP FOREIGN TABLE public.vue_suivi_trm_mobi_v2';
  END IF;
END $$;

-- ── 2. Créer la vue matérialisée avec colonnes minuscules ─────────────────────
-- Transformation robuste : tout caractère non alphanumérique (point, espace, apostrophe…)
-- devient « _ », puis passage en minuscules. Ex : "AGE D'UTILISATION" → age_d_utilisation.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(
           format('%I AS %I',
                  column_name,
                  lower(trim(both '_' from regexp_replace(column_name, '[^a-zA-Z0-9]+', '_', 'g')))
           ),
           ', ' ORDER BY ordinal_position
         )
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'cln_fnir_remote' AND table_name = 'SUIVI_TRM_MOBI_V2';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'Table cln_fnir_remote."SUIVI_TRM_MOBI_V2" introuvable ou sans colonnes.';
  END IF;

  EXECUTE format(
    'CREATE MATERIALIZED VIEW public.vue_suivi_trm_mobi_v2 AS SELECT %s FROM cln_fnir_remote.%I',
    cols, 'SUIVI_TRM_MOBI_V2'
  );
END $$;

-- ── 3. Index sur la clef de recherche ─────────────────────────────────────────
-- L'app filtre par id_trm_mobi (.eq / .in). Index unique si la clef est unique
-- (active aussi REFRESH ... CONCURRENTLY).
DO $$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uidx_vsuivi_id ON public.vue_suivi_trm_mobi_v2 (id_trm_mobi)';
EXCEPTION WHEN others THEN
  -- pas unique → index simple + REFRESH non concurrent
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vsuivi_id ON public.vue_suivi_trm_mobi_v2 (id_trm_mobi)';
  RAISE NOTICE 'id_trm_mobi non unique → index simple (REFRESH CONCURRENTLY indisponible).';
END $$;

-- ── 4. Stats + permissions PostgREST ──────────────────────────────────────────
ANALYZE public.vue_suivi_trm_mobi_v2;
GRANT SELECT ON public.vue_suivi_trm_mobi_v2 TO anon, authenticated, service_role;

-- ── 5. Fonction RPC de rafraîchissement (bouton/cron) ─────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_suivi_trm()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cln_fnir_remote
SET statement_timeout = '180s'
AS $func$
DECLARE
  n          bigint;
  started_at timestamptz := clock_timestamp();
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.vue_suivi_trm_mobi_v2;
  EXCEPTION WHEN others THEN
    REFRESH MATERIALIZED VIEW public.vue_suivi_trm_mobi_v2;
  END;
  SELECT count(*) INTO n FROM public.vue_suivi_trm_mobi_v2;
  RETURN json_build_object('ok', true, 'rows', n,
    'duration_ms', round(extract(epoch FROM (clock_timestamp() - started_at)) * 1000),
    'refreshed_at', now());
END;
$func$;
GRANT EXECUTE ON FUNCTION public.refresh_suivi_trm() TO anon, authenticated, service_role;

-- ── 6. Recharger PostgREST ────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ── 7. Vérification : nb lignes + liste des colonnes (minuscules) ─────────────
SELECT 'lignes' AS info, count(*) FROM public.vue_suivi_trm_mobi_v2;
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vue_suivi_trm_mobi_v2'
ORDER BY ordinal_position;
