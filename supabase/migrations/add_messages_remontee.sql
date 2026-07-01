-- ============================================================
-- Remontée terrain → exploitation (messagerie ascendante)
-- À exécuter dans Supabase SQL Editor (ou via migrate.sh)
-- ============================================================
--  Une remontée réutilise messages_exploitation avec destinataires='exploitation'
--  (les espaces terrain ne lisent que leur rôle / 'tous' → elles ne fuient pas).
--  L'état « traité » = actif=false. AUCUNE nouvelle colonne : il suffit d'ÉLARGIR
--  la contrainte CHECK sur `destinataires` pour accepter la valeur 'exploitation'.
--  (Migration idempotente.)
-- ============================================================

ALTER TABLE public.messages_exploitation
  DROP CONSTRAINT IF EXISTS messages_exploitation_destinataires_check;

ALTER TABLE public.messages_exploitation
  ADD CONSTRAINT messages_exploitation_destinataires_check
  CHECK (destinataires IN (
    'guichetiere', 'technicien', 'chef_agence', 'chef_secteur',
    'directeur_regional', 'directeur_general', 'tous', 'exploitation'
  ));
