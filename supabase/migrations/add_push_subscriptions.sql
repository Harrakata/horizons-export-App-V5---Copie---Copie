-- ============================================================
-- Notifications push (Web Push) — abonnements des appareils
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Chaque appareil ayant autorisé les notifications enregistre son abonnement
--  PushManager (endpoint + clés p256dh/auth). L'Edge Function `send-push` les
--  utilise pour envoyer des notifications ciblées (rôle / agence / utilisateur).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_id     TEXT,
  role        TEXT,
  agence_nom  TEXT,
  region      TEXT,
  user_nom    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS push_subscriptions_role_idx   ON public.push_subscriptions(role);
CREATE INDEX IF NOT EXISTS push_subscriptions_agence_idx ON public.push_subscriptions(agence_nom);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx   ON public.push_subscriptions(user_id);

-- ── RLS (permissive, calquée sur les autres tables applicatives) ──
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions'
      AND policyname = 'Allow app access on push_subscriptions'
  ) THEN
    CREATE POLICY "Allow app access on push_subscriptions" ON public.push_subscriptions
      FOR ALL USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
