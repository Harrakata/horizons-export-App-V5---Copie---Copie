-- ============================================================
-- Géolocalisation terrain : vérification de présence à l'agence
-- À exécuter dans Supabase SQL Editor
-- ============================================================
--  * agences : coordonnées GPS de référence (latitude / longitude)
--  * interventions_maintenance & pointages : position capturée + écart
-- ============================================================

-- Coordonnées de référence de l'agence
ALTER TABLE public.agences ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE public.agences ADD COLUMN IF NOT EXISTS longitude double precision;

-- Position capturée lors d'une maintenance
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS latitude          double precision;
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS longitude         double precision;
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS geo_distance_m    double precision;  -- distance à l'agence (mètres)
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS geo_verified      boolean;           -- true si dans le rayon
ALTER TABLE public.interventions_maintenance ADD COLUMN IF NOT EXISTS geo_justification text;              -- justification si hors rayon

-- Position capturée lors d'un pointage
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS latitude          double precision;
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS longitude         double precision;
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS geo_distance_m    double precision;
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS geo_verified      boolean;
ALTER TABLE public.pointages ADD COLUMN IF NOT EXISTS geo_justification text;
