import React from 'react';
import { useOutletContext } from 'react-router-dom';
import TicketsPanel from '@/components/tickets/TicketsPanel';
import { TICKET_ROLES } from '@/lib/tickets';

// Tickets / Incidents — espace Chef d'agence (déclarant : voit les tickets de son agence).
const TicketsChefAgencePage = () => {
  const { chefId, agenceNom } = useOutletContext() || {};
  const identity = {
    role: TICKET_ROLES.CHEF_AGENCE,
    id: chefId || null,
    nom: agenceNom ? `Chef agence ${agenceNom}` : "Chef d'agence",
    agence_nom: agenceNom || null,
  };
  return (
    <TicketsPanel
      mode="declarant"
      identity={identity}
      filter={{ agence_nom: agenceNom || '' }}
      spaceKey="espace-chef-agence"
      title="Tickets / Incidents de l'agence"
      description="Signalez un incident et suivez ceux de votre agence."
    />
  );
};

export default TicketsChefAgencePage;
