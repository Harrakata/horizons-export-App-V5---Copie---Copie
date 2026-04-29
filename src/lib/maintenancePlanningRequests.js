import { isMissingSupabaseTableError } from '@/lib/guichetiereSpace';

export const MAINTENANCE_REQUEST_STATUSES = {
  PENDING_CHEF: "En attente chef d'agence",
  PENDING_EXPLOITATION: 'En attente exploitation',
  APPROVED: 'Approuvée',
  REFUSED_CHEF: "Refusée par le chef d'agence",
  REFUSED_EXPLOITATION: "Refusée par l'exploitation",
  CANCELLED: 'Annulée',
};

export const MAINTENANCE_REQUEST_TYPES = {
  UNAVAILABILITY: 'indisponibilite',
  DATE_CHANGE: 'changement_date',
};

export const getMaintenancePlanningRequestTypeLabel = (value) => {
  if (value === MAINTENANCE_REQUEST_TYPES.UNAVAILABILITY) return 'Indisponibilité';
  if (value === MAINTENANCE_REQUEST_TYPES.DATE_CHANGE) return 'Changement de date';
  return value || 'N/A';
};

export const getMaintenancePlanningRequestStatusBadgeClass = (status) => {
  if (status === MAINTENANCE_REQUEST_STATUSES.APPROVED) {
    return 'border-green-200 bg-green-50 text-green-700';
  }

  if (
    status === MAINTENANCE_REQUEST_STATUSES.REFUSED_CHEF ||
    status === MAINTENANCE_REQUEST_STATUSES.REFUSED_EXPLOITATION
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (status === MAINTENANCE_REQUEST_STATUSES.CANCELLED) {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }

  if (status === MAINTENANCE_REQUEST_STATUSES.PENDING_EXPLOITATION) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
};

export const isMissingMaintenancePlanningRequestTableError = (error) =>
  isMissingSupabaseTableError(error, 'planning_maintenance_modification_requests');
