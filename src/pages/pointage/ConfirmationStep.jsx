import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, RotateCcw, Clock, PenSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const ConfirmationStep = ({ onSubmit, onReset, isLoading, currentPointageStatus, signature }) => {
  const canPointe = currentPointageStatus?.canPointe;
  const message = currentPointageStatus?.message;
  const [autoConfirmTime, setAutoConfirmTime] = useState(10);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let timer;
    if (canPointe && autoConfirmTime > 0) {
      timer = setTimeout(() => {
        setAutoConfirmTime(prev => prev - 1);
      }, 1000);
    } else if (canPointe && autoConfirmTime === 0 && !isLoading) {
      setShowSuccess(true);
      setTimeout(() => {
        onSubmit();
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [autoConfirmTime, canPointe, isLoading, onSubmit]);
  
  const handleManualSubmit = () => {
    setShowSuccess(true);
    setTimeout(() => {
      onSubmit();
    }, 500);
  };
  
  const handleReset = () => {
    setAutoConfirmTime(10);
    setShowSuccess(false);
    onReset();
  };

  return (
    <motion.div 
      key="confirmation"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      {showSuccess ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, 0] }}
          className="mb-6"
        >
          <CheckCircle className="h-28 w-28 text-green-500 mx-auto" />
        </motion.div>
      ) : canPointe ? (
        <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
      ) : (
        <AlertTriangle className="h-20 w-20 text-red-500 mx-auto mb-6" />
      )}
      
      <h2 className="text-2xl font-semibold mb-3">Confirmation du Pointage</h2>
      <p className={`text-lg mb-6 ${canPointe ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'}`}>
        {message || (canPointe ? "Veuillez confirmer votre pointage." : "Impossible de pointer pour le moment.")}
      </p>
      
      {/* Affichage de la signature */}
      {signature && (
        <div className="mb-6">
          <div className="flex items-center justify-center mb-2">
            <PenSquare className="h-5 w-5 mr-2 text-primary" />
            <h3 className="text-lg font-medium text-primary">Votre signature</h3>
          </div>
          <div className="mx-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 w-64 h-auto">
            <img 
              src={signature} 
              alt="Signature électronique" 
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
      
      {canPointe && !showSuccess && (
        <div className="mb-6 flex justify-center">
          <motion.div 
            className="flex items-center rounded-full bg-primary/10 px-4 py-2"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Clock className="h-5 w-5 mr-2 text-primary" />
            <span className="text-primary font-medium">
              Validation automatique dans {autoConfirmTime} secondes
            </span>
          </motion.div>
        </div>
      )}
      
      <div className="flex justify-center space-x-4">
        <Button variant="outline" onClick={handleReset} disabled={isLoading || showSuccess} className="text-lg px-8 py-6">
          <RotateCcw className="mr-2 h-5 w-5" /> Annuler
        </Button>
        <Button 
          onClick={handleManualSubmit} 
          disabled={isLoading || !canPointe || showSuccess} 
          className="text-lg px-8 py-6 bg-gradient-to-r from-green-500 to-primary hover:from-green-600 hover:to-primary/90 text-white"
        >
          {isLoading ? 'Validation...' : showSuccess ? 'Validé!' : 'Valider le Pointage'}
        </Button>
      </div>
      {!canPointe && (
        <p className="text-sm text-muted-foreground mt-4">
          Si vous pensez qu'il s'agit d'une erreur, veuillez vérifier l'heure ou contacter votre chef d'agence.
        </p>
      )}
    </motion.div>
  );
};

export default ConfirmationStep;
