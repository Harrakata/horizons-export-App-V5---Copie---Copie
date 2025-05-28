import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, isWithinInterval, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';

export const usePointageLogic = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [matricule, setMatricule] = useState('');
  const [identifiedGuichetiere, setIdentifiedGuichetiere] = useState(null);
  const [signature, setSignature] = useState(null);
  
  const [creneauxPointageSettings, setCreneauxPointageSettings] = useState([]);
  const [guichetieresPlanifieesAujourdhui, setGuichetieresPlanifieesAujourdhui] = useState([]);
  const [pointagesJournaliersAgence, setPointagesJournaliersAgence] = useState({});

  const [chefAgenceInfo, setChefAgenceInfo] = useState(null);
  const [isChefAgenceLoggedIn, setIsChefAgenceLoggedIn] = useState(false);
  const [nomAgenceAffichee, setNomAgenceAffichee] = useState("Agence Centrale");
  
  // Session timeout related states
  const [sessionDureeMinutes, setSessionDureeMinutes] = useState(30);
  const [sessionExpirationTime, setSessionExpirationTime] = useState(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [sessionExpirationMessage, setSessionExpirationMessage] = useState("");
  const sessionTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  const todayFormatted = format(new Date(), 'eeee dd MMMM yyyy', { locale: fr });
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const [currentCreneauIndex, setCurrentCreneauIndex] = useState(-1);
  const [currentPointageStatus, setCurrentPointageStatus] = useState({ canPointe: false, message: "Chargement..." });


  // function to logout chef d'agence
  const logoutChefAgence = useCallback(async () => {
    if (chefAgenceInfo?.id) {
      try {
        // Enregistrer la déconnexion dans la base de données si le chef était connecté
        const { data: connexionsData } = await supabase
          .from('connexions_chefs')
          .select('*')
          .eq('chef_agence_id', chefAgenceInfo.id)
          .is('date_deconnexion', null)
          .order('date_connexion', { ascending: false })
          .limit(1);
          
        if (connexionsData && connexionsData.length > 0) {
          await supabase
            .from('connexions_chefs')
            .update({ date_deconnexion: new Date().toISOString() })
            .eq('id', connexionsData[0].id);
        }
      } catch (error) {
        console.error("Erreur lors de l'enregistrement de la déconnexion:", error);
      }
    }
    
    localStorage.removeItem('pmuChefAuth');
    setChefAgenceInfo(null);
    setIsChefAgenceLoggedIn(false);
    setNomAgenceAffichee("Agence Centrale");
    setIsSessionExpired(false);
    
    // Clear any existing timeouts
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, [chefAgenceInfo]);

  useEffect(() => {
    const authData = JSON.parse(localStorage.getItem('pmuChefAuth'));
    if (authData && authData.isAuthenticated && authData.chefInfo) {
      setChefAgenceInfo(authData.chefInfo);
      setIsChefAgenceLoggedIn(true);
      setNomAgenceAffichee(authData.chefInfo.nomAgence || "Agence Centrale");
    } else {
      setIsChefAgenceLoggedIn(false); 
      setNomAgenceAffichee("Agence Centrale"); 
    }
  }, []);

  const loadAppSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general')
      .single();

    if (error && error.code !== 'PGRST116') { 
      console.error("Erreur chargement paramètres app:", error);
      setCreneauxPointageSettings([{ debut: '09:00', fin: '10:00' }, { debut: '14:00', fin: '15:00' }]); 
      setSessionDureeMinutes(30);
      setSessionExpirationMessage("Vous allez être automatiquement déconnecté. Veuillez demander au Chef d'agence de se reconnecter");
    } else if (data && data.value) {
      setCreneauxPointageSettings(data.value.creneauxPointage || [{ debut: '09:00', fin: '10:00' }, { debut: '14:00', fin: '15:00' }]);
      
      // Check if there's an individual session duration for current chef d'agence
      let dureeMinutes = 30;
      if (data.value.sessionDureeMinutes) {
        dureeMinutes = data.value.sessionDureeMinutes;
      }
      
      if (chefAgenceInfo && data.value.sessionDureeIndividuelle && data.value.sessionDureeIndividuelle[chefAgenceInfo.id]) {
        dureeMinutes = data.value.sessionDureeIndividuelle[chefAgenceInfo.id];
      }
      
      setSessionDureeMinutes(dureeMinutes);
      setSessionExpirationMessage(data.value.messageDeconnexion || "Vous allez être automatiquement déconnecté. Veuillez demander au Chef d'agence de se reconnecter");
    } else {
      setCreneauxPointageSettings([{ debut: '09:00', fin: '10:00' }, { debut: '14:00', fin: '15:00' }]);
      setSessionDureeMinutes(30);
      setSessionExpirationMessage("Vous allez être automatiquement déconnecté. Veuillez demander au Chef d'agence de se reconnecter");
    }
  }, [chefAgenceInfo]);

  // Set up session timeout 
  useEffect(() => {
    if (isChefAgenceLoggedIn && sessionDureeMinutes > 0) {
      // Clear any existing timeouts
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      
      // Set expiration time
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + sessionDureeMinutes);
      setSessionExpirationTime(expirationTime);
      
      // Set timeout for warning (1 minute before expiration)
      const warningTime = new Date(expirationTime);
      warningTime.setMinutes(warningTime.getMinutes() - 1);
      
      const timeUntilWarning = Math.max(0, warningTime.getTime() - new Date().getTime());
      const timeUntilExpiration = Math.max(0, expirationTime.getTime() - new Date().getTime());
      
      // Set warning timeout - only show warning once
      warningTimeoutRef.current = setTimeout(() => {
        if (isChefAgenceLoggedIn) {
          // Set the session as expired, which will trigger the warning banner
          setIsSessionExpired(true);
          
          // Show toast notification
          toast({
            title: "Session expiration",
            description: sessionExpirationMessage,
            variant: "warning",
            duration: 60000, // 1 minute
          });
        }
      }, timeUntilWarning);
      
      // Set actual logout timeout
      sessionTimeoutRef.current = setTimeout(() => {
        if (isChefAgenceLoggedIn) {
          toast({
            title: "Session expirée",
            description: "Vous avez été déconnecté en raison de l'inactivité.",
            variant: "destructive",
          });
          logoutChefAgence();
        }
      }, timeUntilExpiration);
      
      return () => {
        // Cleanup function to clear timeouts when component unmounts
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
        }
        if (warningTimeoutRef.current) {
          clearTimeout(warningTimeoutRef.current);
        }
      };
    }
  }, [isChefAgenceLoggedIn, sessionDureeMinutes, sessionExpirationMessage, logoutChefAgence, toast]);

  const loadInitialData = useCallback(async (agenceNom) => {
    if (!agenceNom || (agenceNom === "Agence Centrale" && !isChefAgenceLoggedIn)) {
        setGuichetieresPlanifieesAujourdhui([]);
        setPointagesJournaliersAgence({});
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    
    const { data: planifieesData, error: planifieesError } = await supabase
      .from('planning')
      .select('guichetieres (id, matricule, nom, prenom, photo_url)')
      .eq('agenceNom', agenceNom)
      .eq('date', todayDateStr);

    if (planifieesError) {
      toast({ title: 'Erreur chargement planning', description: planifieesError.message, variant: 'destructive' });
      setGuichetieresPlanifieesAujourdhui([]);
    } else {
      const planifiees = planifieesData.map(p => p.guichetieres).filter(Boolean);
      setGuichetieresPlanifieesAujourdhui(planifiees);

      if (planifiees.length > 0) {
        const matricules = planifiees.map(g => g.matricule);
        const { data: pointagesData, error: pointagesError } = await supabase
          .from('pointages')
          .select('*')
          .eq('date', todayDateStr)
          .eq('agence', agenceNom)
          .in('guichetiereMatricule', matricules);
        
        if (pointagesError) {
          toast({ title: 'Erreur chargement pointages', description: pointagesError.message, variant: 'destructive' });
          setPointagesJournaliersAgence({});
        } else {
          const pointagesMap = {};
          pointagesData.forEach(p => {
            if (!pointagesMap[p.guichetiereMatricule]) {
              pointagesMap[p.guichetiereMatricule] = [];
            }
            const parsedTime = p.time ? parseISO(p.time) : null;
            if (parsedTime && isValid(parsedTime)) {
                pointagesMap[p.guichetiereMatricule].push({ ...p, time: parsedTime });
            } else {
                console.warn("Invalid time value for pointage:", p);
                pointagesMap[p.guichetiereMatricule].push({ ...p, time: null }); 
            }
          });
          setPointagesJournaliersAgence(pointagesMap);
        }
      } else {
        setPointagesJournaliersAgence({});
      }
    }
    setIsLoading(false);
  }, [todayDateStr, toast, isChefAgenceLoggedIn]);

  useEffect(() => {
    loadAppSettings();
  }, [loadAppSettings]);

  useEffect(() => {
    if (nomAgenceAffichee) {
      loadInitialData(nomAgenceAffichee);
    }
  }, [nomAgenceAffichee, loadInitialData]);


  useEffect(() => {
    const updateCreneauActif = () => {
      const now = new Date();
      if (!creneauxPointageSettings || creneauxPointageSettings.length === 0) {
        setCurrentCreneauIndex(-1);
        return;
      }
      const activeCreneau = creneauxPointageSettings.findIndex(creneau => {
        if (!creneau || !creneau.debut || !creneau.fin) return false;
        const [hDebut, mDebut] = creneau.debut.split(':').map(Number);
        const [hFin, mFin] = creneau.fin.split(':').map(Number);
        if (isNaN(hDebut) || isNaN(mDebut) || isNaN(hFin) || isNaN(mFin)) return false;
        const debutCreneau = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hDebut, mDebut, 0);
        const finCreneau = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hFin, mFin, 0);
        return now >= debutCreneau && now <= finCreneau;
      });
      setCurrentCreneauIndex(activeCreneau);
    };

    updateCreneauActif();
    const interval = setInterval(updateCreneauActif, 60000); 
    return () => clearInterval(interval);
  }, [creneauxPointageSettings]);

  const checkPointageStatus = useCallback(() => {
    if (!identifiedGuichetiere || currentCreneauIndex === -1) {
      setCurrentPointageStatus({ canPointe: false, message: "Aucun créneau actif ou guichetière non identifiée." });
      return;
    }

    const pointagesGuichetiere = pointagesJournaliersAgence[identifiedGuichetiere.matricule] || [];
    const aDejaPointeCeCreneau = pointagesGuichetiere.some(p => p.creneauIndex === currentCreneauIndex);

    if (aDejaPointeCeCreneau) {
      setCurrentPointageStatus({ canPointe: false, message: `Vous avez déjà pointé pour le créneau ${currentCreneauIndex + 1}.` });
    } else {
      setCurrentPointageStatus({ canPointe: true, message: `Prêt(e) à pointer pour le créneau ${currentCreneauIndex + 1}.` });
    }
  }, [identifiedGuichetiere, currentCreneauIndex, pointagesJournaliersAgence]);

  useEffect(() => {
    if (step === 4 && identifiedGuichetiere) { 
      checkPointageStatus();
    }
  }, [step, identifiedGuichetiere, checkPointageStatus]);


  const resetProcess = useCallback(() => {
    setStep(1);
    setMatricule('');
    setIdentifiedGuichetiere(null);
    setIsLoading(false);
    if (nomAgenceAffichee) loadInitialData(nomAgenceAffichee); 
  }, [loadInitialData, nomAgenceAffichee]);

  const handleMatriculeSubmit = async () => {
    if (!matricule) {
      toast({ title: 'Erreur', description: 'Veuillez saisir un matricule.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    
    const { data: foundGuichetiere, error } = await supabase
      .from('guichetieres')
      .select('id, matricule, nom, prenom, photo_url')
      .eq('matricule', matricule)
      .single();
    
    if (error || !foundGuichetiere) {
      toast({ title: 'Matricule Invalide', description: 'Aucune guichetière trouvée avec ce matricule.', variant: 'destructive' });
      setIdentifiedGuichetiere(null);
      setIsLoading(false);
      return;
    }

    const isPlannedTodayInThisAgency = guichetieresPlanifieesAujourdhui.some(g => g.id === foundGuichetiere.id);

    if (!isPlannedTodayInThisAgency) {
      toast({ 
        title: 'Non planifiée', 
        description: `${foundGuichetiere.prenom} ${foundGuichetiere.nom} n'est pas planifiée pour aujourd'hui (${todayFormatted}) à l'agence ${nomAgenceAffichee}.`, 
        variant: 'destructive',
        duration: 7000
      });
      setIdentifiedGuichetiere(null);
      setIsLoading(false);
      return;
    }
    
    setIdentifiedGuichetiere(foundGuichetiere);
    
    toast({ title: 'Guichetière identifiée', description: `Bonjour ${foundGuichetiere.prenom} ${foundGuichetiere.nom}. Prête pour le pointage.`, className: "bg-green-500 text-white" });
    setStep(2);
    setIsLoading(false);
  };

  const handleFacialRecognitionSuccess = () => {
    setStep(3);
  };

  const handleSignature = async (signatureDataURL) => {
    if (!signatureDataURL) {
      toast({ title: 'Signature requise', description: 'Veuillez signer avant de valider.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    setSignature(signatureDataURL);
    await new Promise(resolve => setTimeout(resolve, 400)); 
    toast({ title: 'Signature', description: 'Signature validée.', className: "bg-yellow-500 text-white" });
    setStep(4);
    setIsLoading(false);
  };
  
  const validerPointage = async () => {
    if (!identifiedGuichetiere || currentCreneauIndex === -1 || !currentPointageStatus.canPointe) {
      toast({ title: 'Action impossible', description: currentPointageStatus.message || 'Impossible de valider le pointage.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    const newPointage = { 
      guichetiereMatricule: identifiedGuichetiere.matricule,
      date: todayDateStr,
      time: new Date().toISOString(), 
      type: 'standard', 
      agence: nomAgenceAffichee,
      creneauIndex: currentCreneauIndex
    };
    
    const { error } = await supabase.from('pointages').insert(newPointage);
    
    if (error) {
      toast({ title: 'Erreur de validation', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pointage validé !', description: `Merci ${identifiedGuichetiere.prenom}, votre pointage pour le créneau ${currentCreneauIndex + 1} à ${nomAgenceAffichee} a été enregistré.`, className: "bg-green-600 text-white" });
      resetProcess();
    }
    setIsLoading(false);
  };

  // Reset session timeout when there's user activity
  const resetSessionTimeout = useCallback(() => {
    if (isChefAgenceLoggedIn && sessionDureeMinutes > 0) {
      // Only reset if the session isn't already marked as expired
      if (!isSessionExpired) {
        // Clear any existing timeouts
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
        
        if (warningTimeoutRef.current) {
          clearTimeout(warningTimeoutRef.current);
          warningTimeoutRef.current = null;
        }
        
        // Set new expiration time
        const expirationTime = new Date();
        expirationTime.setMinutes(expirationTime.getMinutes() + sessionDureeMinutes);
        setSessionExpirationTime(expirationTime);
        
        // Set timeout for warning (1 minute before expiration)
        const warningTime = new Date(expirationTime);
        warningTime.setMinutes(warningTime.getMinutes() - 1);
        
        const timeUntilWarning = Math.max(0, warningTime.getTime() - new Date().getTime());
        const timeUntilExpiration = Math.max(0, expirationTime.getTime() - new Date().getTime());
        
        // Set warning timeout
        warningTimeoutRef.current = setTimeout(() => {
          if (isChefAgenceLoggedIn) {
            setIsSessionExpired(true);
            toast({
              title: "Session expiration",
              description: sessionExpirationMessage,
              variant: "warning",
              duration: 60000, // 1 minute
            });
          }
        }, timeUntilWarning);
        
        // Set actual logout timeout
        sessionTimeoutRef.current = setTimeout(() => {
          if (isChefAgenceLoggedIn) {
            toast({
              title: "Session expirée",
              description: "Vous avez été déconnecté en raison de l'inactivité.",
              variant: "destructive",
            });
            logoutChefAgence();
          }
        }, timeUntilExpiration);
      }
    }
  }, [isChefAgenceLoggedIn, isSessionExpired, sessionDureeMinutes, sessionExpirationMessage, toast, logoutChefAgence]);

  return {
    step,
    isLoading,
    matricule,
    setMatricule,
    identifiedGuichetiere,
    signature,
    setSignature,
    creneauxPointageSettings,
    guichetieresPlanifieesAujourdhui,
    pointagesJournaliersAgence,
    nomAgenceAffichee,
    todayFormatted,
    resetProcess,
    handleMatriculeSubmit,
    handleFacialRecognitionSuccess,
    handleSignature,
    validerPointage,
    setStep,
    chefAgenceInfo,
    isChefAgenceLoggedIn,
    currentPointageStatus,
    currentCreneauIndex,
    sessionExpirationTime,
    isSessionExpired,
    sessionExpirationMessage,
    logoutChefAgence,
    resetSessionTimeout,
  };
};
