-- ============================================================
-- Suivi des activités utilisateurs (sessions + navigation)
-- À exécuter dans Supabase SQL Editor
-- ============================================================
-- Deux tables :
--   * activites_sessions   : 1 ligne par session ouverte dans un espace
--                            (état temps réel via last_seen_at / ended_at)
--   * activites_evenements : 1 ligne par évènement (login, navigation, logout)
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Table des sessions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activites_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_key     text        NOT NULL,
  user_key      text        NOT NULL,
  user_email    text,
  user_name     text,
  user_role     text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  current_path  text,
  nav_count     integer     NOT NULL DEFAULT 0,
  user_agent    text
);

CREATE INDEX IF NOT EXISTS activites_sessions_space_idx     ON public.activites_sessions(space_key);
CREATE INDEX IF NOT EXISTS activites_sessions_user_idx      ON public.activites_sessions(user_key);
CREATE INDEX IF NOT EXISTS activites_sessions_last_seen_idx ON public.activites_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS activites_sessions_active_idx    ON public.activites_sessions(last_seen_at DESC) WHERE ended_at IS NULL;

-- ── Table des évènements ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activites_evenements (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  uuid        REFERENCES public.activites_sessions(id) ON DELETE CASCADE,
  space_key   text        NOT NULL,
  user_key    text        NOT NULL,
  event_type  text        NOT NULL,            -- 'login' | 'navigation' | 'logout'
  path        text,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activites_evenements_session_idx ON public.activites_evenements(session_id);
CREATE INDEX IF NOT EXISTS activites_evenements_user_idx    ON public.activites_evenements(user_key);
CREATE INDEX IF NOT EXISTS activites_evenements_created_idx ON public.activites_evenements(created_at DESC);

-- ── Row Level Security ──────────────────────────────────────
-- Le suivi tourne dans tous les espaces, y compris ceux sans session
-- Supabase Auth (rôle anon). On autorise donc anon + authenticated,
-- à l'image de la table public.planning_maintenance.
ALTER TABLE public.activites_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activites_evenements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activites_sessions'
      AND policyname = 'Allow app access on activites_sessions'
  ) THEN
    CREATE POLICY "Allow app access on activites_sessions"
      ON public.activites_sessions
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activites_evenements'
      AND policyname = 'Allow app access on activites_evenements'
  ) THEN
    CREATE POLICY "Allow app access on activites_evenements"
      ON public.activites_evenements
      FOR ALL
      USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;

-- ============================================================
-- Purge optionnelle (à planifier via pg_cron si souhaité) :
--   DELETE FROM public.activites_sessions WHERE last_seen_at < now() - interval '90 days';
-- ============================================================
