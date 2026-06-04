-- Corrige l'erreur PostgreSQL :
-- record "new" has no field "updated_at"
-- sur les mises a jour de public.techniciens.

ALTER TABLE public.techniciens
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

UPDATE public.techniciens
SET
  created_at = COALESCE(created_at, timezone('utc'::text, now())),
  updated_at = COALESCE(updated_at, created_at, timezone('utc'::text, now()))
WHERE created_at IS NULL OR updated_at IS NULL;

ALTER TABLE public.techniciens
  ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now()),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now()),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_techniciens_updated_at ON public.techniciens;

CREATE TRIGGER handle_techniciens_updated_at
  BEFORE UPDATE ON public.techniciens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
