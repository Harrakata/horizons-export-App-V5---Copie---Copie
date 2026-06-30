-- ============================================================
-- Demandes d'absence / congés (guichetières & techniciens)
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Workflow : un agent (guichetière ou technicien) demande une absence sur une
--  PLAGE de dates (congé / maladie / autre). Validation à un seul niveau :
--   * guichetière  → validée par son chef d'agence (filtre agence_nom)
--   * technicien   → validée par l'Exploitation (la table techniciens n'ayant pas
--                    d'attribut secteur/agence, la validation est centralisée).
--  Les colonnes secteur/region restent disponibles pour un usage futur (ex. si
--  un rattachement secteur est ajouté aux techniciens → validation chef-secteur).
--  Complète le système d'« indisponibilité » par créneau de planning existant
--  (planning_modification_requests / planning_maintenance_modification_requests).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.demandes_absence (
  id                      BIGSERIAL PRIMARY KEY,
  -- Demandeur
  role_demandeur          TEXT NOT NULL CHECK (role_demandeur IN ('guichetiere', 'technicien')),
  demandeur_id            TEXT NOT NULL,
  demandeur_matricule     TEXT,
  demandeur_nom           TEXT,
  agence_nom              TEXT,            -- rattachement agence (guichetière, et technicien si applicable)
  secteur                 TEXT,            -- rattachement secteur (technicien)
  region                  TEXT,
  -- Demande
  type_absence            TEXT NOT NULL DEFAULT 'conge'
                            CHECK (type_absence IN ('conge', 'maladie', 'autre')),
  date_debut              DATE NOT NULL,
  date_fin                DATE NOT NULL,
  motif                   TEXT,
  statut                  TEXT NOT NULL DEFAULT 'En attente'
                            CHECK (statut IN ('En attente', 'Approuvée', 'Refusée', 'Annulée')),
  -- Traitement (validation chef)
  traitee_par             TEXT,
  traitee_par_role        TEXT,
  commentaire_traitement  TEXT,
  date_traitement         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT demandes_absence_dates_chk CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS demandes_absence_role_idx      ON public.demandes_absence(role_demandeur);
CREATE INDEX IF NOT EXISTS demandes_absence_agence_idx    ON public.demandes_absence(agence_nom);
CREATE INDEX IF NOT EXISTS demandes_absence_secteur_idx   ON public.demandes_absence(secteur);
CREATE INDEX IF NOT EXISTS demandes_absence_demandeur_idx ON public.demandes_absence(demandeur_id);
CREATE INDEX IF NOT EXISTS demandes_absence_statut_idx    ON public.demandes_absence(statut);

-- ── RLS (permissive, calquée sur les autres tables applicatives) ──
ALTER TABLE public.demandes_absence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'demandes_absence'
      AND policyname = 'Allow app access on demandes_absence'
  ) THEN
    CREATE POLICY "Allow app access on demandes_absence" ON public.demandes_absence
      FOR ALL USING (auth.role() IN ('anon', 'authenticated'))
      WITH CHECK (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
