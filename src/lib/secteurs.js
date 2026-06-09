import { supabase } from '@/lib/supabaseClient';

export const normalizeSecteurText = (value) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const secteurMatchesValue = (secteur, value) => {
  const normalizedValue = normalizeSecteurText(value);
  return (
    normalizeSecteurText(secteur?.nom) === normalizedValue ||
    normalizeSecteurText(secteur?.codeSecteur) === normalizedValue
  );
};

export const fetchSecteurs = async () =>
  supabase.from('secteurs').select('*').order('nom', { ascending: true });

/**
 * Options de secteurs, optionnellement filtrées par région.
 */
export const buildSecteurOptions = (
  secteurs,
  { region = null, includeAllLabel = null, allValue = '__all__' } = {}
) => {
  const filtered = (secteurs || [])
    .filter((s) => s?.nom)
    .filter((s) => !region || normalizeSecteurText(s.region) === normalizeSecteurText(region))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  const options = Array.from(
    new Map(
      filtered.map((s) => [
        normalizeSecteurText(s.nom),
        { value: s.nom, label: s.codeSecteur ? `${s.codeSecteur} • ${s.nom}` : s.nom },
      ])
    ).values()
  );

  return includeAllLabel ? [{ value: allValue, label: includeAllLabel }, ...options] : options;
};

export const isKnownSecteur = (secteurs, secteurName) =>
  (secteurs || []).some((s) => secteurMatchesValue(s, secteurName));

export const resolveSecteurName = (secteurs, value) =>
  (secteurs || []).find((s) => secteurMatchesValue(s, value))?.nom || '';

/**
 * Renvoie le nom de la région à laquelle appartient un secteur.
 */
export const getSecteurRegion = (secteurs, secteurValue) =>
  (secteurs || []).find((s) => secteurMatchesValue(s, secteurValue))?.region || '';
