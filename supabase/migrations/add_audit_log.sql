-- ============================================================
-- Journal d'audit des actions sensibles (audit_log)
-- À exécuter dans Supabase SQL Editor
-- ============================================================
-- Une ligne par action sensible (création/modification/suppression,
-- validation/refus de paiement, etc.). Journal volontairement IMMUABLE :
-- aucune policy UPDATE/DELETE n'est créée.
-- ============================================================

create extension if not exists "pgcrypto";

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  space         text,                  -- espace d'origine (espace-exploitation, …)
  actor_id      text,                  -- identifiant de l'acteur (uid, id, matricule)
  actor_name    text,                  -- nom affiché de l'acteur
  actor_role    text,                  -- rôle / fonction
  action        text NOT NULL,         -- create | update | delete | validate | refuse | …
  entity        text NOT NULL,         -- agence | terminal | paiement_gain | point_vente | …
  entity_id     text,                  -- identifiant de l'entité concernée
  entity_label  text,                  -- libellé lisible (ex. nom de l'agence)
  details       jsonb                  -- charge utile libre (avant/après, montant, motif…)
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx  ON public.audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx   ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS audit_log_space_idx   ON public.audit_log(space);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Lecture + insertion autorisées à l'app (cohérent avec le modèle existant).
-- Pas de policy UPDATE/DELETE → journal inviolable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'Allow app select on audit_log'
  ) THEN
    CREATE POLICY "Allow app select on audit_log"
      ON public.audit_log FOR SELECT
      USING (auth.role() IN ('anon', 'authenticated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'Allow app insert on audit_log'
  ) THEN
    CREATE POLICY "Allow app insert on audit_log"
      ON public.audit_log FOR INSERT
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
