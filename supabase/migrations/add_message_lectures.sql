-- ============================================================
-- Accusés de lecture des messages de l'exploitation
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Le ciblage des messages (messages_exploitation) existe déjà. Cette table
--  trace QUI a lu QUEL message (1 ligne par destinataire ayant ouvert le message),
--  pour donner à l'exploitation un accusé de lecture (X/Y lus).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_lectures (
  id          BIGSERIAL PRIMARY KEY,
  message_id  BIGINT NOT NULL,
  reader_id   TEXT NOT NULL,
  reader_role TEXT,
  reader_nom  TEXT,
  agence_nom  TEXT,
  lu_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT message_lectures_uniq UNIQUE (message_id, reader_id)
);

CREATE INDEX IF NOT EXISTS message_lectures_message_idx ON public.message_lectures(message_id);

-- ── RLS (permissive, calquée sur les autres tables applicatives) ──
ALTER TABLE public.message_lectures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'message_lectures'
      AND policyname = 'Allow app access on message_lectures'
  ) THEN
    CREATE POLICY "Allow app access on message_lectures" ON public.message_lectures
      FOR ALL USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
