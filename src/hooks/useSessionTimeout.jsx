import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook pour gérer la durée de la session avec déconnexion automatique
 * 
 * @param {number} sessionDurationMinutes - Durée de la session en minutes
 * @param {function} onTimeout - Fonction à exécuter lors de l'expiration de session
 * @param {string} authStorageKey - Clé de stockage local pour l'authentification
 * @returns {object} - État de la session et fonctions utilitaires
 */
export const useSessionTimeout = (sessionDurationMinutes = 30, onTimeout, authStorageKey) => {
  const { toast } = useToast();
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(sessionDurationMinutes * 60);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [warningShown, setWarningShown] = useState(false);

  // Réinitialiser le timer quand l'utilisateur est actif
  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    setSessionExpiring(false);
    setWarningShown(false);
  }, []);

  // Vérifier l'expiration de la session
  useEffect(() => {
    // Convertir la durée en millisecondes
    const sessionDurationMs = sessionDurationMinutes * 60 * 1000;
    const warningTimeMs = 2 * 60 * 1000; // Avertissement 2 minutes avant expiration
    
    const checkSession = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const timeLeft = sessionDurationMs - timeSinceLastActivity;
      
      // Mettre à jour le temps restant
      setTimeRemaining(Math.max(0, Math.floor(timeLeft / 1000)));
      
      // Si le temps restant est inférieur au temps d'avertissement
      if (timeLeft <= warningTimeMs && timeLeft > 0 && !warningShown) {
        setSessionExpiring(true);
        setWarningShown(true);
        toast({
          title: "Session expirante",
          description: `Votre session expirera dans ${Math.ceil(timeLeft / 60000)} minutes par inactivité.`,
          variant: "warning",
          duration: 10000
        });
      }
      
      // Si la session a expiré
      if (timeLeft <= 0) {
        // Exécuter la fonction de déconnexion
        if (onTimeout) {
          onTimeout();
        }
        
        // Supprimer la session du stockage local
        if (authStorageKey) {
          localStorage.removeItem(authStorageKey);
        }
        
        // Notification d'expiration
        toast({
          title: "Session expirée",
          description: "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive",
          duration: 5000
        });
        
        // Réinitialiser l'état
        setSessionExpiring(false);
        setWarningShown(false);
      }
    };
    
    // Vérifier la session toutes les secondes
    const interval = setInterval(checkSession, 1000);
    
    // Événements pour détecter l'activité de l'utilisateur
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleUserActivity = () => {
      resetTimer();
    };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });
    
    // Nettoyage
    return () => {
      clearInterval(interval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [lastActivity, sessionDurationMinutes, onTimeout, resetTimer, toast, warningShown, authStorageKey]);
  
  // Fonction pour formater le temps restant en MM:SS
  const formatTimeRemaining = useCallback(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);
  
  return {
    sessionExpiring,
    timeRemaining,
    formatTimeRemaining,
    resetTimer
  };
}; 