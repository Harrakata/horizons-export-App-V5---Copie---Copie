import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle, CardDescription } from '@/components/ui/card';
import { Edit3, Save, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const SignatureStep = ({ onSubmit, onReset, isLoading }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [ctx, setCtx] = useState(null);

  // Initialiser le contexte du canvas au montage du composant
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Définir la taille du canvas pour qu'elle corresponde à sa taille d'affichage
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      // Configurer le contexte
      const context = canvas.getContext('2d');
      context.lineWidth = 3;
      context.lineCap = 'round';
      context.strokeStyle = '#000';
      setCtx(context);
    }
  }, []);

  // Gestionnaires d'événements pour le dessin
  const startDrawing = (e) => {
    if (!ctx) return;
    
    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing || !ctx) return;
    
    const { offsetX, offsetY } = getCoordinates(e);
    
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!ctx) return;
    
    setIsDrawing(false);
    ctx.closePath();
  };

  // Fonction pour obtenir les coordonnées du pointeur (souris ou toucher)
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    
    let offsetX, offsetY;
    
    if (e.type.includes('touch')) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0] || e.changedTouches[0];
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      offsetX = e.nativeEvent.offsetX;
      offsetY = e.nativeEvent.offsetY;
    }
    
    return { offsetX, offsetY };
  };

  // Effacer la signature
  const clearSignature = () => {
    if (!ctx || !canvasRef.current) return;
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  // Valider la signature
  const validateSignature = () => {
    if (!hasSignature || !canvasRef.current) {
      return;
    }
    
    // Convertir le canvas en image (format base64)
    const signatureDataURL = canvasRef.current.toDataURL('image/png');
    onSubmit(signatureDataURL);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -50 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 50 }} 
      className="space-y-6 text-center"
    >
      <CardTitle className="text-2xl font-semibold text-primary">Étape 3: Signature Électronique</CardTitle>
      <CardDescription>Veuillez signer dans l'espace ci-dessous avec votre doigt ou la souris.</CardDescription>
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-64 bg-white dark:bg-gray-800 rounded-md border-2 border-primary cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 dark:text-gray-500">
            <Edit3 className="h-12 w-12 mb-2" />
            <p>Signez ici</p>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="absolute top-2 right-2 bg-white/80 dark:bg-gray-800/80"
          onClick={clearSignature}
          disabled={isLoading || !hasSignature}
        >
          <RotateCcw className="h-4 w-4 mr-1" /> Effacer
        </Button>
      </div>
      
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={onReset} 
          className="flex-1"
          disabled={isLoading}
        >
          Recommencer
        </Button>
        
        <Button 
          onClick={validateSignature} 
          className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
          disabled={isLoading || !hasSignature}
        >
          {isLoading ? 'Validation...' : 'Valider la signature'} <Save className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </motion.div>
  );
};

export default SignatureStep;
