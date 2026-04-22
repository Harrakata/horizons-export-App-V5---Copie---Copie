import { supabase } from '@/lib/supabaseClient';

export const normalizeRegionText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const regionMatchesValue = (region, value) => {
  const normalizedValue = normalizeRegionText(value);

  return (
    normalizeRegionText(region?.nom) === normalizedValue ||
    normalizeRegionText(region?.codeRegion) === normalizedValue
  );
};

export const fetchRegions = async ({ activeOnly = false } = {}) => {
  return supabase.from('regions').select('*').order('nom', { ascending: true });
};

export const buildRegionOptions = (
  regions,
  {
    includeAllLabel = null,
    allValue = '__all__',
    activeOnly = false,
    currentValue = '',
  } = {}
) => {
  const filteredRegions = (regions || [])
    .filter((region) => region?.nom)
    .sort((firstRegion, secondRegion) => firstRegion.nom.localeCompare(secondRegion.nom));

  const options = Array.from(
    new Map(
      filteredRegions.map((region) => [
        normalizeRegionText(region.nom),
        {
          value: region.nom,
          label: region.codeRegion ? `${region.codeRegion} • ${region.nom}` : region.nom,
        },
      ])
    ).values()
  );

  return includeAllLabel
    ? [{ value: allValue, label: includeAllLabel }, ...options]
    : options;
};

export const isKnownRegion = (regions, regionName) =>
  (regions || []).some((region) => regionMatchesValue(region, regionName));

export const resolveRegionName = (regions, value) =>
  (regions || []).find((region) => regionMatchesValue(region, value))?.nom || '';
