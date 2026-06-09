import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserCog, CalendarDays, ShieldCheck, LogOut, Loader2, Camera, RotateCcw, Timer, Wallet, Wrench, MapPin, ClipboardCheck, Menu, X } from 'lucide-react';
import EditProfileDialog from '@/components/EditProfileDialog';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { publicSupabase, supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  APP_SPACE_SETTINGS_KEY,
  APP_SPACE_TAB_SETTINGS_KEY,
  APP_SPACE_USER_PROFILES_SETTINGS_KEY,
  buildDefaultAppSpaceFunctionalities,
  buildDefaultAppSpaceTabFunctionalities,
  buildDefaultAppSpaceUserProfiles,
  canAccessAppSpaceUserTab,
  getFirstEnabledAppSpaceTab,
  getEffectiveAppSpaceUserProfile,
  isAppSpaceTabEnabled,
  normalizeAppSpaceFunctionalities,
  normalizeAppSpaceTabFunctionalities,
  normalizeAppSpaceUserProfiles,
} from '@/lib/exploitationProfiles';
import { fetchAuthLinkedProfile } from '@/lib/smartAuth';

const loadSpaceUserProfilesSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', APP_SPACE_USER_PROFILES_SETTINGS_KEY)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return normalizeAppSpaceUserProfiles(data?.value);
};

const resolveCurrentAgenceName = async ({ agenceName, codePDV } = {}) => {
  const cleanCode = String(codePDV || '').trim();
  const cleanName = String(agenceName || '').trim();

  if (cleanCode) {
    const { data } = await publicSupabase
      .from('agences')
      .select('nom, codePDV')
      .eq('codePDV', cleanCode)
      .eq('is_current', true)
      .maybeSingle();
    if (data?.nom) return data.nom;
  }

  if (!cleanName) return cleanName;

  const { data: currentByName } = await publicSupabase
    .from('agences')
    .select('nom, codePDV')
    .eq('nom', cleanName)
    .eq('is_current', true)
    .maybeSingle();
  if (currentByName?.nom) return currentByName.nom;

  const { data: historicalRows } = await publicSupabase
    .from('agences')
    .select('nom, codePDV')
    .eq('nom', cleanName)
    .limit(1);
  const historicalCode = historicalRows?.[0]?.codePDV;
  if (!historicalCode) return cleanName;

  const { data: currentByCode } = await publicSupabase
    .from('agences')
    .select('nom')
    .eq('codePDV', historicalCode)
    .eq('is_current', true)
    .maybeSingle();

  return currentByCode?.nom || cleanName;
};

const LoginPageChef = ({ onLogin }) => {
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authStep, setAuthStep] = useState('matricule');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facialAuthInProgress, setFacialAuthInProgress] = useState(false);
  const [chefTrouve, setChefTrouve] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { toast } = useToast();

  const ensureChefProfileActive = async (chef) => {
    const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
    const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, 'espace-chef-agence', chef.id);
    if (effectiveProfile.statut !== 'Actif') {
      toast({
        title: 'Compte désactivé',
        description: "Votre profil Chef d'agence est désactivé. Contactez un administrateur.",
        variant: 'destructive',
      });
      return null;
    }
    return effectiveProfile;
  };

  // Activer/désactiver la caméra lorsque nécessaire
  useEffect(() => {
    let stream = null;
    
    if (isCameraActive && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(mediaStream => {
          stream = mediaStream;
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        })
        .catch(err => {
          console.error("Erreur d'accès à la caméra: ", err);
          toast({ 
            title: "Erreur d'accès à la caméra", 
            description: "Veuillez autoriser l'accès à votre caméra ou utiliser la connexion par identifiants.", 
            variant: "destructive" 
          });
          setIsCameraActive(false);
          setLoginTab('credentials');
        });
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive, toast]);

  // Activer la caméra quand on passe à l'étape de reconnaissance faciale
  useEffect(() => {
    if (authStep === 'facial') {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
      setCapturedImage(null);
    }
  }, [authStep]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/png');
    setCapturedImage(imageData);
  };

  const resetCamera = () => {
    setCapturedImage(null);
  };

  const verifierMatricule = async (e) => {
    e.preventDefault();
    const id = matricule.trim();
    if (!id) {
      toast({
        title: "Identifiant requis",
        description: "Veuillez entrer votre matricule ou votre email pour continuer.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // L'utilisateur peut saisir un email OU un matricule
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
      const findChef = async () => {
        let query = publicSupabase.from('chefs_agence').select('*').eq('is_current', true);
        query = isEmail
          ? query.ilike('email', id)
          : query.ilike('matricule', id);
        return query.maybeSingle();
      };

      const { data: chef, error } = await findChef();

      if (error && error.code !== 'PGRST116') {
        toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!chef) {
        toast({
          title: isEmail ? "Email inconnu" : "Matricule inconnu",
          description: "Cet identifiant n'est associé à aucun chef d'agence actif.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Stocker les informations du chef trouvé
      setChefTrouve(chef);
      
      // Vérifier si le chef a une photo pour la reconnaissance faciale
      if (chef.photo_url) {
        setAuthStep('choixMethAuth');
      } else {
        // Pas de photo, passer directement à l'authentification par mot de passe
        setAuthStep('password');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la vérification du matricule:", error);
      toast({ title: "Erreur de connexion", description: "Une erreur est survenue lors de la vérification du matricule.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const authenticateWithFacialRecognition = async () => {
    if (!capturedImage) {
      toast({ 
        title: "Pas d'image capturée", 
        description: "Veuillez prendre une photo pour vous authentifier.", 
        variant: "destructive" 
      });
      return;
    }
    
    setFacialAuthInProgress(true);
    
    try {
      const effectiveProfile = await ensureChefProfileActive(chefTrouve);
      if (!effectiveProfile) {
        setFacialAuthInProgress(false);
        return;
      }

      // Dans une vraie implémentation, nous comparerions l'image capturée avec celle du chef d'agence trouvé
      // Comme c'est une simulation, nous allons simplement simuler une authentification réussie après un délai
      
      // Simulation d'une API de reconnaissance faciale
      setTimeout(() => {
        // Appel à onLogin qui va gérer l'enregistrement de la connexion
        onLogin(true, { ...chefTrouve, appSpaceProfile: effectiveProfile });
        
        toast({ 
          title: "Reconnaissance faciale réussie", 
          description: `Bienvenue ${chefTrouve.prenom} ${chefTrouve.nom} dans votre Espace Chef d'Agence.`, 
          className: "bg-green-500 text-white" 
        });
        
        setFacialAuthInProgress(false);
        setIsCameraActive(false);
        setCapturedImage(null);
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de l'authentification faciale:", error);
      toast({ 
        title: "Échec de l'authentification faciale", 
        description: "Une erreur est survenue. Veuillez réessayer ou utiliser le mot de passe.", 
        variant: "destructive" 
      });
      setFacialAuthInProgress(false);
    }
  };

  const authentifierParMotDePasse = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // ── Auth Supabase obligatoire : le mot de passe est vérifié contre auth.users (bcrypt) ──
    if (!chefTrouve?.email) {
      toast({
        title: "Email manquant",
        description: "Ce chef d'agence n'a pas d'email enregistré. Contactez un administrateur.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: String(chefTrouve.email).trim().toLowerCase(),
      password,
    });

    if (authErr || !authData?.user) {
      toast({
        title: "Échec de la connexion",
        description: authErr?.message?.includes('Invalid login credentials')
          ? "Mot de passe incorrect."
          : (authErr?.message ?? "Mot de passe incorrect."),
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // ── Vérifier que le compte auth est bien lié à CE chef d'agence ──
    if (chefTrouve.auth_user_id && chefTrouve.auth_user_id !== authData.user.id) {
      await supabase.auth.signOut();
      toast({
        title: "Compte non autorisé",
        description: "Ce mot de passe ne correspond pas au compte de ce matricule.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const effectiveProfile = await ensureChefProfileActive(chefTrouve);
    if (!effectiveProfile) {
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    onLogin(true, { ...chefTrouve, appSpaceProfile: effectiveProfile });
    toast({
      title: "Connexion réussie",
      description: `Bienvenue ${chefTrouve.prenom} ${chefTrouve.nom} dans votre Espace Chef d'Agence.`,
      className: "bg-green-500 text-white",
    });
    setIsLoading(false);
  };
  
  const retourMatricule = () => {
    setAuthStep('matricule');
    setChefTrouve(null);
    setPassword('');
  };
  
  const passerAuthentificationMDP = () => {
    setAuthStep('password');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-center min-h-[calc(100vh-200px)]"
    >
      <Card className="w-full max-w-md shadow-2xl glassmorphism">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary">
            <ShieldCheck className="inline-block h-8 w-8 mr-2 text-primary" />
            Accès Espace Chef d'Agence
          </CardTitle>
          <CardDescription className="text-center">
            {authStep === 'matricule' 
              ? "Entrez votre matricule pour commencer" 
              : authStep === 'choixMethAuth' 
                ? "Choisissez votre méthode d'authentification"
                : authStep === 'password'
                  ? "Entrez votre mot de passe"
                  : "Reconnaissance faciale en cours"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ÉTAPE 1: SAISIE DU MATRICULE */}
          {authStep === 'matricule' && (
            <form onSubmit={verifierMatricule} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="matricule-chef">Identifiant</Label>
              <Input
                id="matricule-chef"
                type="text"
                placeholder="Matricule ou email"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
              <Button 
                type="submit" 
                className="w-full text-lg py-3 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-white" 
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Vérification...' : 'Continuer'}
              </Button>
            </form>
          )}

          {/* ÉTAPE 2: CHOIX MÉTHODE D'AUTHENTIFICATION */}
          {authStep === 'choixMethAuth' && chefTrouve && (
            <div className="space-y-6">
              <div className="flex items-center justify-center mb-4">
                <Avatar className="h-20 w-20 border-2 border-primary">
                  {chefTrouve.photo_url ? (
                    <AvatarImage src={chefTrouve.photo_url} alt={`${chefTrouve.prenom} ${chefTrouve.nom}`} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                    {chefTrouve.prenom[0]}{chefTrouve.nom[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="text-center text-lg font-medium mb-4">
                Bonjour, {chefTrouve.prenom} {chefTrouve.nom}
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  onClick={() => setAuthStep('facial')} 
                  className="py-6 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-white"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Continuer avec la reconnaissance faciale
                </Button>
                <Button 
                  onClick={passerAuthentificationMDP} 
                  variant="outline" 
                  className="py-6"
                >
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  Continuer avec le mot de passe
                </Button>
                <Button 
                  onClick={retourMatricule} 
                  variant="ghost" 
                  className="mt-2"
                >
                  Retour
                </Button>
              </div>
            </div>
          )}
          
          {/* ÉTAPE 3A: AUTHENTIFICATION PAR MOT DE PASSE */}
          {authStep === 'password' && chefTrouve && (
            <form onSubmit={authentifierParMotDePasse} className="space-y-6">
              <div className="flex items-center justify-center mb-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  {chefTrouve.photo_url ? (
                    <AvatarImage src={chefTrouve.photo_url} alt={`${chefTrouve.prenom} ${chefTrouve.nom}`} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                    {chefTrouve.prenom[0]}{chefTrouve.nom[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
            <div className="space-y-2">
              <Label htmlFor="password-chef">Mot de passe</Label>
              <Input 
                id="password-chef" 
                type="password" 
                placeholder="Votre mot de passe" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                disabled={isLoading}
                  autoFocus
              />
            </div>
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  type="submit" 
                  className="py-6 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
                <Button 
                  type="button"
                  onClick={retourMatricule} 
                  variant="ghost" 
                  disabled={isLoading}
                >
                  Retour
                </Button>
              </div>
          </form>
          )}

          {/* ÉTAPE 3B: AUTHENTIFICATION PAR RECONNAISSANCE FACIALE */}
          {authStep === 'facial' && chefTrouve && (
            <div className="space-y-6">
              {/* Élément vidéo pour le flux de la caméra */}
              <div className="relative flex flex-col items-center">
                {!capturedImage ? (
                  // Afficher le flux vidéo quand pas d'image capturée
                  <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover" 
                      autoPlay 
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {!isCameraActive && (
                        <div className="text-center text-muted-foreground p-4 bg-background/80 rounded-lg">
                          <Camera className="mx-auto h-10 w-10 mb-2" />
                          <p>Chargement de la caméra...</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Afficher l'image capturée
                  <div className="w-full h-64 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                    <img 
                      src={capturedImage} 
                      alt="Capture" 
                      className="max-w-full max-h-full object-contain" 
                    />
                  </div>
                )}
                
                {/* Canvas caché pour la capture */}
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Boutons pour la caméra */}
                <div className="flex justify-center mt-4 space-x-4">
                  {!capturedImage ? (
                    <Button 
                      type="button"
                      onClick={capturePhoto}
                      className="px-6 py-2 bg-primary text-white"
                      disabled={!isCameraActive || facialAuthInProgress}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Prendre une photo
                    </Button>
                  ) : (
                    <>
                      <Button 
                        type="button"
                        onClick={resetCamera}
                        variant="outline"
                        disabled={facialAuthInProgress}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reprendre
                      </Button>
                      <Button 
                        type="button"
                        onClick={authenticateWithFacialRecognition}
                        className="bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-white"
                        disabled={facialAuthInProgress}
                      >
                        {facialAuthInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        {facialAuthInProgress ? "Authentification..." : "S'authentifier"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-center">
                <Button 
                  onClick={passerAuthentificationMDP} 
                  variant="ghost" 
                  disabled={facialAuthInProgress}
                  className="mt-2"
                >
                  Utiliser le mot de passe à la place
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                La reconnaissance faciale compare votre visage avec votre photo de profil.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EspaceChefAgencePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(
    JSON.parse(localStorage.getItem('pmuChefAuth'))?.isAuthenticated || false
  );
  const [chefAgenceInfo, setChefAgenceInfo] = useState(
     JSON.parse(localStorage.getItem('pmuChefAuth'))?.chefInfo || null
  );
  const [chefDetails, setChefDetails] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(30);
  const [spaceFunctionalities, setSpaceFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceFunctionalities(
        JSON.parse(localStorage.getItem(APP_SPACE_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceFunctionalities();
    }
  });
  const [spaceTabFunctionalities, setSpaceTabFunctionalities] = useState(() => {
    try {
      return normalizeAppSpaceTabFunctionalities(
        JSON.parse(localStorage.getItem(APP_SPACE_TAB_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceTabFunctionalities();
    }
  });
  const [spaceUserProfiles, setSpaceUserProfiles] = useState(() => {
    try {
      return normalizeAppSpaceUserProfiles(
        JSON.parse(localStorage.getItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY) || '{}')
      );
    } catch (error) {
      return buildDefaultAppSpaceUserProfiles();
    }
  });
  
  useActivityTracker({
    spaceKey: 'espace-chef-agence',
    isAuthenticated,
    identity: chefAgenceInfo,
  });

  // Charger les paramètres de session
  useEffect(() => {
    const loadSessionSettings = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'general')
        .single();

      if (!error && data && data.value) {
        setSessionDurationMinutes(data.value.sessionDureeMinutes || 30);
      }
    };

    loadSessionSettings();
  }, []);
  
  // Utiliser le hook de gestion de session
  const { sessionExpiring, formatTimeRemaining } = useSessionTimeout(
    sessionDurationMinutes,
    () => handleLogout(),
    'pmuChefAuth'
  );

  useEffect(() => {
    // Charger les détails complets du chef d'agence si authentifié
    const loadChefDetails = async () => {
      if (isAuthenticated && chefAgenceInfo?.id) {
        const { data, error } = await publicSupabase
          .from('chefs_agence')
          .select('*')
          .eq('id', chefAgenceInfo.id)
          .single();
          
        if (!error && data) {
          let resolvedAgence = data.agenceEnCharge || chefAgenceInfo?.nomAgence;
          try {
            resolvedAgence = await resolveCurrentAgenceName({
              agenceName: resolvedAgence,
              codePDV: data.codePDV,
            });
          } catch {}
          const enrichedData = { ...data, agenceEnCharge: resolvedAgence };
          const enrichedInfo = {
            nomAgence: resolvedAgence || 'Agence non renseignée',
            nomChef: `${data.prenom} ${data.nom}`,
            matricule: data.matricule,
            codePDV: data.codePDV,
            id: data.id,
            photo_url: data.photo_url,
          };
          setChefDetails(enrichedData);
          setChefAgenceInfo(enrichedInfo);
          localStorage.setItem('pmuChefAuth', JSON.stringify({
            isAuthenticated: true,
            chefInfo: enrichedInfo,
          }));
        }
      }
    };
    
    loadChefDetails();
  }, [isAuthenticated, chefAgenceInfo?.id]);

  useEffect(() => {
    const handleFunctionalitiesUpdated = (event) => {
      setSpaceFunctionalities(normalizeAppSpaceFunctionalities(event.detail));
    };

    window.addEventListener('app-functionalities-updated', handleFunctionalitiesUpdated);
    return () => window.removeEventListener('app-functionalities-updated', handleFunctionalitiesUpdated);
  }, []);

  useEffect(() => {
    const handleSpaceTabsUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceTabFunctionalities(event.detail);
      setSpaceTabFunctionalities(normalizedSettings);
      localStorage.setItem(APP_SPACE_TAB_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
    return () => window.removeEventListener('app-space-tabs-updated', handleSpaceTabsUpdated);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const normalizedSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
      setSpaceUserProfiles(normalizedSettings);
      localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const handleSpaceUserProfilesUpdated = (event) => {
      const normalizedSettings = normalizeAppSpaceUserProfiles(event.detail);
      setSpaceUserProfiles(normalizedSettings);
      localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    };

    window.addEventListener('app-space-user-profiles-updated', handleSpaceUserProfilesUpdated);
    return () => window.removeEventListener('app-space-user-profiles-updated', handleSpaceUserProfilesUpdated);
  }, []);

  useEffect(() => {
    const prefix = '/espace-chef-agence/';
    if (location.pathname.startsWith(prefix)) {
      const subPath = location.pathname.slice(prefix.length).replace(/\/$/, '');
      if (subPath) try { localStorage.setItem('ps:chef-agence:lastPath', subPath); } catch {}
    }
  }, [location.pathname]);

  const handleLogin = async (status, chefData) => {
    setIsAuthenticated(status);
    if (status && chefData) {
      let resolvedAgence = chefData.agenceEnCharge;
      try {
        resolvedAgence = await resolveCurrentAgenceName({
          agenceName: resolvedAgence,
          codePDV: chefData.codePDV,
        });
      } catch {}
      const enrichedChefData = { ...chefData, agenceEnCharge: resolvedAgence };
      const authData = { 
        isAuthenticated: true, 
        chefInfo: { 
          nomAgence: resolvedAgence || 'Agence non renseignée',
          nomChef: `${chefData.prenom} ${chefData.nom}`, 
          matricule: chefData.matricule, 
          codePDV: chefData.codePDV,
          id: chefData.id,
          photo_url: chefData.photo_url
        } 
      };
      setChefAgenceInfo(authData.chefInfo);
      setChefDetails(enrichedChefData);
      localStorage.setItem('pmuChefAuth', JSON.stringify(authData));

      // Enregistrer la connexion du chef d'agence dans la base de données
      enregistrerConnexionChef(chefData.id);
    } else {
      localStorage.removeItem('pmuChefAuth');
      setChefAgenceInfo(null);
      setChefDetails(null);
    }
  };

  const handleLogout = async () => {
    if (isAuthenticated && chefAgenceInfo?.id) {
      // Enregistrer la déconnexion du chef d'agence
      enregistrerDeconnexionChef(chefAgenceInfo.id);
    }

    // Déconnexion Supabase Auth (no-op si auth par face uniquement)
    try { await supabase.auth.signOut(); } catch {}

    setIsAuthenticated(false);
    setChefAgenceInfo(null);
    setChefDetails(null);
    localStorage.removeItem('pmuChefAuth');
    toast({ title: "Déconnexion", description: "Vous avez été déconnecté.", className: "bg-blue-500 text-white" });
    navigate('/');
  };

  // Restauration automatique : si une session Supabase Auth existe (login par mot de passe),
  // on re-fetch le chef d'agence lié sans demander de re-login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAuthenticated) return; // déjà connecté via localStorage (face) ou flux normal
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const { data: chef } = await fetchAuthLinkedProfile({
        table: 'chefs_agence',
        authUserId: session.user.id,
        statusCol: 'is_current',
        activeValue: true,
      });
      if (cancelled) return;
      if (chef) {
        const profileSettings = await loadSpaceUserProfilesSettings().catch(() => buildDefaultAppSpaceUserProfiles());
        const effectiveProfile = getEffectiveAppSpaceUserProfile(profileSettings, 'espace-chef-agence', chef.id);
        if (effectiveProfile.statut !== 'Actif') {
          await supabase.auth.signOut();
          return;
        }
        const authData = {
          isAuthenticated: true,
          chefInfo: {
            nomAgence: await resolveCurrentAgenceName({
              agenceName: chef.agenceEnCharge,
              codePDV: chef.codePDV,
            }).catch(() => chef.agenceEnCharge),
            nomChef: `${chef.prenom} ${chef.nom}`,
            matricule: chef.matricule,
            codePDV: chef.codePDV,
            id: chef.id,
            photo_url: chef.photo_url,
          },
        };
        setSpaceUserProfiles(profileSettings);
        localStorage.setItem(APP_SPACE_USER_PROFILES_SETTINGS_KEY, JSON.stringify(profileSettings));
        setIsAuthenticated(true);
        setChefAgenceInfo(authData.chefInfo);
        setChefDetails({ ...chef, agenceEnCharge: authData.chefInfo.nomAgence, appSpaceProfile: effectiveProfile });
        localStorage.setItem('pmuChefAuth', JSON.stringify(authData));
      } else {
        // Session orpheline (aucun chef lié) → on déconnecte
        await supabase.auth.signOut();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ajouter ces nouvelles fonctions pour gérer les connexions/déconnexions
  const enregistrerConnexionChef = async (chefId) => {
    try {
      const dateConnexion = new Date().toISOString();
      const { error } = await supabase.from('connexions_chefs').insert({
        chef_agence_id: chefId,
        date_connexion: dateConnexion
      });
      
      if (error) {
        console.error("Erreur lors de l'enregistrement de la connexion:", error);
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la connexion:", error);
    }
  };
  
  const enregistrerDeconnexionChef = async (chefId) => {
    try {
      const dateDeconnexion = new Date().toISOString();
      
      // Récupérer la dernière connexion sans déconnexion pour ce chef
      const { data, error: fetchError } = await supabase
        .from('connexions_chefs')
        .select('*')
        .eq('chef_agence_id', chefId)
        .is('date_deconnexion', null)
        .order('date_connexion', { ascending: false })
        .limit(1);
        
      if (fetchError) {
        console.error("Erreur lors de la récupération de la connexion:", fetchError);
        return;
      }
      
      // Si on trouve une connexion sans déconnexion, la mettre à jour
      if (data && data.length > 0) {
        const { error: updateError } = await supabase
          .from('connexions_chefs')
          .update({ date_deconnexion: dateDeconnexion })
          .eq('id', data[0].id);
        
        if (updateError) {
          console.error("Erreur lors de l'enregistrement de la déconnexion:", updateError);
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la déconnexion:", error);
    }
  };

  const menuItems = [
    { path: 'mon-planning', label: 'Mon Planning', icon: <CalendarDays className="h-5 w-5" /> },
    { path: 'mes-guichetieres', label: 'Mes Guichetières', icon: <UserCog className="h-5 w-5" /> },
    { path: 'maintenance-terminaux', label: 'Maintenance Terminaux', icon: <Wrench className="h-5 w-5" /> },
    { path: 'suivi-pointage', label: 'Suivi Pointage', icon: <ClipboardCheck className="h-5 w-5" /> },
    { path: 'points-vente-mobi', label: 'Point de Vente Mobi', icon: <MapPin className="h-5 w-5" /> },
    {
      path: 'paiement-gros-gain',
      label: 'Paiement Gros Gain',
      icon: <Wallet className="h-5 w-5" />,
      featureKey: 'paiement-gros-gain',
    },
  ].filter(
    (item) =>
      (!item.featureKey || spaceFunctionalities[item.featureKey] !== false) &&
      isAppSpaceTabEnabled(spaceTabFunctionalities, 'espace-chef-agence', item.path) &&
      canAccessAppSpaceUserTab(spaceUserProfiles, 'espace-chef-agence', chefDetails?.id || chefAgenceInfo?.id, item.path)
  );

  const normalizedPathname = location.pathname.replace(/\/+$/, '');
  const isMenuItemActive = (itemPath) => normalizedPathname === `/espace-chef-agence/${itemPath}`;

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!normalizedPathname.startsWith('/espace-chef-agence')) return;
    if (!menuItems.length) return;

    const fallbackPath = menuItems[0]?.path || getFirstEnabledAppSpaceTab(spaceTabFunctionalities, 'espace-chef-agence')?.key || null;
    if (!fallbackPath) return;

    const validPaths = menuItems.map((item) => `/espace-chef-agence/${item.path}`);

    if (!validPaths.includes(normalizedPathname)) {
      let savedPath;
      try { savedPath = localStorage.getItem('ps:chef-agence:lastPath'); } catch {}
      const target = (savedPath && validPaths.includes(`/espace-chef-agence/${savedPath}`))
        ? savedPath
        : fallbackPath;
      navigate(`/espace-chef-agence/${target}`, { replace: true });
    }
  }, [isAuthenticated, menuItems, navigate, normalizedPathname, spaceTabFunctionalities]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <LoginPageChef onLogin={handleLogin} />;
  }

  return (
    <div className="app-space-layout flex flex-col gap-4 md:flex-row lg:gap-8">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className="app-space-menu-toggle md:hidden"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
      >
        {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>
      {isMobileMenuOpen && (
        <div className="app-space-backdrop md:hidden" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
      )}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`app-space-sidebar md:w-72 md:shrink-0 ${isMobileMenuOpen ? 'is-open' : ''}`}
      >
        <div className="app-space-sidebar-scroll sticky top-20 space-y-3 max-h-[calc(100vh-5.5rem)] overflow-y-auto pb-4 pr-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="relative p-4">
              <div className="flex items-center gap-3">
                {(chefDetails?.photo_url || chefAgenceInfo?.photo_url) ? (
                  <img
                    src={chefDetails?.photo_url || chefAgenceInfo?.photo_url}
                    alt="Photo de profil"
                    className="h-12 w-12 shrink-0 rounded-[1rem] object-cover ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary ring-1 ring-primary/20 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.35)]">
                    <span className="text-lg font-black">
                      {chefAgenceInfo?.nomChef?.split(' ').map(n => n[0]).join('') || 'CA'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">Chef d'Agence</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-foreground">{chefAgenceInfo?.nomChef}</p>
                  <p className="text-[0.68rem] text-muted-foreground">Agence : {chefAgenceInfo?.nomAgence}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-primary/20 bg-white/92 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="relative p-3">
              <nav className="space-y-0.5">
                {menuItems.map((item) => {
                  const isActive = isMenuItemActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
                      }`}
                    >
                      {item.icon && React.cloneElement(item.icon, { className: 'h-4 w-4 shrink-0' })}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={() => { setIsProfileDialogOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-all hover:bg-primary/10 hover:text-primary"
                >
                  <UserCog className="h-4 w-4 shrink-0" />
                  Modifier mon profil
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Se déconnecter
                </button>
              </div>
            </CardContent>
          </Card>
          <EditProfileDialog
            open={isProfileDialogOpen}
            onOpenChange={setIsProfileDialogOpen}
            table="chefs_agence"
            recordId={chefDetails?.id || chefAgenceInfo?.id}
            withPhoto
            photoPrefix="photos_chefs"
            currentPhotoUrl={chefDetails?.photo_url || null}
            initialData={{ nom: chefDetails?.nom, prenom: chefDetails?.prenom, telephone: chefDetails?.telephone, email: chefDetails?.email }}
            onSaved={(fields) => {
              setChefDetails((prev) => ({ ...(prev || {}), ...fields }));
              const nomChef = `${fields.prenom} ${fields.nom}`.trim();
              setChefAgenceInfo((prev) => (prev ? { ...prev, nomChef } : prev));
              try {
                const stored = JSON.parse(localStorage.getItem('pmuChefAuth') || 'null');
                if (stored?.chefInfo) {
                  stored.chefInfo.nomChef = nomChef;
                  localStorage.setItem('pmuChefAuth', JSON.stringify(stored));
                }
              } catch {}
            }}
          />

          {sessionExpiring && (
            <div className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
              <Timer className="h-4 w-4 shrink-0 text-yellow-600" />
              <div className="text-xs font-medium text-yellow-800">
                <div>Session expirante</div>
                <div>{formatTimeRemaining()}</div>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
      <main className="app-space-main flex-1 min-w-0 overflow-visible md:overflow-x-hidden">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {!menuItems.length ? (
            <Card className="shadow-xl glassmorphism">
              <CardContent className="p-6 text-center text-muted-foreground">
                Aucun onglet n’est actuellement autorisé pour votre profil Chef d'agence.
              </CardContent>
            </Card>
          ) : (
            <Outlet
              context={{
                nomAgence: chefAgenceInfo?.nomAgence,
                chefInfo: chefAgenceInfo,
                chefDetails: chefDetails || { codePDV: chefAgenceInfo?.codePDV },
              }}
            />
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceChefAgencePage;
