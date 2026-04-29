import { aggregateCountsByLabel, buildAnalyticsBuckets } from '@/lib/analytics';

export const normalizePointageText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const formatPointageDateTime = (value) => {
  if (!value) return 'N/A';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 'N/A' : parsedDate.toLocaleString('fr-FR');
};

export const getPointageStatusMeta = (count, expectedCount) => {
  if (expectedCount === 0) {
    return {
      label: 'Aucun planning',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (count === 0) {
    return {
      label: 'En attente',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  if (count < expectedCount) {
    return {
      label: 'En cours',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    };
  }

  return {
    label: 'Complet',
    className: 'border-green-200 bg-green-50 text-green-700',
  };
};

export const getPointageNonConformityCount = (actualCount, expectedCount) =>
  Math.max((Number(expectedCount) || 0) - (Number(actualCount) || 0), 0);

export const buildPointageAgencyRows = ({
  agences = [],
  planningEntries = [],
  pointages = [],
  guichetieresById = {},
  creneauxCount = 2,
}) =>
  agences.map((agence) => {
    const agencyPlanning = planningEntries.filter(
      (entry) => normalizePointageText(entry.agenceNom) === normalizePointageText(agence.nom)
    );
    const uniqueGuichetieres = Array.from(
      new Map(
        agencyPlanning.map((entry) => {
          const guichetiere = guichetieresById[String(entry.guichetiereId)] || null;
          const key = String(entry.guichetiereId || guichetiere?.matricule || entry.id);
          return [
            key,
            {
              ...entry,
              guichetiere,
            },
          ];
        })
      ).values()
    );

    const agencyPointages = pointages.filter(
      (pointage) => normalizePointageText(pointage.agence) === normalizePointageText(agence.nom)
    );
    const expectedCount = uniqueGuichetieres.length * creneauxCount;
    const completionRate = expectedCount === 0 ? 0 : Math.min(100, Math.round((agencyPointages.length / expectedCount) * 100));
    const latestPointage = [...agencyPointages].sort(
      (firstPointage, secondPointage) =>
        new Date(secondPointage.time || 0).getTime() - new Date(firstPointage.time || 0).getTime()
    )[0] || null;

    return {
      agenceId: String(agence.id),
      agenceNom: agence.nom,
      codePDV: agence.codePDV || 'N/A',
      regionNom: agence.region || 'N/A',
      plannedGuichetieres: uniqueGuichetieres,
      plannedCount: uniqueGuichetieres.length,
      pointagesCount: agencyPointages.length,
      expectedCount,
      completionRate,
      latestPointage,
      pointages: agencyPointages,
      nonConformityCount: getPointageNonConformityCount(agencyPointages.length, expectedCount),
      statusMeta: getPointageStatusMeta(agencyPointages.length, expectedCount),
      searchBlob: normalizePointageText(
        [
          agence.nom,
          agence.codePDV,
          agence.region,
          ...uniqueGuichetieres.map((entry) =>
            [entry.guichetiere?.matricule, entry.guichetiere?.prenom, entry.guichetiere?.nom].join(' ')
          ),
        ].join(' ')
      ),
    };
  });

export const buildPointageGuichetiereRows = ({
  planningEntries = [],
  pointages = [],
  guichetieresById = {},
  creneauxCount = 2,
}) =>
  Array.from(
    new Map(
      planningEntries.map((entry) => {
        const guichetiere = guichetieresById[String(entry.guichetiereId)] || null;
        return [
          String(entry.guichetiereId || entry.id),
          {
            ...entry,
            guichetiere,
          },
        ];
      })
    ).values()
  ).map((entry) => {
    const guichetierePointages = pointages.filter(
      (pointage) => normalizePointageText(pointage.guichetiereMatricule) === normalizePointageText(entry.guichetiere?.matricule)
    );
    const expectedCount = creneauxCount;
    const latestPointage = [...guichetierePointages].sort(
      (firstPointage, secondPointage) =>
        new Date(secondPointage.time || 0).getTime() - new Date(firstPointage.time || 0).getTime()
    )[0] || null;

    return {
      id: String(entry.guichetiereId || entry.id),
      guichetiereId: entry.guichetiereId,
      matricule: entry.guichetiere?.matricule || 'N/A',
      nomComplet: entry.guichetiere
        ? `${entry.guichetiere.prenom} ${entry.guichetiere.nom}`
        : 'Guichetière introuvable',
      pointagesCount: guichetierePointages.length,
      expectedCount,
      completionRate: expectedCount === 0 ? 0 : Math.min(100, Math.round((guichetierePointages.length / expectedCount) * 100)),
      latestPointage,
      nonConformityCount: getPointageNonConformityCount(guichetierePointages.length, expectedCount),
      statusMeta: getPointageStatusMeta(guichetierePointages.length, expectedCount),
      pointages: guichetierePointages,
      searchBlob: normalizePointageText(
        `${entry.guichetiere?.matricule || ''} ${entry.guichetiere?.prenom || ''} ${entry.guichetiere?.nom || ''}`
      ),
    };
  });

export const buildPointageDistributionData = (rows = [], getLabel) =>
  aggregateCountsByLabel(rows, getLabel, (row) => row.nonConformityCount || 0);

export const buildPointageTrendData = ({
  planningEntries = [],
  pointages = [],
  creneauxCount = 2,
  granularity = 'day',
  referenceDate = new Date(),
}) => {
  const buckets = buildAnalyticsBuckets(granularity, referenceDate);

  return buckets.map((bucket) => {
    const planningCount = planningEntries.filter((entry) => {
      const planningDate = new Date(`${entry.date}T00:00:00`);
      return !Number.isNaN(planningDate.getTime()) && planningDate >= bucket.start && planningDate <= bucket.end;
    }).length;

    const pointagesCount = pointages.filter((pointage) => {
      const pointageDate = new Date(`${pointage.date}T00:00:00`);
      return !Number.isNaN(pointageDate.getTime()) && pointageDate >= bucket.start && pointageDate <= bucket.end;
    }).length;

    return {
      label: bucket.label,
      value: getPointageNonConformityCount(pointagesCount, planningCount * creneauxCount),
    };
  });
};
