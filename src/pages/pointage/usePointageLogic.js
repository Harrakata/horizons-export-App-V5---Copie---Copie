
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getGuichetieresPlanifieesPourAgence, getPointagesPourGuichetieres } from '@/lib/pointageUtils';

export const usePointageLogic = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [matricule, setMatricule] = useState('');
  const [identifiedGuichetiere, setIdentifiedGuichetiere] = useState(null);
  
  const [maxPointages, setMaxPointages] = useState(3);
  const [guichetieresPlanifieesAujourdhui, setGuichetieresPlanifieesAujourdhui] = useState([]);
  const [pointagesJournaliersAgence, setPointagesJournaliersAgence] = useState({});

  const [chefAgenceInfo, setChefAgenceInfo] = useState(null);
  const [isChefAgenceLoggedIn, setIsChefAgenceLoggedIn] = useState(false);
  const [nomAgenceAffichee, setNomAgenceAffichee] = useState("Agence Centrale");

  const todayFormatted = format(new Date(), 'eeee dd MMMM yyyy', { locale: fr });
  const todayDateStr = new Date().toISOString().split('T')[0];

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

  const loadInitialData = useCallback(() => {
    const storedSettings = JSON.parse(localStorage.getItem('pmuAppSettings'));
    if (storedSettings && storedSettings.nombrePointages) {
      setMaxPointages(parseInt(storedSettings.nombrePointages, 10) || 3);
    } else {
      setMaxPointages(3);
    }

    const agenceToUse = isChefAgenceLoggedIn && chefAgenceInfo ? chefAgenceInfo.nomAgence : "Agence Centrale";
    
    const planifiees = getGuichetieresPlanifieesPourAgence(agenceToUse, todayDateStr);
    setGuichetieresPlanifieesAujourdhui(planifiees);
    
    const pointages = getPointagesPourGuichetieres(planifiees.map(g => g.matricule), todayDateStr);
    setPointagesJournaliersAgence(pointages);

  }, [isChefAgenceLoggedIn, chefAgenceInfo, todayDateStr]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, nomAgenceAffichee]); // Re-load if agency name changes (login/logout)

  const resetProcess = useCallback(() => {
    setStep(1);
    setMatricule('');
    setIdentifiedGuichetiere(null);
    setIsLoading(false);
    loadInitialData(); 
  }, [loadInitialData]);

  const handleMatriculeSubmit = async () => {
    if (!matricule) {
      toast({ title: 'Erreur', description: 'Veuillez saisir un matricule.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 300)); 

    const guichetieres = JSON.parse(localStorage.getItem('pmuGuichetieres')) || [];
    const foundGuichetiere = guichetieres.find(g => g.matricule === matricule);
    
    if (!foundGuichetiere) {
      toast({ title: 'Matricule Invalide', description: 'Aucune guichetière trouvée avec ce matricule.', variant: 'destructive' });
      setIdentifiedGuichetiere(null);
      setIsLoading(false);
      return;
    }

    const agenceRelevant = isChefAgenceLoggedIn && chefAgenceInfo ? chefAgenceInfo.nomAgence : "Agence Centrale";
    const planifieesAgenceActuelle = getGuichetieresPlanifieesPourAgence(agenceRelevant, todayDateStr);
    const isPlannedTodayInThisAgency = planifieesAgenceActuelle.some(g => g.id === foundGuichetiere.id);


    if (!isPlannedTodayInThisAgency) {
      toast({ 
        title: 'Non planifiée', 
        description: `${foundGuichetiere.prenom} ${foundGuichetiere.nom} n'est pas planifiée pour aujourd'hui (${todayFormatted}) à l'agence ${agenceRelevant}.`, 
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

  const handleFacialRecognition = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); 
    toast({ title: 'Reconnaissance faciale', description: 'Simulation de reconnaissance faciale réussie.', className: "bg-blue-500 text-white" });
    setStep(3);
    setIsLoading(false);
  };

  const handleSignature = async (signatureDataURL) => {
    setIsLoading(true);
    // ici tu pourrais stocker la signature dans un state si tu veux l’afficher dans ConfirmationStep
    setSignature(signatureDataURL); // si tu as ce state quelque part
    await new Promise(resolve => setTimeout(resolve, 400)); 
    toast({ title: 'Signature', description: 'Signature validée.', className: "bg-yellow-500 text-white" });
    setStep(4);
    setIsLoading(false);
  };
  
  const validerPointage = async () => {
    if (!identifiedGuichetiere) return;
    setIsLoading(true);
    
    const agencePourPointage = isChefAgenceLoggedIn && chefAgenceInfo ? chefAgenceInfo.nomAgence : "Agence Centrale";
    const pointagesPourAgenceEtDate = getPointagesPourGuichetieres([identifiedGuichetiere.matricule], todayDateStr);
    const currentPointagesForGuichetiere = (pointagesPourAgenceEtDate[identifiedGuichetiere.matricule] || []).filter(p => p.date === todayDateStr);

    if (currentPointagesForGuichetiere.length >= maxPointages) {
      toast({ title: 'Limite atteinte', description: 'Nombre maximum de pointages pour aujourd\'hui déjà atteint.', variant: 'destructive' });
      resetProcess();
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 300)); 

    const newPointage = { time: new Date().toISOString(), type: 'standard', date: todayDateStr, agence: agencePourPointage };
    
    const allPointagesStorage = JSON.parse(localStorage.getItem('pmuPointages')) || {};
    if (!allPointagesStorage[identifiedGuichetiere.matricule]) {
      allPointagesStorage[identifiedGuichetiere.matricule] = {};
    }
    if (!allPointagesStorage[identifiedGuichetiere.matricule][todayDateStr]) {
      allPointagesStorage[identifiedGuichetiere.matricule][todayDateStr] = [];
    }
    allPointagesStorage[identifiedGuichetiere.matricule][todayDateStr].push(newPointage);
    localStorage.setItem('pmuPointages', JSON.stringify(allPointagesStorage));
    
    toast({ title: 'Pointage validé !', description: `Merci ${identifiedGuichetiere.prenom}, votre pointage à ${agencePourPointage} a été enregistré.`, className: "bg-green-600 text-white" });
    resetProcess();
  };

  return {
    step,
    isLoading,
    matricule,
    setMatricule,
    identifiedGuichetiere,
    maxPointages,
    guichetieresPlanifieesAujourdhui,
    pointagesJournaliersAgence,
    nomAgenceAffichee,
    todayFormatted,
    resetProcess,
    handleMatriculeSubmit,
    handleFacialRecognition,
    handleSignature,
    validerPointage,
    setStep,
    chefAgenceInfo,
    isChefAgenceLoggedIn
  };
};
