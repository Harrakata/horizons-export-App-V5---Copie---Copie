import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserCog, CalendarDays, ShieldCheck, LogOut, Loader2, Camera, RotateCcw, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

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
    if (!matricule.trim()) {
      toast({ 
        title: "Matricule requis", 
        description: "Veuillez entrer votre matricule pour continuer.", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);

    try {
      // Vérifier si le matricule existe
    const { data: chef, error } = await supabase
      .from('chefs_agence')
      .select('*')
      .eq('matricule', matricule)
      .single();

      if (error && error.code !== 'PGRST116') {
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      if (!chef) {
        toast({ title: "Matricule inconnu", description: "Ce matricule n'est associé à aucun chef d'agence.", variant: "destructive" });
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
      // Dans une vraie implémentation, nous comparerions l'image capturée avec celle du chef d'agence trouvé
      // Comme c'est une simulation, nous allons simplement simuler une authentification réussie après un délai
      
      // Simulation d'une API de reconnaissance faciale
      setTimeout(() => {
        // Appel à onLogin qui va gérer l'enregistrement de la connexion
        onLogin(true, chefTrouve);
        
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

    // Vérifier si le mot de passe correspond au chef trouvé
    if (password === chefTrouve.mdp) {
      // Appel à onLogin qui va gérer l'enregistrement de la connexion
      onLogin(true, chefTrouve);
      
      toast({ 
        title: "Connexion réussie", 
        description: `Bienvenue ${chefTrouve.prenom} ${chefTrouve.nom} dans votre Espace Chef d'Agence.`, 
        className: "bg-green-500 text-white" 
      });
    } else {
      toast({ 
        title: "Échec de la connexion", 
        description: "Mot de passe incorrect.", 
        variant: "destructive" 
      });
    }
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
              <Label htmlFor="matricule-chef">Matricule</Label>
              <Input 
                id="matricule-chef" 
                type="text" 
                placeholder="Votre matricule" 
                value={matricule} 
                onChange={(e) => setMatricule(e.target.value)} 
                required 
                disabled={isLoading}
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
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(30);
  
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
        const { data, error } = await supabase
          .from('chefs_agence')
          .select('*')
          .eq('id', chefAgenceInfo.id)
          .single();
          
        if (!error && data) {
          setChefDetails(data);
        }
      }
    };
    
    loadChefDetails();
  }, [isAuthenticated, chefAgenceInfo]);

  const handleLogin = (status, chefData) => {
    setIsAuthenticated(status);
    if (status && chefData) {
      const authData = { 
        isAuthenticated: true, 
        chefInfo: { 
          nomAgence: chefData.agenceEnCharge, 
          nomChef: `${chefData.prenom} ${chefData.nom}`, 
          matricule: chefData.matricule, 
          id: chefData.id,
          photo_url: chefData.photo_url
        } 
      };
      setChefAgenceInfo(authData.chefInfo);
      setChefDetails(chefData);
      localStorage.setItem('pmuChefAuth', JSON.stringify(authData));

      // Enregistrer la connexion du chef d'agence dans la base de données
      enregistrerConnexionChef(chefData.id);
    } else {
      localStorage.removeItem('pmuChefAuth');
      setChefAgenceInfo(null);
      setChefDetails(null);
    }
  };

  const handleLogout = () => {
    if (isAuthenticated && chefAgenceInfo?.id) {
      // Enregistrer la déconnexion du chef d'agence
      enregistrerDeconnexionChef(chefAgenceInfo.id);
    }
    
    setIsAuthenticated(false);
    setChefAgenceInfo(null);
    setChefDetails(null);
    localStorage.removeItem('pmuChefAuth');
    toast({ title: "Déconnexion", description: "Vous avez été déconnecté.", className: "bg-blue-500 text-white" });
    navigate('/'); 
  };

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
  ];

  if (!isAuthenticated) {
    return <LoginPageChef onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="md:w-72"
      >
        <Card className="shadow-lg sticky top-20 glassmorphism">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20">
                {chefAgenceInfo?.photo_url ? (
                  <AvatarImage src={chefAgenceInfo.photo_url} alt={chefAgenceInfo.nomChef} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {chefAgenceInfo?.nomChef?.split(' ').map(n => n[0]).join('') || 'CA'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl text-primary">Chef d'Agence</CardTitle>
            {chefAgenceInfo && (
                  <CardDescription className="text-sm">
                    {chefAgenceInfo.nomChef} <br />
                Agence: {chefAgenceInfo.nomAgence}
              </CardDescription>
            )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col h-full">
            <nav className="flex flex-col space-y-2 flex-grow">
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  asChild
                  variant={location.pathname.endsWith(item.path) ? 'default' : 'ghost'}
                  className={`justify-start text-base py-3 ${location.pathname.endsWith(item.path) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-muted/50'}`}
                >
                  <Link to={item.path}>
                    {item.icon && React.cloneElement(item.icon, { className: 'mr-3 h-5 w-5' })}
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
            <div className="mt-auto pt-4">
              {sessionExpiring && (
                <div className="mb-4 p-2 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-md flex items-center">
                  <Timer className="h-4 w-4 mr-2 text-yellow-600 dark:text-yellow-400" />
                  <div className="text-xs font-medium">
                    <div>Session expirante</div>
                    <div>{formatTimeRemaining()}</div>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full justify-start text-base py-3 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5 text-red-500" />
                Se déconnecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.aside>
      <main className="flex-1">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet context={{ nomAgence: chefAgenceInfo?.nomAgence, chefInfo: chefAgenceInfo, chefDetails }} />
        </motion.div>
      </main>
    </div>
  );
};

export default EspaceChefAgencePage;
