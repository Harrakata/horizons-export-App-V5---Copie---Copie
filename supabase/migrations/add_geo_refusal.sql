-- ============================================================
-- Refus des pointages / maintenances hors zone (Contrôle présence)
-- À exécuter dans Supabase SQL Editor
-- ============================================================
-- Un enregistrement hors zone peut être REFUSÉ depuis « Contrôle présence ».
-- Il est alors marqué annulé (geo_refused) et le concerné est notifié.
-- ============================================================

ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS geo_refused     boolean;
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS geo_refused_at  timestamptz;
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS geo_refusal_ack boolean; -- true une fois vu par le concerné

ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS geo_refused     boolean;
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS geo_refused_at  timestamptz;
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS geo_refusal_ack boolean;
