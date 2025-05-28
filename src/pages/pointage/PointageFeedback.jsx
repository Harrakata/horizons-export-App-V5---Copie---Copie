import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ThumbsUp, ThumbsDown, Send, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const PointageFeedback = ({ onClose, onSubmit }) => {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isHappy, setIsHappy] = useState(null);

  const handleSubmit = () => {
    const feedbackData = {
      rating,
      comment,
      isHappy,
      timestamp: new Date().toISOString(),
    };
    
    onSubmit?.(feedbackData);
    setSubmitted(true);
    
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-lg p-6 z-50"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Votre avis nous intéresse</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {submitted ? (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex flex-col items-center py-6"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: 1, duration: 0.5 }}
          >
            <ThumbsUp className="h-16 w-16 text-green-500 mb-4" />
          </motion.div>
          <p className="text-xl font-medium">Merci pour votre feedback!</p>
        </motion.div>
      ) : (
        <>
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-3">Comment s'est passé votre pointage aujourd'hui?</p>
            
            <div className="flex justify-center gap-6 mb-6">
              <Button 
                variant={isHappy === true ? "default" : "outline"}
                className={`flex-col gap-2 py-6 ${isHappy === true ? 'bg-green-500 hover:bg-green-600' : ''}`}
                onClick={() => setIsHappy(true)}
              >
                <ThumbsUp className="h-8 w-8" />
                <span>Satisfait</span>
              </Button>
              
              <Button 
                variant={isHappy === false ? "default" : "outline"}
                className={`flex-col gap-2 py-6 ${isHappy === false ? 'bg-red-500 hover:bg-red-600' : ''}`}
                onClick={() => setIsHappy(false)}
              >
                <ThumbsDown className="h-8 w-8" />
                <span>Insatisfait</span>
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">Évaluez votre expérience (optionnel)</p>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button 
                  key={star}
                  variant="ghost"
                  size="icon"
                  className={`h-12 w-12 ${rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                  onClick={() => setRating(star)}
                >
                  <Star className="h-8 w-8 fill-current" />
                </Button>
              ))}
            </div>
            
            <Textarea 
              placeholder="Commentaire ou suggestion (optionnel)"
              className="mb-6"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            
            <Button 
              className="w-full flex gap-2 justify-center"
              onClick={handleSubmit}
              disabled={isHappy === null}
            >
              <Send className="h-4 w-4" />
              Envoyer mon avis
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default PointageFeedback; 