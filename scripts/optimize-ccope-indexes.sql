-- optimize-ccope-indexes.sql
-- Corrige les « statement timeout » sur l'État Opérateur / Salaire guichetière.
--
-- Contexte : cln_fnir_remote."CCOPE" est une TABLE DISTANTE (postgres_fdw) — les données
-- sont sur un autre serveur. On ne peut pas l'indexer, et chaque requête traverse le réseau
-- → lent → timeout.
--
-- Solution : remplacer la vue simple par une VUE MATÉRIALISÉE locale (copie indexable),
-- avec colonnes en minuscules. L'app lit la copie locale rapide ; il suffit de la
-- rafraîchir périodiquement (REFRESH) pour récupérer les nouvelles données distantes.
--
-- À exécuter UNE fois :
--   docker compose exec -T db psql -U supabase_admin -d postgres < optimize-ccope-indexes.sql

-- ── 1. Supprimer l'objet vue_cln_fnir_ccope existant (quel que soit son type) ──
DO $$
DECLARE kind "char";
BEGIN
  SELECT c.relkind INTO kind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'vue_cln_fnir_ccope';

  IF kind = 'v'      THEN EXECUTE 'DROP VIEW public.vue_cln_fnir_ccope';
  ELSIF kind = 'm'   THEN EXECUTE 'DROP MATERIALIZED VIEW public.vue_cln_fnir_ccope';
  ELSIF kind = 'r'   THEN EXECUTE 'DROP TABLE public.vue_cln_fnir_ccope';
  ELSIF kind = 'f'   THEN EXECUTE 'DROP FOREIGN TABLE public.vue_cln_fnir_ccope';
  END IF;
END $$;

-- ── 2. Créer la vue matérialisée avec colonnes minuscules + FILTRE de période ──
-- ⚙️ FENÊTRE DE DONNÉES : on ne copie localement que les N derniers mois.
--    18 mois couvrent les objectifs mensuels + trimestriels + annuels avec marge.
--    Pour tout garder (4 ans), mettez par ex. '60 months'. Pour alléger, '12 months'.
DO $$
DECLARE
  cols       text;
  date_col   text;
  window_age text := '18 months';   -- ← ajustez ici la profondeur d'historique conservée
BEGIN
  -- Liste des colonnes aliasées en minuscules
  SELECT string_agg(
           format('%I AS %I', column_name, lower(replace(column_name, '.', '_'))),
           ', ' ORDER BY ordinal_position
         )
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'cln_fnir_remote' AND table_name = 'CCOPE';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'Table cln_fnir_remote."CCOPE" introuvable ou sans colonnes.';
  END IF;

  -- Nom réel de la colonne date (pour le WHERE, poussé au serveur distant via FDW)
  SELECT column_name INTO date_col
  FROM information_schema.columns
  WHERE table_schema = 'cln_fnir_remote' AND table_name = 'CCOPE'
    AND lower(replace(column_name, '.', '_')) = 'date_op'
  LIMIT 1;

  IF date_col IS NULL THEN
    RAISE EXCEPTION 'Colonne date (date_op) introuvable dans cln_fnir_remote."CCOPE".';
  END IF;

  EXECUTE format(
    'CREATE MATERIALIZED VIEW public.vue_cln_fnir_ccope AS
       SELECT %s FROM cln_fnir_remote.%I
       WHERE %I >= (CURRENT_DATE - INTERVAL %L)',
    cols, 'CCOPE', date_col, window_age
  );
  RAISE NOTICE 'Vue matérialisée créée (fenêtre : % glissants).', window_age;
END $$;

-- ── 3. Index sur la vue matérialisée (colonnes minuscules) ────────────────────
CREATE INDEX IF NOT EXISTS idx_vue_ccope_date_op   ON public.vue_cln_fnir_ccope (date_op);
CREATE INDEX IF NOT EXISTS idx_vue_ccope_operateur ON public.vue_cln_fnir_ccope (operateur);
CREATE INDEX IF NOT EXISTS idx_vue_ccope_date_oper ON public.vue_cln_fnir_ccope (date_op, operateur);
-- Index UNIQUE sur id_ccope → permet les futurs REFRESH ... CONCURRENTLY (sans verrou de lecture).
-- (échoue silencieusement si id_ccope n'est pas unique : on l'ignore dans ce cas)
DO $$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uidx_vue_ccope_id ON public.vue_cln_fnir_ccope (id_ccope)';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'id_ccope non unique → REFRESH CONCURRENTLY indisponible (REFRESH simple OK).';
END $$;

-- ── 4. Statistiques + permissions PostgREST ───────────────────────────────────
ANALYZE public.vue_cln_fnir_ccope;
GRANT SELECT ON public.vue_cln_fnir_ccope TO anon, authenticated, service_role;

-- ── 5. Relever le statement_timeout des rôles API (défaut Supabase = 8s) ──────
ALTER ROLE authenticated SET statement_timeout = '30s';
ALTER ROLE anon          SET statement_timeout = '30s';
ALTER ROLE service_role  SET statement_timeout = '120s';

-- ── 6. Recharger PostgREST ────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ── 7. Vérification ───────────────────────────────────────────────────────────
SELECT 'lignes' AS info, count(*) FROM public.vue_cln_fnir_ccope;
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'vue_cln_fnir_ccope';
