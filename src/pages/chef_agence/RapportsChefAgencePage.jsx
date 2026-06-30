import React from 'react';
import { useOutletContext } from 'react-router-dom';
import RapportsPage from '@/pages/exploitation/RapportsPage';
import { REPORT_SCOPES } from '@/lib/reportsService';

// Centre de rapports pour le Chef d'agence : périmètre limité à SON agence.
const RapportsChefAgencePage = () => {
  const { chefId, agenceNom } = useOutletContext() || {};
  return (
    <RapportsPage
      scope={REPORT_SCOPES.CHEF_AGENCE}
      allowedAgenceNames={agenceNom ? [agenceNom] : []}
      actor={{ id: chefId || null, name: agenceNom ? `Chef agence ${agenceNom}` : "Chef d'agence", role: "Chef d'agence" }}
    />
  );
};

export default RapportsChefAgencePage;
