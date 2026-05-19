-- ============================================================
-- SCD Type 2 sur la table "chefs_agence"
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Colonnes SCD2
ALTER TABLE chefs_agence ADD COLUMN IF NOT EXISTS is_current  boolean     NOT NULL DEFAULT true;
ALTER TABLE chefs_agence ADD COLUMN IF NOT EXISTS valid_from  timestamptz NOT NULL DEFAULT now();
ALTER TABLE chefs_agence ADD COLUMN IF NOT EXISTS valid_to    timestamptz;

-- 2. Initialiser pour les lignes existantes
UPDATE chefs_agence SET is_current = true WHERE is_current IS NULL;
UPDATE chefs_agence SET valid_from = COALESCE(valid_from, now()) WHERE valid_from IS NULL;

-- 3. Supprimer TOUTES les contraintes UNIQUE + FK qui en dépendent
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.chefs_agence'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.chefs_agence DROP CONSTRAINT %I CASCADE', c.conname);
  END LOOP;
END $$;

-- 4. Index partiels : unicité uniquement sur les lignes courantes
DROP INDEX IF EXISTS chefs_agence_matricule_current_uniq;
CREATE UNIQUE INDEX chefs_agence_matricule_current_uniq
  ON chefs_agence(matricule) WHERE is_current = true;

-- 5. Index secondaires pour les lookups historiques
CREATE INDEX IF NOT EXISTS chefs_agence_matricule_idx ON chefs_agence(matricule);
