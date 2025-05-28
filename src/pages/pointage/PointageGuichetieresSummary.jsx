import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, isValid } from 'date-fns';

const PointageGuichetieresSummary = ({ guichetieresPlanifiees, pointagesData, creneauxPointageSettings, currentCreneauIndex }) => {
  if (!guichetieresPlanifiees || guichetieresPlanifiees.length === 0) {
    return (
      <Card className="shadow-lg glassmorphism">
        <CardHeader>
          <CardTitle className="text-lg text-primary flex items-center">
            <Users className="mr-2 h-5 w-5" /> Statut des Guichetières
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune guichetière planifiée pour aujourd'hui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getGuichetiereStatus = (guichetiere) => {
    const userPointages = pointagesData[guichetiere.matricule] || [];
    const totalCreneaux = creneauxPointageSettings.length;
    const pointedCount = userPointages.length;
    const pointageComplet = pointedCount >= totalCreneaux && totalCreneaux > 0;
    const pointageEnCours = pointedCount > 0 && pointedCount < totalCreneaux;
    const pointageEnRetard = currentCreneauIndex > 0 && userPointages.every(p => p.creneauIndex !== currentCreneauIndex - 1);
    
    // Dernière action de pointage
    const lastPointage = userPointages.length > 0 ? 
      userPointages.reduce((latest, current) => 
        new Date(current.time) > new Date(latest.time) ? current : latest, userPointages[0]
      ) : null;

    return {
      matricule: guichetiere.matricule,
      nom: guichetiere.nom,
      prenom: guichetiere.prenom,
      status: pointageComplet ? 'complet' : pointageEnCours ? 'en-cours' : pointageEnRetard ? 'retard' : 'absent',
      pointedCount,
      totalCreneaux,
      progressPercent: totalCreneaux > 0 ? (pointedCount / totalCreneaux) * 100 : 0,
      lastPointageTime: lastPointage && lastPointage.time && isValid(new Date(lastPointage.time)) ? 
        format(new Date(lastPointage.time), 'HH:mm') : null,
      lastCreneauIndex: lastPointage ? lastPointage.creneauIndex : null
    };
  };

  const guichetieresStatus = guichetieresPlanifiees.map(getGuichetiereStatus);
  
  const statusCounts = {
    complet: guichetieresStatus.filter(g => g.status === 'complet').length,
    'en-cours': guichetieresStatus.filter(g => g.status === 'en-cours').length,
    retard: guichetieresStatus.filter(g => g.status === 'retard').length,
    absent: guichetieresStatus.filter(g => g.status === 'absent').length
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complet': return 'bg-green-500 text-white';
      case 'en-cours': return 'bg-blue-500 text-white';
      case 'retard': return 'bg-yellow-500 text-white';
      case 'absent': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complet': return <CheckCircle className="h-4 w-4" />;
      case 'en-cours': return <User className="h-4 w-4" />;
      case 'retard': return <AlertCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'complet': return 'Complet';
      case 'en-cours': return 'En cours';
      case 'retard': return 'En retard';
      case 'absent': return 'Absent';
      default: return 'Inconnu';
    }
  };

  return (
    <Card className="shadow-lg glassmorphism">
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center">
          <Users className="mr-2 h-5 w-5" /> Statut des Guichetières
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Object.keys(statusCounts).map(status => (
            <div key={status} className="flex flex-col items-center p-2 bg-muted rounded-lg">
              <div className={`h-8 w-8 flex items-center justify-center rounded-full ${getStatusColor(status)}`}>
                {getStatusIcon(status)}
              </div>
              <p className="text-xs font-medium mt-1">{getStatusText(status)}</p>
              <p className="text-lg font-bold">{statusCounts[status]}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2 overflow-auto max-h-48 pr-1 custom-scrollbar">
          {guichetieresStatus.map((g, index) => (
            <motion.div 
              key={g.matricule}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center bg-background/50 rounded-lg p-2 shadow-sm"
            >
              <div className={`h-8 w-8 flex items-center justify-center rounded-full mr-2 ${getStatusColor(g.status)}`}>
                {getStatusIcon(g.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <p className="text-sm font-medium truncate">{g.prenom} {g.nom}</p>
                  <p className="text-xs text-muted-foreground">{g.pointedCount}/{g.totalCreneaux}</p>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${g.progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, g.progressPercent)}%` }}
                  />
                </div>
                {g.lastPointageTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dernier pointage: {g.lastPointageTime} (C{g.lastCreneauIndex + 1})
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PointageGuichetieresSummary; 