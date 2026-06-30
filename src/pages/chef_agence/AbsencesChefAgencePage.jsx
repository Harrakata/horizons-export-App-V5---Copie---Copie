import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AbsenceApprovalPanel from '@/components/absences/AbsenceApprovalPanel';
import { ABSENCE_ROLES } from '@/lib/absences';

// Validation des demandes d'absence des guichetières de l'agence — Chef d'agence.
const AbsencesChefAgencePage = () => {
  const { agenceNom } = useOutletContext() || {};
  return (
    <AbsenceApprovalPanel
      filter={{ role_demandeur: ABSENCE_ROLES.GUICHETIERE, agence_nom: agenceNom || '' }}
      approver={{ name: agenceNom ? `Chef agence ${agenceNom}` : "Chef d'agence", role: "Chef d'agence" }}
      title="Demandes d'absence — Guichetières"
      description={`Validez les demandes des guichetières de votre agence${agenceNom ? ` (${agenceNom})` : ''}.`}
    />
  );
};

export default AbsencesChefAgencePage;
