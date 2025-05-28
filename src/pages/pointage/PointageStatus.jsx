
import React from 'react';
import { Label } from '@/components/ui/label';
import { CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, Info, User, Users, Activity, Target, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

const GuichetierePointageItem = ({ guichetiere, pointages, creneauxPointageSettings, isIdentified }) => {
  const maxPointages = creneauxPointageSettings.length;
  const pointagesEffectues = pointages.length;
  const completionPercentage = maxPointages > 0 ? (pointagesEffectues / maxPointages) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-md border ${isIdentified ? 'bg-primary/10 border-primary shadow-lg' : 'bg-muted/50 dark:bg-muted/30'}`}
    >
      <div className="flex justify-between items-center">
        <p className={`font-semibold ${isIdentified ? 'text-primary' : 'text-foreground'}`}>{guichetiere.prenom} {guichetiere.nom}</p>
        {isIdentified && <User className="h-5 w-5 text-primary" />}
      </div>
      <p className="text-xs text-muted-foreground">Matricule: {guichetiere.matricule}</p>
      <div className="mt-2">
        <Label className="text-xs">Progression ({pointagesEffectues}/{maxPointages})</Label>
        <div className="w-full bg-background dark:bg-gray-700 rounded-full h-2.5 mt-0.5 overflow-hidden">
          <motion.div 
            className={`h-2.5 rounded-full ${completionPercentage >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, completionPercentage)}%`}}
            transition={{ duration: 0.5, ease: "circOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">{completionPercentage.toFixed(0)}%</p>
      </div>
      {pointagesEffectues > 0 && (
        <div className="mt-1">
          <Label className="text-xs">Dernier pointage:</Label>
          <p className="text-xs text-foreground">{new Date(pointages[pointagesEffectues - 1].time).toLocaleTimeString()}</p>
        </div>
      )}
      {pointagesEffectues === 0 && (
         <p className="text-xs text-muted-foreground italic mt-1">Aucun pointage.</p>
      )}
       {pointagesEffectues >= maxPointages && maxPointages > 0 && (
        <div className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center">
            <CheckCircle className="h-3 w-3 mr-1"/> Pointages complets.
        </div>
      )}
    </motion.div>
  );
};

const AgencyDailySummary = ({ guichetieresPlanifiees, pointagesData, creneauxPointageSettings }) => {
  if (guichetieresPlanifiees.length === 0) return null;
  const maxPointagesParGuichetiere = creneauxPointageSettings.length;

  const totalPlanifiees = guichetieresPlanifiees.length;
  const guichetieresCompletes = guichetieresPlanifiees.filter(g => 
    (pointagesData[g.matricule] || []).length >= maxPointagesParGuichetiere && maxPointagesParGuichetiere > 0
  ).length;
  
  const totalPointagesEffectues = guichetieresPlanifiees.reduce((sum, g) => sum + (pointagesData[g.matricule] || []).length, 0);
  const totalPointagesAttendus = totalPlanifiees * maxPointagesParGuichetiere;
  const completionGlobaleAgence = totalPointagesAttendus > 0 ? (totalPointagesEffectues / totalPointagesAttendus) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mt-4 p-4 bg-primary/5 dark:bg-primary/10 border border-primary/30 rounded-lg space-y-2"
    >
      <h4 className="font-semibold text-primary flex items-center"><Activity className="h-5 w-5 mr-2"/>Résumé Agence du Jour</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center"><Users className="h-4 w-4 mr-1 text-primary/80"/>Planifiées: <span className="font-semibold ml-auto">{totalPlanifiees}</span></div>
        <div className="flex items-center"><CheckCircle className="h-4 w-4 mr-1 text-green-500"/>Complétés: <span className="font-semibold ml-auto">{guichetieresCompletes}</span></div>
        <div className="flex items-center"><Target className="h-4 w-4 mr-1 text-primary/80"/>Pointages Effectués: <span className="font-semibold ml-auto">{totalPointagesEffectues}</span></div>
        <div className="flex items-center"><Target className="h-4 w-4 mr-1 text-primary/80"/>Pointages Attendus: <span className="font-semibold ml-auto">{totalPointagesAttendus}</span></div>
      </div>
      {totalPointagesAttendus > 0 && (
        <div className="pt-1">
          <Label className="text-xs text-primary">Taux de complétion global</Label>
          <div className="w-full bg-background dark:bg-gray-700 rounded-full h-3 mt-0.5 overflow-hidden">
            <motion.div 
              className={`h-3 rounded-full ${completionGlobaleAgence >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-primary to-green-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, completionGlobaleAgence)}%`}}
              transition={{ duration: 0.5, ease: "circOut", delay: 0.3 }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{completionGlobaleAgence.toFixed(0)}%</p>
        </div>
      )}
    </motion.div>
  );
};


const PointageStatus = ({ guichetieresPlanifiees, pointagesData, creneauxPointageSettings, identifiedGuichetiereMatricule, nomAgence }) => {
  if (!guichetieresPlanifiees || guichetieresPlanifiees.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md text-amber-700 dark:text-amber-300 flex flex-col items-center text-center">
        <AlertTriangle className="h-8 w-8 mb-2"/> 
        <p className="font-semibold">Aucune guichetière planifiée</p>
        <p className="text-xs">Aucune guichetière n'est actuellement planifiée pour l'agence "{nomAgence}" aujourd'hui.</p>
        <p className="text-xs mt-1">Veuillez vérifier le planning ou contacter l'administration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CardDescription className="flex items-center"><Users className="h-5 w-5 mr-2 text-primary" /> Statut des guichetières planifiées</CardDescription>
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {guichetieresPlanifiees.map(g => {
          const gPointages = pointagesData[g.matricule] || [];
          return (
            <GuichetierePointageItem 
              key={g.id}
              guichetiere={g}
              pointages={gPointages}
              creneauxPointageSettings={creneauxPointageSettings}
              isIdentified={g.matricule === identifiedGuichetiereMatricule}
            />
          );
        })}
      </div>
      <AgencyDailySummary 
        guichetieresPlanifiees={guichetieresPlanifiees}
        pointagesData={pointagesData}
        creneauxPointageSettings={creneauxPointageSettings}
      />
       <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded-md text-blue-700 dark:text-blue-300">
         <h4 className="font-semibold flex items-center"><Info className="h-4 w-4 mr-1"/> Rappel Général</h4>
         <p className="text-xs">Nombre de pointages requis par jour : {creneauxPointageSettings.length}.</p>
         <p className="text-xs font-medium mt-1">Créneaux de pointage :</p>
         <ul className="list-disc list-inside text-xs">
            {creneauxPointageSettings.map((creneau, index) => (
                <li key={index}>Créneau {index + 1}: {creneau.debut} - {creneau.fin}</li>
            ))}
         </ul>
       </div>
    </div>
  );
};

export default PointageStatus;
