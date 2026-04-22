export const VALIDATOR_FUNCTIONS = {
  REGIONAL: 'Directeur régional',
  GENERAL: 'Directeur général',
};

export const WORKFLOW_STAGES = {
  REGIONAL: 'directeur_regional',
  GENERAL: 'directeur_general',
  EXPLOITATION: 'exploitation',
  AGENCY_PAYMENT: 'agence_paiement',
  DONE: 'terminee',
};

export const DEMANDE_STATUSES = {
  PENDING_REGIONAL: 'En attente directeur régional',
  PENDING_GENERAL: 'En attente directeur général',
  PENDING_EXPLOITATION: 'En attente exploitation',
  AUTHORIZED_FOR_PAYMENT: 'Autorisée pour paiement',
  PAID: 'Payée',
  REJECTED: 'Refusée',
};

export const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const getTodayDate = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('fr-FR');
};

export const formatDisplayDateTime = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('fr-FR');
};

export const formatCurrency = (amount) => {
  const numericAmount = Number(amount ?? 0);

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(numericAmount);
};

export const generateDemandeCode = () => {
  const currentDate = new Date();
  const datePart = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, '0'),
    String(currentDate.getDate()).padStart(2, '0'),
  ].join('');
  const timePart = [
    String(currentDate.getHours()).padStart(2, '0'),
    String(currentDate.getMinutes()).padStart(2, '0'),
    String(currentDate.getSeconds()).padStart(2, '0'),
  ].join('');

  return `PGG-${datePart}-${timePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

export const getWorkflowStageLabel = (stage) => {
  switch (stage) {
    case WORKFLOW_STAGES.REGIONAL:
      return VALIDATOR_FUNCTIONS.REGIONAL;
    case WORKFLOW_STAGES.GENERAL:
      return VALIDATOR_FUNCTIONS.GENERAL;
    case WORKFLOW_STAGES.EXPLOITATION:
      return 'Exploitation';
    case WORKFLOW_STAGES.AGENCY_PAYMENT:
      return 'Paiement en agence';
    case WORKFLOW_STAGES.DONE:
      return 'Terminé';
    default:
      return 'Non défini';
  }
};

export const getStatusBadgeClass = (status) => {
  if (status === DEMANDE_STATUSES.AUTHORIZED_FOR_PAYMENT) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === DEMANDE_STATUSES.PAID) {
    return 'border-green-200 bg-green-50 text-green-700';
  }

  if (status === DEMANDE_STATUSES.REJECTED) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (
    status === DEMANDE_STATUSES.PENDING_REGIONAL ||
    status === DEMANDE_STATUSES.PENDING_GENERAL ||
    status === DEMANDE_STATUSES.PENDING_EXPLOITATION
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-slate-200 bg-slate-100 text-slate-600';
};

export const getProcedureForAmount = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  if (numericAmount < 100000) {
    return {
      trancheLabel: 'Inférieur à 100 000 FCFA',
      description:
        'Paiement en espèces possible via le terminal vendeur ou à la caisse LONAB, sans obligation d’identification du gagnant.',
      modePaiement: 'Espèces',
      lieuPaiement: 'Terminal vendeur ou caisse LONAB',
      identificationRequired: false,
      requiresRegionalApproval: false,
      requiresGeneralApproval: false,
      initialStatus: DEMANDE_STATUSES.PENDING_EXPLOITATION,
      initialStage: WORKFLOW_STAGES.EXPLOITATION,
      circuit: ['Chef d’agence', 'Exploitation', 'Paiement en agence'],
    };
  }

  if (numericAmount < 500000) {
    return {
      trancheLabel: 'De 100 000 FCFA à moins de 500 000 FCFA',
      description:
        'Paiement en espèces dans le point de vente, avec obligation d’identification du gagnant.',
      modePaiement: 'Espèces',
      lieuPaiement: 'Point de vente',
      identificationRequired: true,
      requiresRegionalApproval: false,
      requiresGeneralApproval: false,
      initialStatus: DEMANDE_STATUSES.PENDING_EXPLOITATION,
      initialStage: WORKFLOW_STAGES.EXPLOITATION,
      circuit: ['Chef d’agence', 'Exploitation', 'Paiement en agence'],
    };
  }

  if (numericAmount < 1000000) {
    return {
      trancheLabel: 'De 500 000 FCFA à moins de 1 000 000 FCFA',
      description:
        'Paiement en espèces uniquement dans une caisse LONAB, avec obligation d’identification du gagnant.',
      modePaiement: 'Espèces',
      lieuPaiement: 'Caisse LONAB',
      identificationRequired: true,
      requiresRegionalApproval: false,
      requiresGeneralApproval: false,
      initialStatus: DEMANDE_STATUSES.PENDING_EXPLOITATION,
      initialStage: WORKFLOW_STAGES.EXPLOITATION,
      circuit: ['Chef d’agence', 'Exploitation', 'Paiement en agence'],
    };
  }

  if (numericAmount < 5000000) {
    return {
      trancheLabel: 'De 1 000 000 FCFA à moins de 5 000 000 FCFA',
      description:
        'Paiement en espèces à la caisse LONAB, avec obligation d’identification du gagnant et validation du chef d’agence.',
      modePaiement: 'Espèces',
      lieuPaiement: 'Caisse LONAB',
      identificationRequired: true,
      requiresRegionalApproval: false,
      requiresGeneralApproval: false,
      initialStatus: DEMANDE_STATUSES.PENDING_EXPLOITATION,
      initialStage: WORKFLOW_STAGES.EXPLOITATION,
      circuit: ['Chef d’agence', 'Exploitation', 'Paiement en agence'],
    };
  }

  if (numericAmount < 50000000) {
    return {
      trancheLabel: 'De 5 000 000 FCFA à moins de 50 000 000 FCFA',
      description:
        'Paiement par chèque à la caisse LONAB, avec obligation d’identification du gagnant et validation du directeur régional.',
      modePaiement: 'Chèque',
      lieuPaiement: 'Caisse LONAB',
      identificationRequired: true,
      requiresRegionalApproval: true,
      requiresGeneralApproval: false,
      initialStatus: DEMANDE_STATUSES.PENDING_REGIONAL,
      initialStage: WORKFLOW_STAGES.REGIONAL,
      circuit: ['Chef d’agence', 'Directeur régional', 'Exploitation', 'Paiement en agence'],
    };
  }

  return {
    trancheLabel: 'Supérieur ou égal à 50 000 000 FCFA',
    description:
      'Paiement par chèque à la caisse LONAB, avec obligation d’identification du gagnant et validation du directeur général.',
    modePaiement: 'Chèque',
    lieuPaiement: 'Caisse LONAB',
    identificationRequired: true,
    requiresRegionalApproval: false,
    requiresGeneralApproval: true,
    initialStatus: DEMANDE_STATUSES.PENDING_GENERAL,
    initialStage: WORKFLOW_STAGES.GENERAL,
    circuit: ['Chef d’agence', 'Directeur général', 'Exploitation', 'Paiement en agence'],
  };
};

export const buildProcedureSummary = (procedure) => {
  if (!procedure) return '';

  return `${procedure.modePaiement} • ${procedure.lieuPaiement} • ${procedure.trancheLabel}`;
};

export const isValidatorAssignedToDemande = (demande, validator) => {
  if (!demande || !validator) return false;

  if (validator.fonction === VALIDATOR_FUNCTIONS.REGIONAL) {
    return (
      String(demande.directeurRegionalId ?? '') === String(validator.id ?? '') ||
      normalizeText(demande.directeurRegionalRegion) === normalizeText(validator.regionAssignee)
    );
  }

  if (validator.fonction === VALIDATOR_FUNCTIONS.GENERAL) {
    return String(demande.directeurGeneralId ?? '') === String(validator.id ?? '');
  }

  return false;
};

export const canValidatorHandleRequest = (demande, validator) => {
  if (!demande || !validator) return false;

  if (validator.fonction === VALIDATOR_FUNCTIONS.REGIONAL) {
    return (
      demande.niveauValidationCourant === WORKFLOW_STAGES.REGIONAL &&
      isValidatorAssignedToDemande(demande, validator)
    );
  }

  if (validator.fonction === VALIDATOR_FUNCTIONS.GENERAL) {
    return (
      demande.niveauValidationCourant === WORKFLOW_STAGES.GENERAL &&
      isValidatorAssignedToDemande(demande, validator)
    );
  }

  return false;
};
