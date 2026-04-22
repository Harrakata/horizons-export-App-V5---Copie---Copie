import { normalizeMaintenanceText } from '@/lib/maintenanceMonitoring';

export const MAINTENANCE_SHIFT_OPTIONS = [
  { value: 'matin', label: 'Matin' },
  { value: 'apres_midi', label: 'Après-midi' },
];

export const MAINTENANCE_EXECUTION_STATUSES = {
  planifiee: {
    label: 'Planifiée',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  effectuee: {
    label: 'Effectuée',
    className: 'border-green-200 bg-green-50 text-green-700',
  },
  non_effectuee: {
    label: 'Non effectuée',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  annulee: {
    label: 'Annulée',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

const MORNING_END_HOUR = 13;

export const getMaintenancePlanningShiftLabel = (value) =>
  MAINTENANCE_SHIFT_OPTIONS.find((option) => option.value === value)?.label || 'Matin';

export const formatMaintenancePlanningDate = (value) => {
  const dateKey = extractMaintenancePlanningDateKey(value);
  if (!dateKey) return 'N/A';

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString('fr-FR');
};

export const extractMaintenancePlanningDateKey = (value) => {
  if (!value) return '';

  const rawValue = String(value);
  const directMatch = rawValue.match(/^\d{4}-\d{2}-\d{2}/);
  if (directMatch) return directMatch[0];

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '';

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMaintenanceShiftFromDateTime = (value) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return 'matin';
  return parsedDate.getHours() < MORNING_END_HOUR ? 'matin' : 'apres_midi';
};

export const getMaintenancePlanningExecutionMeta = (status) =>
  MAINTENANCE_EXECUTION_STATUSES[status] || MAINTENANCE_EXECUTION_STATUSES.planifiee;

export const getMaintenancePlanningExecutionStatus = ({
  planningEntry,
  matchedInterventions,
  todayDateKey = extractMaintenancePlanningDateKey(new Date()),
}) => {
  if (planningEntry?.statut === 'annulee') return 'annulee';
  if ((matchedInterventions || []).length > 0) return 'effectuee';

  const planningDateKey = extractMaintenancePlanningDateKey(planningEntry?.date_planification);
  if (planningDateKey && planningDateKey < todayDateKey) return 'non_effectuee';

  return 'planifiee';
};

export const checkMaintenancePlanningConflicts = (planningEntries, payload, currentId = null) => {
  const planningDateKey = extractMaintenancePlanningDateKey(payload.date_planification);

  const normalizedRows = (planningEntries || []).filter(
    (entry) =>
      String(entry.id) !== String(currentId) &&
      entry.statut !== 'annulee'
  );

  const agencyConflict = normalizedRows.find(
    (entry) =>
      extractMaintenancePlanningDateKey(entry.date_planification) === planningDateKey &&
      entry.creneau === payload.creneau &&
      String(entry.agence_id) === String(payload.agence_id)
  );

  if (agencyConflict) {
    return "Cette agence est déjà planifiée sur ce créneau.";
  }

  const technicianConflict = normalizedRows.find(
    (entry) =>
      extractMaintenancePlanningDateKey(entry.date_planification) === planningDateKey &&
      entry.creneau === payload.creneau &&
      String(entry.technicien_id) === String(payload.technicien_id)
  );

  if (technicianConflict) {
    return 'Ce technicien est déjà programmé ailleurs sur ce créneau.';
  }

  return null;
};

const sortPlanningRows = (rows) =>
  [...rows].sort((firstRow, secondRow) => {
    const secondDate = extractMaintenancePlanningDateKey(secondRow.date_planification);
    const firstDate = extractMaintenancePlanningDateKey(firstRow.date_planification);

    if (secondDate !== firstDate) {
      return secondDate.localeCompare(firstDate);
    }

    if (firstRow.creneau === secondRow.creneau) return 0;
    return firstRow.creneau === 'matin' ? -1 : 1;
  });

export const buildMaintenancePlanningRows = ({
  planningEntries,
  agencesById = {},
  techniciensById = {},
  terminauxById = {},
  interventions = [],
}) =>
  sortPlanningRows(
    (planningEntries || []).map((planningEntry) => {
      const agence = agencesById[String(planningEntry.agence_id)] || null;
      const technicien = techniciensById[String(planningEntry.technicien_id)] || null;
      const planningDateKey = extractMaintenancePlanningDateKey(planningEntry.date_planification);

      const matchedInterventions = (interventions || [])
        .filter((intervention) => {
          if (intervention.statut === 'Annulée') return false;
          if (String(intervention.technicien_id) !== String(planningEntry.technicien_id)) return false;
          if (extractMaintenancePlanningDateKey(intervention.date_intervention) !== planningDateKey) return false;
          if (getMaintenanceShiftFromDateTime(intervention.date_intervention) !== planningEntry.creneau) return false;

          const terminal = terminauxById[String(intervention.terminal_id)] || null;
          return String(terminal?.agence_id || '') === String(planningEntry.agence_id);
        })
        .sort((firstIntervention, secondIntervention) => {
          const secondDate = new Date(secondIntervention.date_intervention || 0).getTime();
          const firstDate = new Date(firstIntervention.date_intervention || 0).getTime();
          return secondDate - firstDate;
        });

      const executionStatus = getMaintenancePlanningExecutionStatus({
        planningEntry,
        matchedInterventions,
      });

      const technicienNom =
        planningEntry.technicien_label ||
        [technicien?.prenom, technicien?.nom].filter(Boolean).join(' ').trim() ||
        'Technicien non renseigné';

      return {
        ...planningEntry,
        regionNom: planningEntry.region || agence?.region || 'N/A',
        agenceNom: planningEntry.agence_nom || agence?.nom || 'N/A',
        technicienNom,
        technicienMatricule: technicien?.matricule || planningEntry.technicien_matricule || '',
        technicienTelephone: technicien?.telephone || '',
        technicienEmail: technicien?.email || '',
        creneauLabel: getMaintenancePlanningShiftLabel(planningEntry.creneau),
        matchedInterventions,
        latestIntervention: matchedInterventions[0] || null,
        executionStatus,
        executionMeta: getMaintenancePlanningExecutionMeta(executionStatus),
        searchBlob: normalizeMaintenanceText(
          [
            planningEntry.date_planification,
            planningEntry.creneau,
            planningEntry.notes,
            planningEntry.region,
            planningEntry.agence_nom,
            technicienNom,
            technicien?.matricule,
            ...matchedInterventions.flatMap((intervention) => [
              intervention.commentaire,
              intervention.type_intervention,
              intervention.sous_ensemble,
            ]),
          ].join(' ')
        ),
      };
    })
  );

export const getMaintenancePlanningStats = (rows) => {
  const activeRows = (rows || []).filter((row) => row.executionStatus !== 'annulee');
  const completedCount = activeRows.filter((row) => row.executionStatus === 'effectuee').length;
  const missedCount = activeRows.filter((row) => row.executionStatus === 'non_effectuee').length;
  const plannedCount = activeRows.filter((row) => row.executionStatus === 'planifiee').length;
  const completionRate = activeRows.length === 0 ? 0 : Math.round((completedCount / activeRows.length) * 100);

  return {
    totalCount: activeRows.length,
    completedCount,
    missedCount,
    plannedCount,
    completionRate,
  };
};
