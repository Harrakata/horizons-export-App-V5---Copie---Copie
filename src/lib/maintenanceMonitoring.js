const ONE_MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

export const normalizeMaintenanceText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const formatMaintenanceDateTime = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('fr-FR');
};

export const getMaintenanceInterventionTypeLabel = (type) => (type === 'curative' ? 'Curative' : 'Préventive');

export const getMaintenanceInterventionStatusClass = (status) => {
  if (status === 'Terminée') return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'En cours') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Annulée') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
};

export const getMaintenanceFollowUp = (latestIntervention, referenceDate = new Date()) => {
  if (!latestIntervention?.date_intervention) {
    return {
      label: 'Faire maintenance préventive',
      className: 'border-red-200 bg-red-50 text-red-700',
      detail: 'Aucune maintenance recensée sur le dernier mois.',
    };
  }

  const interventionDate = new Date(latestIntervention.date_intervention);
  if (Number.isNaN(interventionDate.getTime())) {
    return {
      label: 'Faire maintenance préventive',
      className: 'border-red-200 bg-red-50 text-red-700',
      detail: 'Date de maintenance non exploitable.',
    };
  }

  const safeReferenceDate =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());
  const referenceTimestamp = Number.isNaN(safeReferenceDate.getTime()) ? Date.now() : safeReferenceDate.getTime();
  const isRecent = referenceTimestamp - interventionDate.getTime() <= ONE_MONTH_IN_MS;

  if (isRecent) {
    return {
      label: 'Maintenance à jour',
      className: 'border-green-200 bg-green-50 text-green-700',
      detail: `${getMaintenanceInterventionTypeLabel(latestIntervention.type_intervention)} du ${formatMaintenanceDateTime(
        latestIntervention.date_intervention
      )}`,
    };
  }

  return {
    label: 'Faire maintenance préventive',
    className: 'border-red-200 bg-red-50 text-red-700',
    detail: `Derniere maintenance ${formatMaintenanceDateTime(latestIntervention.date_intervention)}`,
  };
};

export const getTerminalSousEnsembles = (terminal) =>
  [
    { key: 'imprimante', label: 'Imprimante', reference: terminal?.imprimante_reference || '' },
    { key: 'lecteur', label: 'Lecteur', reference: terminal?.lecteur_reference || '' },
    { key: 'ecran', label: 'Écran', reference: terminal?.ecran_reference || '' },
    { key: 'afficheur', label: 'Afficheur client', reference: terminal?.afficheur_reference || '' },
    { key: 'buc', label: 'BUC', reference: terminal?.buc_reference || '' },
    { key: 'carrosserie', label: 'Carrosserie', reference: terminal?.carrosserie_reference || '' },
    { key: 'alimentation', label: 'Alimentation', reference: terminal?.alimentation_reference || '' },
  ].filter((item) => item.reference);

const getSousEnsemblePrefix = (reference) =>
  (reference || '').replace(/\d+$/, '').toUpperCase();

const getLatestInterventionForReference = (interventions, terminalId, reference) => {
  const refPrefix = getSousEnsemblePrefix(reference);
  return (interventions || [])
    .filter((intervention) => {
      if (String(intervention.terminal_id) !== String(terminalId)) return false;
      if (intervention.statut === 'Annulée') return false;
      // Exact reference match OR same category prefix (e.g. IMP03 matches IMP05 for same terminal)
      if (normalizeMaintenanceText(intervention.sous_ensemble) === normalizeMaintenanceText(reference)) return true;
      const iPrefix = getSousEnsemblePrefix(intervention.sous_ensemble);
      return refPrefix && iPrefix && iPrefix === refPrefix;
    })
    .sort((firstIntervention, secondIntervention) => {
      const secondDate = new Date(secondIntervention.date_intervention || 0).getTime();
      const firstDate = new Date(firstIntervention.date_intervention || 0).getTime();
      return secondDate - firstDate;
    })[0] || null;
};

export const buildTerminalSousEnsembleRows = (terminaux, interventions, agencesById = {}, referenceDate = new Date()) =>
  (terminaux || []).flatMap((terminal) => {
    const sousEnsembles = getTerminalSousEnsembles(terminal);
    const agence = agencesById[String(terminal.agence_id)] || null;

    if (sousEnsembles.length === 0) {
      const latestTerminalIntervention = (interventions || [])
        .filter(
          (intervention) =>
            String(intervention.terminal_id) === String(terminal.id) && intervention.statut !== 'Annulée'
        )
        .sort((firstIntervention, secondIntervention) => {
          const secondDate = new Date(secondIntervention.date_intervention || 0).getTime();
          const firstDate = new Date(firstIntervention.date_intervention || 0).getTime();
          return secondDate - firstDate;
        })[0] || null;

      return [
        {
          terminalId: terminal.id,
          agenceId: terminal.agence_id || agence?.id || null,
          terminalReference: terminal.reference,
          terminalType: terminal.type_terminal || 'N/A',
          terminalPosition: terminal.position || 'Position non definie',
          terminalStatus: terminal.statut || 'N/A',
          agenceNom: agence?.nom || terminal.agence_nom || 'N/A',
          regionNom: agence?.region || terminal.agence_region || 'N/A',
          sousEnsembleLabel: 'Terminal',
          sousEnsembleReference: 'Non renseigne',
          latestIntervention: latestTerminalIntervention,
          followUp: getMaintenanceFollowUp(latestTerminalIntervention, referenceDate),
        },
      ];
    }

    return sousEnsembles.map((sousEnsemble) => {
      const latestIntervention = getLatestInterventionForReference(interventions, terminal.id, sousEnsemble.reference);

      return {
        terminalId: terminal.id,
        agenceId: terminal.agence_id || agence?.id || null,
        terminalReference: terminal.reference,
        terminalType: terminal.type_terminal || 'N/A',
        terminalPosition: terminal.position || 'Position non definie',
        terminalStatus: terminal.statut || 'N/A',
        agenceNom: agence?.nom || terminal.agence_nom || 'N/A',
        regionNom: agence?.region || terminal.agence_region || 'N/A',
        sousEnsembleLabel: sousEnsemble.label,
        sousEnsembleReference: sousEnsemble.reference,
        latestIntervention,
        followUp: getMaintenanceFollowUp(latestIntervention, referenceDate),
      };
    });
  });

const getLatestInterventionFromRows = (rows) =>
  rows
    .map((row) => row.latestIntervention)
    .filter(Boolean)
    .sort((firstIntervention, secondIntervention) => {
      const secondDate = new Date(secondIntervention?.date_intervention || 0).getTime();
      const firstDate = new Date(firstIntervention?.date_intervention || 0).getTime();
      return secondDate - firstDate;
    })[0] || null;

const getTerminalFollowUp = (rows) => {
  const totalRows = rows.length;
  const rowsToHandle = rows.filter((row) => row.followUp.label !== 'Maintenance à jour').length;

  if (rowsToHandle === 0) {
    return {
      label: 'Maintenance à jour',
      className: 'border-green-200 bg-green-50 text-green-700',
      detail:
        totalRows <= 1
          ? 'Le terminal est a jour sur son sous-ensemble suivi.'
          : `${totalRows}/${totalRows} sous-ensemble(s) sont a jour.`,
    };
  }

  return {
    label: 'Faire maintenance préventive',
    className: 'border-red-200 bg-red-50 text-red-700',
    detail:
      totalRows <= 1
        ? 'Le terminal doit etre traite.'
        : `${rowsToHandle} sous-ensemble(s) a traiter sur ${totalRows}.`,
  };
};

export const buildTerminalMonitoringGroups = (
  terminaux,
  interventions,
  agencesById = {},
  referenceDate = new Date()
) => {
  const rows = buildTerminalSousEnsembleRows(terminaux, interventions, agencesById, referenceDate);
  const groupsByTerminalId = rows.reduce((accumulator, row) => {
    const key = String(row.terminalId);

    if (!accumulator[key]) {
      accumulator[key] = {
        terminalId: row.terminalId,
        agenceId: row.agenceId,
        terminalReference: row.terminalReference,
        terminalType: row.terminalType,
        terminalPosition: row.terminalPosition,
        terminalStatus: row.terminalStatus,
        agenceNom: row.agenceNom,
        regionNom: row.regionNom,
        sousEnsembles: [],
      };
    }

    accumulator[key].sousEnsembles.push(row);
    return accumulator;
  }, {});

  return Object.values(groupsByTerminalId).map((group) => {
    const latestIntervention = getLatestInterventionFromRows(group.sousEnsembles);

    return {
      ...group,
      latestIntervention,
      followUp: getTerminalFollowUp(group.sousEnsembles),
    };
  });
};
