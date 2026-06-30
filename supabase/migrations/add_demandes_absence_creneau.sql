-- ============================================================
-- Granularité matin / après-midi pour les demandes d'absence
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Ajoute un créneau à demandes_absence : journée entière (défaut), matin ou
--  après-midi. Utilisé à l'affichage et pour bloquer la planification sur la
--  période validée (le planning maintenance gère déjà matin/apres_midi).
--  (Migration ALTER idempotente — requiert add_demandes_absence.sql avant.)
-- ============================================================

ALTER TABLE public.demandes_absence
  ADD COLUMN IF NOT EXISTS creneau TEXT NOT NULL DEFAULT 'journee';

ALTER TABLE public.demandes_absence DROP CONSTRAINT IF EXISTS demandes_absence_creneau_check;
ALTER TABLE public.demandes_absence
  ADD CONSTRAINT demandes_absence_creneau_check
  CHECK (creneau IN ('journee', 'matin', 'apres_midi'));
