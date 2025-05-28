import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, CalendarCheck2, UserCheck, AlertTriangle, Clock, ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

import MatriculeStep from '@/pages/pointage/MatriculeStep';
import FacialRecognitionStep from '@/pages/pointage/FacialRecognitionStep';
import SignatureStep from '@/pages/pointage/SignatureStep';
import ConfirmationStep from '@/pages/pointage/ConfirmationStep';
import PointageStatus from '@/pages/pointage/PointageStatus';
import PointageTimeline from '@/pages/pointage/PointageTimeline';
import PointageGuichetieresSummary from '@/pages/pointage/PointageGuichetieresSummary';
import { usePointageLogic } from '@/pages/pointage/usePointageLogic';

const PointagePage = () => {
  const {
    step,
    isLoading,
    matricule,
    setMatricule,
    identifiedGuichetiere,
    signature,
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
    chefAgenceInfo,
    isChefAgenceLoggedIn,
    currentPointageStatus,
    currentCreneauIndex,
    isSessionExpired,
    sessionExpirationMessage,
    logoutChefAgence,
    resetSessionTimeout,
  } = usePointageLogic();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const isMobile = windowWidth < 640;

  // Suivre les changements de taille d'écran
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Add event listeners for user activity to reset session timeout
  useEffect(() => {
    if (isChefAgenceLoggedIn) {
      const handleUserActivity = () => {
        if (resetSessionTimeout) {
          resetSessionTimeout();
        }
      };
      
      // Add event listeners for common user interactions
      window.addEventListener('mousemove', handleUserActivity);
      window.addEventListener('mousedown', handleUserActivity);
      window.addEventListener('keypress', handleUserActivity);
      window.addEventListener('touchstart', handleUserActivity);
      window.addEventListener('scroll', handleUserActivity);
      
      return () => {
        // Clean up event listeners
        window.removeEventListener('mousemove', handleUserActivity);
        window.removeEventListener('mousedown', handleUserActivity);
        window.removeEventListener('keypress', handleUserActivity);
        window.removeEventListener('touchstart', handleUserActivity);
        window.removeEventListener('scroll', handleUserActivity);
      };
    }
  }, [isChefAgenceLoggedIn, resetSessionTimeout]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return <MatriculeStep matricule={matricule} setMatricule={setMatricule} onSubmit={handleMatriculeSubmit} isLoading={isLoading} />;
      case 2:
        return <FacialRecognitionStep guichetiereInfo={identifiedGuichetiere} onSubmit={handleFacialRecognitionSuccess} onReset={resetProcess} isLoading={isLoading} />;
      case 3:
        return <SignatureStep onSubmit={handleSignature} onReset={resetProcess} isLoading={isLoading} />;
      case 4:
        return <ConfirmationStep onSubmit={validerPointage} onReset={resetProcess} isLoading={isLoading} currentPointageStatus={currentPointageStatus} signature={signature} />;
      default:
        return null;
    }
  };

  if (!isChefAgenceLoggedIn && nomAgenceAffichee === "Agence Centrale") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-3 md:p-8 text-center"
      >
        <Card className="w-full max-w-lg shadow-xl glassmorphism p-4 md:p-8">
          <AlertTriangle className="h-10 w-10 md:h-16 md:w-16 text-primary mx-auto mb-3 md:mb-6" />
          <CardTitle className="text-xl md:text-3xl font-bold text-primary mb-2 md:mb-4">Accès Chef d'Agence Requis</CardTitle>
          <p className="text-sm md:text-lg text-muted-foreground mb-4 md:mb-8">
            Pour accéder à la fonctionnalité de pointage pour une agence spécifique, veuillez d'abord vous connecter à votre Espace Chef d'Agence.
          </p>
          <Button asChild size={isMobile ? "default" : "lg"} className="bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-white text-xs md:text-base w-full md:w-auto">
            <Link to="/espace-chef-agence">
              <UserCheck className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Se Connecter (Chef d'Agence)
            </Link>
          </Button>
           <p className="text-xs md:text-sm text-muted-foreground mt-4 md:mt-6">
            Si vous êtes une guichetière et que l'agence centrale est affichée, cela signifie qu'aucun chef d'agence n'est connecté.
          </p>
        </Card>
      </motion.div>
    );
  }


  return (
    <div className="container mx-auto px-2 py-4 sm:p-4 md:p-8">
      {isSessionExpired && isChefAgenceLoggedIn && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 sm:p-4 border-2 border-red-500 bg-red-50 dark:bg-red-900/30 rounded-lg shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">Session en cours d'expiration</h3>
                <p className="text-xs sm:text-sm text-red-600 dark:text-red-300">{sessionExpirationMessage}</p>
              </div>
            </div>
            <Button
              variant="destructive"
              size={isMobile ? "sm" : "default"}
              onClick={logoutChefAgence}
              className="whitespace-nowrap"
            >
              <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm">Se déconnecter</span>
            </Button>
          </div>
        </motion.div>
      )}
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-3 md:mb-6"
      >
        <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-primary mb-1 md:mb-2 flex items-center justify-center">
          <CalendarCheck2 className="mr-2 md:mr-3 h-6 w-6 sm:h-7 sm:w-7 md:h-10 md:w-10" /> 
          Pointage<span className="hidden xs:inline"> de Présence</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          Agence: <span className="font-semibold text-primary">{nomAgenceAffichee}</span>
        </p>
        <p className="text-xs sm:text-sm md:text-lg text-muted-foreground">
           Date: <span className="font-medium text-primary">{todayFormatted}</span> | Heure: <span className="font-medium text-primary">{format(currentTime, 'HH:mm:ss')}</span>
        </p>
        {chefAgenceInfo && (
          <div className="flex items-center justify-center mt-2">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-primary/20 mr-2">
              {chefAgenceInfo.photo_url ? (
                <AvatarImage src={chefAgenceInfo.photo_url} alt={chefAgenceInfo.nomChef} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                {chefAgenceInfo.nomChef?.split(' ').map(n => n[0]).join('') || 'CA'}
              </AvatarFallback>
            </Avatar>
            <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">
              <span className="hidden xs:inline">Connecté en tant que:</span> {chefAgenceInfo.nomChef}
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-3 md:mb-6"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg sm:text-xl font-semibold text-primary flex items-center">
            <Clock className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> 
            <span className="hidden xs:inline">Chronologie des</span> Pointages
          </h2>
          <Button 
            variant="ghost" 
            size={isMobile ? "xs" : "sm"}
            onClick={() => {
              setExpandedTimeline(!expandedTimeline);
              if (resetSessionTimeout) resetSessionTimeout();
            }}
            className="text-muted-foreground flex items-center text-xs"
          >
            {expandedTimeline ? (
              <>
                {!isMobile && "Réduire"} <ChevronUp className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
              </>
            ) : (
              <>
                {!isMobile && "Développer"} <ChevronDown className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
              </>
            )}
          </Button>
        </div>

        <PointageTimeline 
            currentTime={currentTime} 
            creneaux={creneauxPointageSettings} 
            guichetieresPlanifiees={guichetieresPlanifieesAujourdhui}
            pointagesData={pointagesJournaliersAgence}
            currentCreneauIndex={currentCreneauIndex}
        />

        {expandedTimeline && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 sm:mt-4"
          >
            <PointageGuichetieresSummary 
              guichetieresPlanifiees={guichetieresPlanifieesAujourdhui}
              pointagesData={pointagesJournaliersAgence}
              creneauxPointageSettings={creneauxPointageSettings}
              currentCreneauIndex={currentCreneauIndex}
            />
          </motion.div>
        )}
      </motion.div>

      <div className="grid md:grid-cols-3 gap-3 md:gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="md:col-span-2"
        >
          <Card className="shadow-xl glassmorphism">
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg sm:text-xl md:text-2xl text-primary">Processus de Pointage</CardTitle>
                    <div className="flex space-x-1">
                        {[1,2,3,4].map(s => (
                            <div key={s} className={`w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full ${step >= s ? 'bg-primary' : 'bg-muted'}`}></div>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 min-h-[250px] sm:min-h-[350px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="shadow-xl glassmorphism">
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg md:text-xl text-primary flex items-center">
                <Info className="mr-2 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" /> Statut Quotidien
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <PointageStatus 
                guichetieresPlanifiees={guichetieresPlanifieesAujourdhui}
                pointagesData={pointagesJournaliersAgence}
                creneauxPointageSettings={creneauxPointageSettings}
                identifiedGuichetiereMatricule={identifiedGuichetiere?.matricule}
                nomAgence={nomAgenceAffichee}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default PointagePage;
