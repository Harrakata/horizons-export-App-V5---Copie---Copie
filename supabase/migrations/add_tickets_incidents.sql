-- ============================================================
-- Module Tickets / Incidents
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Remontée d'incident terrain → traitement → résolution.
--   * Déclaration : guichetière / chef d'agence (terrain).
--   * Triage/assignation : exploitation → assigne à un technicien.
--   * Résolution : technicien (statut en_cours → resolu).
--  Capitalise sur le parc terminaux (terminal_id optionnel) et complète la
--  maintenance (interventions_maintenance) en apportant l'amont (signalement).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tickets_incidents (
  id                      BIGSERIAL PRIMARY KEY,
  code                    TEXT,                 -- référence lisible (ex. INC-2026-AB12C)
  titre                   TEXT NOT NULL,
  description             TEXT,
  categorie               TEXT NOT NULL DEFAULT 'autre'
                            CHECK (categorie IN ('terminal', 'materiel', 'reseau', 'autre')),
  priorite                TEXT NOT NULL DEFAULT 'normale'
                            CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
  statut                  TEXT NOT NULL DEFAULT 'ouvert'
                            CHECK (statut IN ('ouvert', 'en_cours', 'resolu', 'cloture', 'annule')),
  -- Localisation / parc
  agence_nom              TEXT,
  terminal_id             TEXT,                 -- ref terminaux (optionnel)
  terminal_reference      TEXT,                 -- copie lisible
  -- Déclarant
  createur_role           TEXT,                 -- guichetiere | chef_agence
  createur_id             TEXT,
  createur_nom            TEXT,
  -- Assignation / traitement
  assigne_a_id            TEXT,
  assigne_a_nom           TEXT,
  commentaire_resolution  TEXT,
  resolu_par              TEXT,
  date_resolution         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS tickets_incidents_statut_idx   ON public.tickets_incidents(statut);
CREATE INDEX IF NOT EXISTS tickets_incidents_agence_idx   ON public.tickets_incidents(agence_nom);
CREATE INDEX IF NOT EXISTS tickets_incidents_assigne_idx  ON public.tickets_incidents(assigne_a_id);
CREATE INDEX IF NOT EXISTS tickets_incidents_priorite_idx ON public.tickets_incidents(priorite);
CREATE INDEX IF NOT EXISTS tickets_incidents_terminal_idx ON public.tickets_incidents(terminal_id);

-- ── RLS (permissive, calquée sur les autres tables applicatives) ──
ALTER TABLE public.tickets_incidents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tickets_incidents'
      AND policyname = 'Allow app access on tickets_incidents'
  ) THEN
    CREATE POLICY "Allow app access on tickets_incidents" ON public.tickets_incidents
      FOR ALL USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
