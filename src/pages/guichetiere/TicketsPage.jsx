import React from 'react';
import { useOutletContext } from 'react-router-dom';
import TicketsPanel from '@/components/tickets/TicketsPanel';
import { TICKET_ROLES } from '@/lib/tickets';

// Tickets / Incidents — espace Guichetière (déclarant : voit ses propres tickets).
const TicketsPage = () => {
  const { guichetiereInfo, guichetiereDetails, nomAgence } = useOutletContext() || {};
  const details = guichetiereDetails || {};
  const id = details.id || guichetiereInfo?.id;
  const identity = {
    role: TICKET_ROLES.GUICHETIERE,
    id,
    nom: [details.prenom, details.nom].filter(Boolean).join(' ') || guichetiereInfo?.matricule || 'Guichetière',
    agence_nom: nomAgence || details.agenceAssigne || null,
  };
  return (
    <TicketsPanel
      mode="declarant"
      identity={identity}
      filter={{ createur_id: id }}
      spaceKey="espace-guichetiere"
      title="Mes tickets / incidents"
      description="Signalez un incident (terminal, matériel, réseau…) et suivez son traitement."
    />
  );
};

export default TicketsPage;
