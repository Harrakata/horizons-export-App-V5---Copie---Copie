import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import MaintenancePlanningSection from '@/components/maintenance/MaintenancePlanningSection';

const MonPlanningMaintenancePage = () => {
  const { nomAgence } = useOutletContext();

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="shadow-xl glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center text-3xl font-bold text-primary">
            <CalendarClock className="mr-3 h-8 w-8" />
            Mon planning de Maintenance
          </CardTitle>
          <CardDescription>
            Gérez les passages maintenance prévus sur l’agence {nomAgence || 'connectée'}, par matin et après-midi.
          </CardDescription>
        </CardHeader>
      </Card>

      <MaintenancePlanningSection
        title={`Planification maintenance - ${nomAgence || 'Agence'}`}
        description="Planifiez les maintenances de votre agence, affectez les techniciens et suivez les visites réellement effectuées."
        canManage={true}
        lockedAgenceName={nomAgence}
        emptyTitle="Aucune maintenance n’est encore planifiée pour cette agence."
      />
    </motion.div>
  );
};

export default MonPlanningMaintenancePage;
