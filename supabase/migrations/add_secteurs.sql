-- ============================================================
-- Granularité "Secteur" entre Région et Agence
-- À exécuter dans Supabase SQL Editor
-- ============================================================
--  * Table secteurs (simple, comme regions) : un secteur appartient à une région
--  * Colonne agences.secteur : une agence est rattachée à un secteur
--  * Table chefs_secteur (versionnée SCD2, comme chefs_agence)
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Table des secteurs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.secteurs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codeSecteur" text,
  nom           text NOT NULL,
  region        text,                 -- nom de la région de rattachement
  attributaire  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secteurs_nom_idx    ON public.secteurs(nom);
CREATE INDEX IF NOT EXISTS secteurs_region_idx ON public.secteurs(region);

-- ── Rattachement des agences à un secteur ───────────────────
ALTER TABLE public.agences ADD COLUMN IF NOT EXISTS secteur text;
CREATE INDEX IF NOT EXISTS agences_secteur_idx ON public.agences(secteur);

-- ── Table des chefs de secteur (SCD2, calquée sur chefs_agence) ──
CREATE TABLE IF NOT EXISTS public.chefs_secteur (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule       text,
  mdp             text,
  nom             text,
  prenom          text,
  "secteurEnCharge" text,             -- nom du secteur dont le chef a la charge
  "codeSecteur"   text,
  email           text,
  telephone       text,
  photo_url       text,
  auth_user_id    uuid,
  is_current      boolean NOT NULL DEFAULT true,
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_to        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chefs_secteur_matricule_idx ON public.chefs_secteur(matricule);
CREATE INDEX IF NOT EXISTS chefs_secteur_secteur_idx   ON public.chefs_secteur("secteurEnCharge");
CREATE INDEX IF NOT EXISTS chefs_secteur_current_idx   ON public.chefs_secteur(is_current) WHERE is_current = true;

-- ── RLS (cohérent avec le modèle existant : accès app anon/authenticated) ──
ALTER TABLE public.secteurs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chefs_secteur ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='secteurs' AND policyname='Allow app access on secteurs') THEN
    CREATE POLICY "Allow app access on secteurs" ON public.secteurs
      FOR ALL USING (auth.role() IN ('anon','authenticated')) WITH CHECK (auth.role() IN ('anon','authenticated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chefs_secteur' AND policyname='Allow app access on chefs_secteur') THEN
    CREATE POLICY "Allow app access on chefs_secteur" ON public.chefs_secteur
      FOR ALL USING (auth.role() IN ('anon','authenticated')) WITH CHECK (auth.role() IN ('anon','authenticated'));
  END IF;
END $$;
