-- ============================================================
-- Notification SMS du parieur (paiement de gain)
-- À exécuter dans Supabase SQL Editor
-- ============================================================
-- 1) Numéro de téléphone du gagnant, saisi à la création de la demande.
-- 2) Journal des SMS envoyés (alimenté par l'Edge Function notify-parieur-sms),
--    pour traçabilité et diagnostic (statut Twilio, message, erreurs).
-- ============================================================

-- 1) Téléphone du parieur sur la demande -----------------------------------
ALTER TABLE public.demandes_paiement_gain
  ADD COLUMN IF NOT EXISTS "telephoneGagnant" TEXT;

COMMENT ON COLUMN public.demandes_paiement_gain."telephoneGagnant"
  IS 'Numéro de téléphone du gagnant pour notification SMS (format E.164 recommandé)';

-- 2) Journal des notifications SMS ------------------------------------------
CREATE TABLE IF NOT EXISTS public.paiement_gain_sms_notifications (
  id           BIGSERIAL PRIMARY KEY,
  "demandeId"  BIGINT REFERENCES public.demandes_paiement_gain(id) ON DELETE SET NULL,
  "codeDemande" TEXT,
  event        TEXT NOT NULL,            -- authorized | rejected | paid
  destinataire TEXT,                     -- numéro réellement appelé
  message      TEXT,                     -- contenu envoyé
  statut       TEXT NOT NULL,            -- sent | failed | skipped
  provider     TEXT DEFAULT 'twilio',
  provider_sid TEXT,                     -- SID Twilio du message (si succès)
  error        TEXT,                     -- message d'erreur (si échec)
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS paiement_gain_sms_demande_idx
  ON public.paiement_gain_sms_notifications("demandeId");
CREATE INDEX IF NOT EXISTS paiement_gain_sms_created_idx
  ON public.paiement_gain_sms_notifications(created_at DESC);

ALTER TABLE public.paiement_gain_sms_notifications ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée à l'app (consultation de l'historique). L'écriture est faite
-- par l'Edge Function via la service_role (qui contourne la RLS) → pas de policy INSERT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paiement_gain_sms_notifications'
      AND policyname = 'Allow app select on paiement_gain_sms_notifications'
  ) THEN
    CREATE POLICY "Allow app select on paiement_gain_sms_notifications"
      ON public.paiement_gain_sms_notifications FOR SELECT
      USING (auth.role() IN ('anon', 'authenticated'));
  END IF;
END $$;
