-- setup-auto-refresh-suivi.sql
-- 1. Fonction RPC pour récupérer les infos de fraîcheur de la vue matérialisée
-- 2. pg_cron : rafraîchissement automatique toutes les heures
--
-- Exécuter sur le serveur :
--   docker compose exec -T db psql -U supabase_admin -d postgres < scripts/setup-auto-refresh-suivi.sql

-- ── 1. Fonction get_suivi_refresh_info ───────────────────────────────────────
-- Retourne la date du dernier rafraîchissement et le nombre de lignes.
-- Source : pg_stat_user_tables (last_analyze ≈ dernière opération ANALYZE/REFRESH)
CREATE OR REPLACE FUNCTION public.get_suivi_refresh_info()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'last_refresh', (
      SELECT greatest(last_analyze, last_autoanalyze)
      FROM pg_stat_user_tables
      WHERE relname = 'vue_suivi_trm_mobi_v2'
    ),
    'row_count', (SELECT count(*) FROM public.vue_suivi_trm_mobi_v2)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_suivi_refresh_info() TO anon, authenticated, service_role;

-- ── 2. pg_cron : rafraîchissement automatique ────────────────────────────────
-- Prérequis : extension pg_cron activée dans supabase/docker/docker-compose.yml
--   postgresql.conf : shared_preload_libraries = 'pg_cron'
--
-- Rafraîchit la vue toutes les heures à :05 (évite les pics à :00)
SELECT cron.schedule(
  'refresh-vue-suivi-trm-mobi',       -- nom du job (unique)
  '5 * * * *',                        -- cron : toutes les heures à X:05
  $$SELECT public.refresh_suivi_trm()$$
);

-- Pour vérifier les jobs planifiés :
--   SELECT * FROM cron.job;
-- Pour supprimer le job :
--   SELECT cron.unschedule('refresh-vue-suivi-trm-mobi');

-- ── 3. Reload PostgREST pour exposer la nouvelle fonction ────────────────────
NOTIFY pgrst, 'reload schema';
