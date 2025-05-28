
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardTitle } from '@/components/ui/card';
import { UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const MatriculeStep = ({ matricule, setMatricule, onSubmit, isLoading }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -50 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 50 }} 
      className="space-y-6"
    >
      <CardTitle className="text-2xl font-semibold text-center text-primary">Étape 1: Identification</CardTitle>
      <div>
        <Label htmlFor="matricule" className="text-lg">Matricule de la Guichetière</Label>
        <Input 
          id="matricule" 
          type="text" 
          value={matricule} 
          onChange={(e) => setMatricule(e.target.value)} 
          placeholder="Entrez votre matricule" 
          className="mt-2 text-lg p-4" 
          disabled={isLoading}
        />
      </div>
      <Button 
        onClick={onSubmit} 
        className="w-full text-lg py-6 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 text-white"
        disabled={isLoading}
      >
        {isLoading ? 'Vérification...' : 'Vérifier Matricule'} <UserCheck className="ml-2 h-5 w-5" />
      </Button>
    </motion.div>
  );
};

export default MatriculeStep;
