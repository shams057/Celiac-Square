/**
 * Lowercase and strip accents the same way the database's search_text columns do
 * (public.f_unaccent(lower(...))), so "delice" matches "Délice" and "coeliaque" matches "cœliaque".
 */
export const foldText = (str) =>
  String(str)
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * ILIKE "contains" pattern for search_text columns, built from untrusted input:
 * LIKE wildcards are escaped and PostgREST's `*` wildcard is dropped.
 */
export const containsPattern = (str) => `%${foldText(str).replace(/\*/g, '').replace(/[\\%_]/g, '\\$&')}%`;

/** ILIKE pattern that matches the whole value, ignoring case (e.g. a city name) */
export const exactPattern = (str) => String(str).replace(/\*/g, '').replace(/[\\%_]/g, '\\$&');
