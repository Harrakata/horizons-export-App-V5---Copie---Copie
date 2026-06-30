import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AbsenceRequestsPanel from '@/components/absences/AbsenceRequestsPanel';
import { ABSENCE_ROLES } from '@/lib/absences';

// Demandes d'absence — espace Guichetière (demandeur).
const DemandesAbsencePage = () => {
  const { guichetiereInfo, guichetiereDetails, nomAgence } = useOutletContext() || {};
  const details = guichetiereDetails || {};
  const demandeur = {
    role: ABSENCE_ROLES.GUICHETIERE,
    id: details.id || guichetiereInfo?.id,
    matricule: guichetiereInfo?.matricule || details.matricule || null,
    nom: [details.prenom, details.nom].filter(Boolean).join(' ') || guichetiereInfo?.matricule || 'Guichetière',
    agence_nom: nomAgence || details.agenceAssigne || null,
    secteur: details.secteur || null,
    region: details.region || null,
  };
  return <AbsenceRequestsPanel demandeur={demandeur} />;
};

export default DemandesAbsencePage;
