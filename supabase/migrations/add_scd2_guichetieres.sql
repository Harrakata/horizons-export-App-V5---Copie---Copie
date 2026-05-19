-- ============================================================
-- SCD Type 2 sur la table "guichetieres"
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Colonnes SCD2
ALTER TABLE guichetieres ADD COLUMN IF NOT EXISTS is_current  boolean     NOT NULL DEFAULT true;
ALTER TABLE guichetieres ADD COLUMN IF NOT EXISTS valid_from  timestamptz NOT NULL DEFAULT now();
ALTER TABLE guichetieres ADD COLUMN IF NOT EXISTS valid_to    timestamptz;

-- 2. Initialiser pour les lignes existantes
UPDATE guichetieres SET is_current = true WHERE is_current IS NULL;
UPDATE guichetieres SET valid_from = COALESCE(valid_from, now()) WHERE valid_from IS NULL;

-- 3. Supprimer TOUTES les contraintes UNIQUE + FK qui en dépendent
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.guichetieres'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.guichetieres DROP CONSTRAINT %I CASCADE', c.conname);
  END LOOP;
END $$;

-- 4. Index partiels : unicité uniquement sur les lignes courantes
DROP INDEX IF EXISTS guichetieres_matricule_current_uniq;
CREATE UNIQUE INDEX guichetieres_matricule_current_uniq
  ON guichetieres(matricule) WHERE is_current = true;

DROP INDEX IF EXISTS guichetieres_codeprepose_current_uniq;
CREATE UNIQUE INDEX guichetieres_codeprepose_current_uniq
  ON guichetieres("codePrepose") WHERE is_current = true AND "codePrepose" IS NOT NULL;

-- 5. Index secondaires pour les lookups historiques
CREATE INDEX IF NOT EXISTS guichetieres_matricule_idx    ON guichetieres(matricule);
CREATE INDEX IF NOT EXISTS guichetieres_codeprepose_idx  ON guichetieres("codePrepose");
