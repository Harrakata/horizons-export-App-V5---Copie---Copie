-- ============================================================
-- Remontée terrain → exploitation (messagerie ascendante)
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Réutilise messages_exploitation comme inbox unique. `sens` distingue les
--  messages descendants (exploitation → terrain, défaut) des remontées
--  (terrain → exploitation). Champs expéditeur + indicateur « traité ».
--  (Migration ALTER idempotente — requiert la table messages_exploitation.)
-- ============================================================

ALTER TABLE public.messages_exploitation
  ADD COLUMN IF NOT EXISTS sens TEXT NOT NULL DEFAULT 'descendant';

ALTER TABLE public.messages_exploitation DROP CONSTRAINT IF EXISTS messages_exploitation_sens_check;
ALTER TABLE public.messages_exploitation
  ADD CONSTRAINT messages_exploitation_sens_check CHECK (sens IN ('descendant', 'remontee'));

ALTER TABLE public.messages_exploitation ADD COLUMN IF NOT EXISTS envoye_par_role TEXT;
ALTER TABLE public.messages_exploitation ADD COLUMN IF NOT EXISTS envoye_par_id   TEXT;
ALTER TABLE public.messages_exploitation ADD COLUMN IF NOT EXISTS traite          BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS messages_exploitation_sens_idx ON public.messages_exploitation(sens);
