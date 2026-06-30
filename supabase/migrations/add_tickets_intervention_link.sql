-- ============================================================
-- Lien Ticket ↔ Intervention de maintenance + type de terminal
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  À la résolution d'un ticket « terminal », le technicien peut créer une
--  intervention de maintenance liée. On conserve la référence sur le ticket.
--  `terminal_kind` distingue terminal fixe (interventions_maintenance) et
--  terminal Mobi (terminaux_mobi) — l'intervention liée ne concerne que les fixes.
--  (Migration ALTER idempotente — requiert add_tickets_incidents.sql avant.)
-- ============================================================

ALTER TABLE public.tickets_incidents
  ADD COLUMN IF NOT EXISTS intervention_id TEXT;

ALTER TABLE public.tickets_incidents
  ADD COLUMN IF NOT EXISTS terminal_kind TEXT;   -- 'fixe' | 'mobi'

CREATE INDEX IF NOT EXISTS tickets_incidents_intervention_idx
  ON public.tickets_incidents(intervention_id);

-- Ajout de la catégorie « mobi » (terminal Mobi) à la contrainte CHECK.
ALTER TABLE public.tickets_incidents DROP CONSTRAINT IF EXISTS tickets_incidents_categorie_check;
ALTER TABLE public.tickets_incidents
  ADD CONSTRAINT tickets_incidents_categorie_check
  CHECK (categorie IN ('terminal', 'mobi', 'materiel', 'reseau', 'autre'));
