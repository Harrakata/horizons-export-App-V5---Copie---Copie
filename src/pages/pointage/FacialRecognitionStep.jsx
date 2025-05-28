import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle, CardDescription } from '@/components/ui/card';
import { Fingerprint, Camera, CheckCircle, XCircle, RefreshCw, User, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar.jsx';

const FacialRecognitionStep = ({ guichetiereInfo, onSubmit, onReset, isLoading: propIsLoading }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null); // null, 'match', 'no_match', 'pending'
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const { toast } = useToast();

  const guichetierePhotoUrl = guichetiereInfo?.photo_url || null;

  useEffect(() => {
    let stream;
    if (isCameraActive && videoRef.current) {
      setCapturedImage(null);
      setComparisonResult(null);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          stream = s;
          videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.error("Erreur accès caméra: ", err);
          toast({ title: "Erreur Caméra", description: "Impossible d'accéder à la caméra.", variant: "destructive" });
          setIsCameraActive(false);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive, toast]);

  const startRecognitionProcess = () => {
    if (!guichetierePhotoUrl) {
        toast({ title: "Action impossible", description: "La photo de profil de la guichetière est manquante. La reconnaissance faciale ne peut pas être effectuée.", variant: "destructive", duration: 5000 });
        return;
    }
    setIsCameraActive(true);
    setCapturedImage(null);
    setComparisonResult(null);
  };

  const takePhotoAndCompare = () => {
    if (videoRef.current && canvasRef.current) {
      setLocalIsLoading(true);
      setComparisonResult('pending');
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataUrl);
      setIsCameraActive(false); 
      
      setTimeout(() => {
        const simulatedMatch = Math.random() > 0.3; 
        setComparisonResult(simulatedMatch ? 'match' : 'no_match');
        setLocalIsLoading(false);
        if (simulatedMatch) {
            toast({ title: "Correspondance !", description: "La reconnaissance faciale a réussi.", className: "bg-green-500 text-white"});
        } else {
            toast({ title: "Échec de la reconnaissance", description: "Les visages ne semblent pas correspondre. Veuillez réessayer ou annuler.", variant: "destructive", duration: 5000});
        }
      }, 2000); // Simule le temps de traitement
    }
  };
  
  const handleProceed = () => {
    if (comparisonResult === 'match') {
      onSubmit(); 
    } else {
        toast({ title: "Action impossible", description: "La reconnaissance faciale doit réussir pour continuer.", variant: "destructive"});
    }
  };

  const resetFacialStep = () => {
    setIsCameraActive(false);
    setCapturedImage(null);
    setComparisonResult(null);
    setLocalIsLoading(false);
  }

  const isLoading = propIsLoading || localIsLoading;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -50 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 50 }} 
      className="space-y-4 md:space-y-6 text-center"
    >
      <CardTitle className="text-xl md:text-2xl font-semibold text-primary">Étape 2: Reconnaissance Faciale</CardTitle>
      <CardDescription className="text-sm md:text-base">
        {isCameraActive ? "Placez votre visage devant la caméra." : "Vérification de l'identité par reconnaissance faciale."}
      </CardDescription>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center my-4">
        <div className="flex flex-col items-center p-2 border rounded-lg bg-muted/30 min-h-[180px] md:min-h-[220px] justify-center">
          <CardDescription className="mb-2 text-xs md:text-sm font-medium">Photo de Profil</CardDescription>
          {guichetierePhotoUrl ? (
            <Avatar className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-primary shadow-md">
              <AvatarImage src={guichetierePhotoUrl} alt={`Profil de ${guichetiereInfo?.prenom}`} className="object-cover" />
              <AvatarFallback className="bg-gray-200 text-gray-400">
                <User className="w-12 h-12" />
              </AvatarFallback>
            </Avatar>
          ) : (
             <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200 flex items-center justify-center border-2 border-muted">
                <User className="w-12 h-12 text-gray-400" />
             </div>
          )}
          <p className="mt-2 text-sm font-medium">{guichetiereInfo?.prenom} {guichetiereInfo?.nom}</p>
        </div>

        <div className="flex flex-col items-center p-2 border rounded-lg bg-muted/30 min-h-[180px] md:min-h-[220px] justify-center">
          <CardDescription className="mb-2 text-xs md:text-sm font-medium">Capture Caméra</CardDescription>
          {isCameraActive && (
            <video ref={videoRef} autoPlay className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-input shadow-md bg-black"></video>
          )}
          {capturedImage && !isCameraActive && (
            <img src={capturedImage} alt="Capture faciale" className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-blue-500 shadow-md" />
          )}
          {!isCameraActive && !capturedImage && (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-gray-200 flex items-center justify-center border-2 border-muted">
              <Camera className="w-12 h-12 text-gray-400" />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
      </div>

      {comparisonResult && comparisonResult !== 'pending' && (
        <motion.div 
            initial={{opacity: 0, y:10}} animate={{opacity:1, y:0}}
            className={`p-2 rounded-md text-sm md:text-base font-semibold flex items-center justify-center
            ${comparisonResult === 'match' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'}`}
        >
            {comparisonResult === 'match' ? <CheckCircle className="mr-2 h-5 w-5"/> : <XCircle className="mr-2 h-5 w-5"/>}
            {comparisonResult === 'match' ? 'Correspondance trouvée !' : 'Aucune correspondance trouvée.'}
        </motion.div>
      )}
       {comparisonResult === 'pending' && (
        <motion.div 
            initial={{opacity: 0, y:10}} animate={{opacity:1, y:0}}
            className="p-2 rounded-md text-sm md:text-base font-semibold flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100"
        >
            <Fingerprint className="mr-2 h-5 w-5 animate-pulse"/>
            Analyse en cours...
        </motion.div>
      )}


      {!isCameraActive && !capturedImage && (
        <Button 
          onClick={startRecognitionProcess} 
          className="w-full text-base md:text-lg py-3 md:py-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
          disabled={isLoading || !guichetierePhotoUrl}
        >
          {isLoading ? 'Chargement...' : 'Lancer la Reconnaissance'} <Camera className="ml-2 h-4 w-4 md:h-5 md:w-5" />
        </Button>
      )}
      {isCameraActive && (
        <Button 
          onClick={takePhotoAndCompare} 
          className="w-full text-base md:text-lg py-3 md:py-6 bg-green-500 hover:bg-green-600 text-white"
          disabled={isLoading}
        >
          {isLoading ? 'Capture...' : 'Prendre la Photo & Comparer'} <Fingerprint className="ml-2 h-4 w-4 md:h-5 md:w-5" />
        </Button>
      )}

      {comparisonResult === 'match' && (
         <Button 
          onClick={handleProceed} 
          className="w-full text-base md:text-lg py-3 md:py-6 bg-primary hover:bg-primary/90 text-white"
          disabled={isLoading}
        >
          {isLoading ? 'Chargement...' : 'Passer à la Signature'}
        </Button>
      )}
      
      {comparisonResult === 'no_match' && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
             <Button 
                onClick={startRecognitionProcess} 
                variant="outline"
                className="w-full"
                disabled={isLoading}
            >
                <RotateCcw className="mr-2 h-4 w-4" /> Recommencer Reconnaissance
            </Button>
            <Button variant="destructive" onClick={onReset} className="w-full" disabled={isLoading}>
                <XCircle className="mr-2 h-4 w-4" /> Annuler Pointage
            </Button>
        </div>
      )}
      
      {(comparisonResult === 'match' || (!isCameraActive && !capturedImage && !comparisonResult)) && (
        <Button variant="outline" onClick={onReset} className="w-full mt-2 text-xs md:text-sm" disabled={isLoading}>
            <RefreshCw className="mr-2 h-3 w-3 md:h-4 md:w-4" /> Annuler et Recommencer le Pointage
        </Button>
      )}
       {!guichetierePhotoUrl && (
        <p className="text-xs text-red-500 mt-2">La photo de profil de la guichetière est manquante. La reconnaissance faciale ne peut pas être effectuée.</p>
      )}
    </motion.div>
  );
};

export default FacialRecognitionStep;
