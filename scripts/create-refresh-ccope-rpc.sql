-- create-refresh-ccope-rpc.sql
-- Fonction RPC appelée par le bouton « Synchroniser » de l'app :
-- rafraîchit la vue matérialisée locale public.vue_cln_fnir_ccope
-- (copie des données distantes cln_fnir_remote."CCOPE" via FDW).
--
-- À exécuter UNE fois (après avoir créé la vue matérialisée) :
--   docker compose exec -T db psql -U supabase_admin -d postgres < create-refresh-ccope-rpc.sql

CREATE OR REPLACE FUNCTION public.refresh_ccope()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER                       -- s'exécute avec les droits du propriétaire (peut REFRESH)
SET search_path = public, cln_fnir_remote
AS $$
DECLARE
  n           bigint;
  started_at  timestamptz := clock_timestamp();
BEGIN
  -- REFRESH CONCURRENTLY si un index UNIQUE existe (pas de verrou de lecture),
  -- sinon REFRESH simple (verrou ACCESS EXCLUSIVE bref pendant l'opération).
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.vue_cln_fnir_ccope;
  EXCEPTION WHEN others THEN
    REFRESH MATERIALIZED VIEW public.vue_cln_fnir_ccope;
  END;

  SELECT count(*) INTO n FROM public.vue_cln_fnir_ccope;

  RETURN json_build_object(
    'ok',          true,
    'rows',        n,
    'duration_ms', round(extract(epoch FROM (clock_timestamp() - started_at)) * 1000),
    'refreshed_at', now()
  );
END;
$$;

-- Autoriser l'appel via PostgREST (rôles API)
GRANT EXECUTE ON FUNCTION public.refresh_ccope() TO anon, authenticated, service_role;

-- Recharger le cache PostgREST pour exposer la nouvelle fonction RPC
NOTIFY pgrst, 'reload schema';

-- Test rapide (doit renvoyer { ok, rows, duration_ms, refreshed_at })
SELECT public.refresh_ccope();
