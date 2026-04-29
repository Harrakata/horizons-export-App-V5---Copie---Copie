import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export const ANALYTICS_GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

const DAY_BUCKETS_COUNT = 14;
const WEEK_BUCKETS_COUNT = 12;
const MONTH_BUCKETS_COUNT = 12;

export const buildAnalyticsBuckets = (granularity = 'day', referenceDate = new Date()) => {
  const safeReferenceDate =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());

  if (Number.isNaN(safeReferenceDate.getTime())) return [];

  if (granularity === 'month') {
    return Array.from({ length: MONTH_BUCKETS_COUNT }, (_, index) => {
      const monthDate = subMonths(safeReferenceDate, MONTH_BUCKETS_COUNT - index - 1);
      return {
        key: format(monthDate, 'yyyy-MM'),
        label: format(monthDate, 'MMM yyyy', { locale: fr }),
        start: startOfMonth(monthDate),
        end: endOfMonth(monthDate),
      };
    });
  }

  if (granularity === 'week') {
    return Array.from({ length: WEEK_BUCKETS_COUNT }, (_, index) => {
      const weekDate = subWeeks(safeReferenceDate, WEEK_BUCKETS_COUNT - index - 1);
      const start = startOfWeek(weekDate, { weekStartsOn: 1 });
      const end = endOfWeek(weekDate, { weekStartsOn: 1 });

      return {
        key: format(start, 'yyyy-MM-dd'),
        label: `${format(start, 'dd MMM', { locale: fr })} - ${format(end, 'dd MMM', { locale: fr })}`,
        start,
        end,
      };
    });
  }

  return Array.from({ length: DAY_BUCKETS_COUNT }, (_, index) => {
    const dayDate = addDays(subDays(safeReferenceDate, DAY_BUCKETS_COUNT - 1), index);

    return {
      key: format(dayDate, 'yyyy-MM-dd'),
      label: format(dayDate, 'dd MMM', { locale: fr }),
      start: startOfDay(dayDate),
      end: endOfDay(dayDate),
    };
  });
};

export const aggregateCountsByLabel = (items, getLabel, getValue = () => 1) => {
  const totalsByLabel = items.reduce((accumulator, item) => {
    const label = getLabel(item);
    const value = Number(getValue(item)) || 0;

    if (!label || value <= 0) return accumulator;

    accumulator[label] = (accumulator[label] || 0) + value;
    return accumulator;
  }, {});

  return Object.entries(totalsByLabel)
    .map(([label, value]) => ({ label, value }))
    .sort((firstEntry, secondEntry) => secondEntry.value - firstEntry.value);
};
