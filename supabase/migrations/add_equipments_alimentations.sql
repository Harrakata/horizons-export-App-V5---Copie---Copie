-- ============================================================
-- Nouveau sous-ensemble : Alimentation
-- À exécuter dans Supabase SQL Editor
-- ============================================================
-- Ajoute la table des alimentations (même structure que les autres
-- sous-ensembles) et la colonne d'affectation sur les terminaux.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.equipments_alimentations (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    modele TEXT NOT NULL,
    marque TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'Disponible',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contrainte de statut alignée sur les autres sous-ensembles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipments_alimentations_statut_check'
  ) THEN
    ALTER TABLE public.equipments_alimentations
      ADD CONSTRAINT equipments_alimentations_statut_check
      CHECK (statut IN ('Disponible', 'En service', 'En panne', 'En maintenance', 'Hors service'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipments_alimentations_reference ON public.equipments_alimentations(reference);
CREATE INDEX IF NOT EXISTS idx_equipments_alimentations_statut    ON public.equipments_alimentations(statut);

-- RLS (identique aux autres tables equipments_*)
ALTER TABLE public.equipments_alimentations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'equipments_alimentations'
      AND policyname = 'Enable all operations for authenticated users'
  ) THEN
    CREATE POLICY "Enable all operations for authenticated users" ON public.equipments_alimentations
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Trigger updated_at (la fonction public.handle_updated_at() existe déjà)
DROP TRIGGER IF EXISTS handle_equipments_alimentations_updated_at ON public.equipments_alimentations;
CREATE TRIGGER handle_equipments_alimentations_updated_at
    BEFORE UPDATE ON public.equipments_alimentations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.equipments_alimentations IS 'Table des alimentations disponibles pour les terminaux';

-- Colonne d'affectation sur les terminaux
ALTER TABLE public.terminaux ADD COLUMN IF NOT EXISTS alimentation_reference TEXT;
COMMENT ON COLUMN public.terminaux.alimentation_reference IS 'Référence de l alimentation affectée au terminal';
