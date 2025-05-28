import React, { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PointageNotification = ({ 
  show, 
  type = 'reminder', // 'reminder' | 'success' | 'late'
  message,
  onClose,
  autoCloseDelay = 5000,
  action
}) => {
  const [isVisible, setIsVisible] = useState(show);
  
  useEffect(() => {
    setIsVisible(show);
    
    if (show && autoCloseDelay) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) setTimeout(onClose, 300);
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [show, autoCloseDelay, onClose]);
  
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) setTimeout(onClose, 300);
  };
  
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'late':
        return <Clock className="h-8 w-8 text-red-500" />;
      case 'reminder':
      default:
        return <Bell className="h-8 w-8 text-blue-500" />;
    }
  };
  
  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/20';
      case 'late': return 'bg-red-50 dark:bg-red-900/20';
      case 'reminder': 
      default: return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };
  
  const getBorderColor = () => {
    switch (type) {
      case 'success': return 'border-l-green-500';
      case 'late': return 'border-l-red-500';
      case 'reminder': 
      default: return 'border-l-blue-500';
    }
  };
  
  const currentTime = format(new Date(), 'HH:mm', { locale: fr });
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 max-w-sm border-l-4 ${getBorderColor()} shadow-lg rounded-md overflow-hidden z-50 ${getBackgroundColor()}`}
        >
          <div className="p-4 flex">
            <div className="flex-shrink-0 mr-3">
              {getIcon()}
            </div>
            <div className="flex-1 pr-8">
              <div className="flex justify-between items-center mb-1">
                <p className="font-medium">
                  {type === 'reminder' ? 'Rappel de pointage' : 
                   type === 'success' ? 'Pointage réussi' : 'Attention retard'}
                </p>
                <span className="text-xs text-gray-500">{currentTime}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {message || (
                  type === 'reminder' ? 'N\'oubliez pas de pointer votre entrée/sortie' : 
                  type === 'success' ? 'Votre pointage a bien été enregistré' : 
                  'Attention, vous êtes en retard pour le pointage'
                )}
              </p>
              
              {action && (
                <button 
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              )}
            </div>
            <button 
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PointageNotification; 