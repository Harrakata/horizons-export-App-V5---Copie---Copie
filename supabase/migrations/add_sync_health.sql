-- ============================================================
-- Santé de la synchro hors-ligne (télémétrie par appareil)
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  La file d'écriture hors-ligne est locale à chaque appareil (IndexedDB).
--  Pour donner à l'exploitation une visibilité, chaque appareil remonte un
--  « heartbeat » de son état de synchro (best-effort) dans cette table.
--  1 ligne par appareil (upsert sur device_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sync_health (
  id                BIGSERIAL PRIMARY KEY,
  device_id         TEXT NOT NULL UNIQUE,
  user_id           TEXT,
  user_nom          TEXT,
  role              TEXT,                 -- guichetiere | technicien | chef_agence | ...
  agence_nom        TEXT,
  region            TEXT,
  pending_count     INTEGER NOT NULL DEFAULT 0,
  oldest_pending_at TIMESTAMPTZ,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  last_sync_at      TIMESTAMPTZ,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  app_version       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS sync_health_agence_idx    ON public.sync_health(agence_nom);
CREATE INDEX IF NOT EXISTS sync_health_last_seen_idx ON public.sync_health(last_seen_at);
CREATE INDEX IF NOT EXISTS sync_health_pending_idx   ON public.sync_health(pending_count);

-- ── RLS (permissive, calquée sur les autres tables applicatives) ──
ALTER TABLE public.sync_health ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sync_health'
      AND policyname = 'Allow app access on sync_health'
  ) THEN
    CREATE POLICY "Allow app access on sync_health" ON public.sync_health
      FOR ALL USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
