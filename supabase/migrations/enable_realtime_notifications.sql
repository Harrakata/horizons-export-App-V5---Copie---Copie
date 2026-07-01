-- ============================================================
-- Activer Supabase Realtime sur les tables sources de notifications
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Permet aux espaces de recevoir les changements en temps réel (INSERT/UPDATE)
--  et de déclencher la notification correspondante instantanément, sans attendre
--  le sondage périodique. Idempotent : n'ajoute que les tables existantes et non
--  déjà présentes dans la publication `supabase_realtime`.
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'messages_exploitation',
    'tickets_incidents',
    'demandes_absence',
    'planning_modification_requests',
    'planning_maintenance_modification_requests',
    'demandes_paiement_gain',
    'points_vente_mobi_change_requests',
    'sync_health'
  ];
BEGIN
  -- La publication supabase_realtime existe par défaut sur les projets Supabase.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime absente — Realtime non configuré sur ce projet.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
