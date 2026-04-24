import { supabase } from '@/lib/supabaseClient';
import {
  DEMANDE_STATUSES,
  formatCurrency,
  VALIDATOR_FUNCTIONS,
  WORKFLOW_STAGES,
} from '@/lib/paiementGainUtils';

export const WORKFLOW_CONFIG_TABLE = 'paiement_gain_workflow_config';

export const WORKFLOW_CONFIG_STATUSES = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
};

const buildDefaultWorkflowConfigs = () => [
  {
    id: 'default-1',
    ordre: 1,
    codeWorkflow: 'PGG-INF-100K',
    libelle: 'Inférieur à 100 000 FCFA',
    montantMin: 0,
    montantMax: 100000,
    modePaiement: 'Espèces',
    lieuPaiement: 'Terminal vendeur ou caisse LONAB',
    identificationRequise: false,
    requiresChefApproval: false,
    requiresRegionalApproval: false,
    requiresGeneralApproval: false,
    description:
      'Paiement en espèces possible via le terminal vendeur ou à la caisse LONAB, sans obligation d’identification du gagnant.',
    statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
    persisted: false,
  },
  {
    id: 'default-2',
    ordre: 2,
    codeWorkflow: 'PGG-100K-500K',
    libelle: 'De 100 000 FCFA à moins de 500 000 FCFA',
    montantMin: 100000,
    montantMax: 500000,
    modePaiement: 'Espèces',
    lieuPaiement: 'Point de vente',
    identificationRequise: true,
    requiresChefApproval: false,
    requiresRegionalApproval: false,
    requiresGeneralApproval: false,
    description:
      'Paiement en espèces dans le point de vente, avec obligation d’identification du gagnant.',
    statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
    persisted: false,
  },
  {
    id: 'default-3',
    ordre: 3,
    codeWorkflow: 'PGG-500K-1M',
    libelle: 'De 500 000 FCFA à moins de 1 000 000 FCFA',
    montantMin: 500000,
    montantMax: 1000000,
    modePaiement: 'Espèces',
    lieuPaiement: 'Caisse LONAB',
    identificationRequise: true,
    requiresChefApproval: false,
    requiresRegionalApproval: false,
    requiresGeneralApproval: false,
    description:
      'Paiement en espèces uniquement dans une caisse LONAB, avec obligation d’identification du gagnant.',
    statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
    persisted: false,
  },
  {
    id: 'default-4',
    ordre: 4,
    codeWorkflow: 'PGG-1M-5M',
    libelle: 'De 1 000 000 FCFA à moins de 5 000 000 FCFA',
    montantMin: 1000000,
    montantMax: 5000000,
    modePaiement: 'Espèces',
    lieuPaiement: 'Caisse LONAB',
    identificationRequise: true,
    requiresChefApproval: true,
    requiresRegionalApproval: false,
    requiresGeneralApproval: false,
    description:
      'Paiement en espèces à la caisse LONAB, avec obligation d’identification du gagnant et validation du chef d’agence.',
    statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
    persisted: false,
  },
  {
    id: 'default-5',
    ordre: 5,
    codeWorkflow: 'PGG-5M-50M',
    libelle: 'De 5 000 000 FCFA à moins de 50 000 000 FCFA',
    montantMin: 5000000,
    montantMax: 50000000,
    modePaiement: 'Chèque',
    lieuPaiement: 'Caisse LONAB',
    identificationRequise: true,
    requiresChefApproval: true,
    requiresRegionalApproval: true,
    requiresGeneralApproval: false,
    description:
      'Paiement par chèque à la caisse LONAB, avec obligation d’identification du gagnant, validation du chef d’agence et validation du directeur régional.',
    statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
    persisted: false,
  },
  {
    id: 'default-6',
    ordre: 6,
    codeWorkflow: 'PGG-SUP-50M',
    libelle: 'Supérieur ou égal à 50 000 000 FCFA',
    montantMin: 50000000,
    montantMax: null,
    modePaiement: 'Chèque',
    lieuPaiement: 'Caisse LONAB',
    identificationRequise: true,
    requiresChefApproval: true,
    requiresRegionalApproval: true,
    requiresGeneralApproval: true,
    description:
      'Paiement par chèque à la caisse LONAB, avec obligation d’identification du gagnant, validation du chef d’agence, validation du directeur régional puis validation du directeur général.',
    statut: WORKFLOW_CONFIG_STATUSES.ACTIVE,
    persisted: false,
  },
];

export const DEFAULT_PAIEMENT_GAIN_WORKFLOW_CONFIGS = buildDefaultWorkflowConfigs();

const parseNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;

  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'oui';
};

export const normalizeWorkflowConfigRecord = (record, index = 0) => ({
  id: record.id ?? `workflow-${index + 1}`,
  ordre: Number(record.ordre ?? index + 1),
  codeWorkflow: String(record.codeWorkflow ?? '').trim(),
  libelle: String(record.libelle ?? '').trim(),
  montantMin: parseNullableNumber(record.montantMin) ?? 0,
  montantMax: parseNullableNumber(record.montantMax),
  modePaiement: String(record.modePaiement ?? '').trim(),
  lieuPaiement: String(record.lieuPaiement ?? '').trim(),
  identificationRequise: parseBoolean(record.identificationRequise),
  requiresChefApproval: parseBoolean(record.requiresChefApproval),
  requiresRegionalApproval: parseBoolean(record.requiresRegionalApproval),
  requiresGeneralApproval: parseBoolean(record.requiresGeneralApproval),
  description: String(record.description ?? '').trim() || null,
  statut: record.statut || WORKFLOW_CONFIG_STATUSES.ACTIVE,
  persisted: typeof record.id === 'number' || (typeof record.id === 'string' && !String(record.id).startsWith('default-')),
});

export const sortWorkflowConfigs = (configs) =>
  [...configs].sort((firstConfig, secondConfig) => {
    if (firstConfig.ordre !== secondConfig.ordre) {
      return firstConfig.ordre - secondConfig.ordre;
    }

    if (firstConfig.montantMin !== secondConfig.montantMin) {
      return firstConfig.montantMin - secondConfig.montantMin;
    }

    return firstConfig.libelle.localeCompare(secondConfig.libelle);
  });

export const getActiveWorkflowConfigs = (configs) =>
  sortWorkflowConfigs(configs).filter((config) => config.statut === WORKFLOW_CONFIG_STATUSES.ACTIVE);

export const buildWorkflowCircuit = (config) => {
  const circuit = [];

  if (config.requiresChefApproval) {
    circuit.push('Chef d’agence');
  }

  if (config.requiresRegionalApproval) {
    circuit.push(VALIDATOR_FUNCTIONS.REGIONAL);
  }

  if (config.requiresGeneralApproval) {
    circuit.push(VALIDATOR_FUNCTIONS.GENERAL);
  }

  circuit.push('Exploitation', 'Paiement en agence');

  return circuit;
};

const buildAutoDescription = (config) => {
  const obligations = [];

  if (config.identificationRequise) {
    obligations.push('obligation d’identification du gagnant');
  }

  if (config.requiresChefApproval) {
    obligations.push('validation du chef d’agence');
  }

  if (config.requiresRegionalApproval) {
    obligations.push('validation du directeur régional');
  }

  if (config.requiresGeneralApproval) {
    obligations.push('validation du directeur général');
  }

  if (obligations.length === 0) {
    return `Paiement ${config.modePaiement.toLowerCase()} via ${config.lieuPaiement}.`;
  }

  return `Paiement ${config.modePaiement.toLowerCase()} via ${config.lieuPaiement}, avec ${obligations.join(', ')}.`;
};

export const buildWorkflowRangeLabel = (config) => {
  if (config.montantMax === null) {
    return `>= ${formatCurrency(config.montantMin)}`;
  }

  if (config.montantMin <= 0) {
    return `< ${formatCurrency(config.montantMax)}`;
  }

  return `${formatCurrency(config.montantMin)} à < ${formatCurrency(config.montantMax)}`;
};

export const buildWorkflowApprovalsLabel = (config) => {
  const labels = [];

  if (config.requiresChefApproval) labels.push('Chef d’agence');
  if (config.requiresRegionalApproval) labels.push(VALIDATOR_FUNCTIONS.REGIONAL);
  if (config.requiresGeneralApproval) labels.push(VALIDATOR_FUNCTIONS.GENERAL);

  return labels.length > 0 ? labels.join(' > ') : 'Aucune validation hiérarchique';
};

export const buildProcedureFromWorkflowConfig = (config) => {
  let initialStage = WORKFLOW_STAGES.EXPLOITATION;
  let initialStatus = DEMANDE_STATUSES.PENDING_EXPLOITATION;

  if (config.requiresRegionalApproval) {
    initialStage = WORKFLOW_STAGES.REGIONAL;
    initialStatus = DEMANDE_STATUSES.PENDING_REGIONAL;
  } else if (config.requiresGeneralApproval) {
    initialStage = WORKFLOW_STAGES.GENERAL;
    initialStatus = DEMANDE_STATUSES.PENDING_GENERAL;
  }

  return {
    workflowCode: config.codeWorkflow,
    trancheLabel: config.libelle,
    description: config.description || buildAutoDescription(config),
    modePaiement: config.modePaiement,
    lieuPaiement: config.lieuPaiement,
    identificationRequired: config.identificationRequise,
    requiresChefApproval: config.requiresChefApproval,
    requiresRegionalApproval: config.requiresRegionalApproval,
    requiresGeneralApproval: config.requiresGeneralApproval,
    initialStatus,
    initialStage,
    circuit: buildWorkflowCircuit(config),
  };
};

export const resolveProcedureForAmount = (amount, workflowConfigs = DEFAULT_PAIEMENT_GAIN_WORKFLOW_CONFIGS) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return null;
  }

  const activeConfigs = getActiveWorkflowConfigs(workflowConfigs);
  const matchingConfig = activeConfigs.find((config) => (
    numericAmount >= Number(config.montantMin ?? 0) &&
    (config.montantMax === null || numericAmount < Number(config.montantMax))
  ));

  return matchingConfig ? buildProcedureFromWorkflowConfig(matchingConfig) : null;
};

export const isWorkflowConfigTableMissing = (error) => {
  if (!error) return false;

  const errorCode = String(error.code ?? '').trim().toUpperCase();
  const errorMessage = String(error.message ?? '').toLowerCase();

  if (errorCode === 'PGRST205' || errorCode === '42P01') {
    return true;
  }

  return (
    errorMessage.includes(`could not find the table 'public.${WORKFLOW_CONFIG_TABLE}'`) ||
    errorMessage.includes(`relation "public.${WORKFLOW_CONFIG_TABLE}" does not exist`) ||
    errorMessage.includes(`relation "${WORKFLOW_CONFIG_TABLE}" does not exist`) ||
    errorMessage.includes(`table "${WORKFLOW_CONFIG_TABLE}" does not exist`) ||
    errorMessage.includes(`table '${WORKFLOW_CONFIG_TABLE}' does not exist`)
  );
};

export const fetchPaiementGainWorkflowConfigs = async ({ includeInactive = false } = {}) => {
  const { data, error } = await supabase
    .from(WORKFLOW_CONFIG_TABLE)
    .select('*')
    .order('ordre', { ascending: true })
    .order('montantMin', { ascending: true });

  if (error) {
    const fallbackData = includeInactive
      ? DEFAULT_PAIEMENT_GAIN_WORKFLOW_CONFIGS
      : getActiveWorkflowConfigs(DEFAULT_PAIEMENT_GAIN_WORKFLOW_CONFIGS);

    return {
      data: fallbackData,
      error,
      isFallback: true,
      isMissingTable: isWorkflowConfigTableMissing(error),
    };
  }

  const normalizedConfigs = sortWorkflowConfigs((data || []).map(normalizeWorkflowConfigRecord));

  if (normalizedConfigs.length === 0) {
    const fallbackData = includeInactive
      ? DEFAULT_PAIEMENT_GAIN_WORKFLOW_CONFIGS
      : getActiveWorkflowConfigs(DEFAULT_PAIEMENT_GAIN_WORKFLOW_CONFIGS);

    return {
      data: fallbackData,
      error: null,
      isFallback: true,
      isMissingTable: false,
    };
  }

  return {
    data: includeInactive ? normalizedConfigs : getActiveWorkflowConfigs(normalizedConfigs),
    error: null,
    isFallback: false,
    isMissingTable: false,
  };
};

export const buildWorkflowConfigPayload = (config) => ({
  ordre: Number(config.ordre),
  codeWorkflow: String(config.codeWorkflow ?? '').trim(),
  libelle: String(config.libelle ?? '').trim(),
  montantMin: Number(config.montantMin ?? 0),
  montantMax: config.montantMax === null || config.montantMax === '' ? null : Number(config.montantMax),
  modePaiement: String(config.modePaiement ?? '').trim(),
  lieuPaiement: String(config.lieuPaiement ?? '').trim(),
  identificationRequise: Boolean(config.identificationRequise),
  requiresChefApproval: Boolean(config.requiresChefApproval),
  requiresRegionalApproval: Boolean(config.requiresRegionalApproval),
  requiresGeneralApproval: Boolean(config.requiresGeneralApproval),
  description: String(config.description ?? '').trim() || null,
  statut: config.statut || WORKFLOW_CONFIG_STATUSES.ACTIVE,
});
