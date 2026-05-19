-- ============================================================
-- SCD Type 2 sur la table "agences"
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Colonnes SCD2
ALTER TABLE agences ADD COLUMN IF NOT EXISTS is_current  boolean     NOT NULL DEFAULT true;
ALTER TABLE agences ADD COLUMN IF NOT EXISTS valid_from  timestamptz NOT NULL DEFAULT now();
ALTER TABLE agences ADD COLUMN IF NOT EXISTS valid_to    timestamptz;

-- 2. Initialiser pour les lignes existantes
UPDATE agences SET is_current = true WHERE is_current IS NULL;
UPDATE agences SET valid_from = COALESCE(valid_from, now()) WHERE valid_from IS NULL;

-- 3. Supprimer TOUTES les contraintes UNIQUE de agences (nom, codePDV, etc.)
-- + les FK qui en dépendent (PostgreSQL les supprime automatiquement en CASCADE)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.agences'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.agences DROP CONSTRAINT %I CASCADE', c.conname);
  END LOOP;
END $$;

-- 4. Index partiels : unicité uniquement sur les lignes courantes
DROP INDEX IF EXISTS agences_nom_current_uniq;
CREATE UNIQUE INDEX agences_nom_current_uniq
  ON agences(nom) WHERE is_current = true;

DROP INDEX IF EXISTS agences_codepdv_current_uniq;
CREATE UNIQUE INDEX agences_codepdv_current_uniq
  ON agences("codePDV") WHERE is_current = true;

-- 5. Index secondaires pour les lookups historiques
CREATE INDEX IF NOT EXISTS agences_nom_idx     ON agences(nom);
CREATE INDEX IF NOT EXISTS agences_codepdv_idx ON agences("codePDV");

-- ============================================================
-- Note :
--   Les FK pointant vers agences.nom ou agences.codePDV sont supprimées.
--   L'intégrité référentielle est désormais maintenue par l'application
--   (cascade UPDATE des références lors d'un renommage).
-- ============================================================
