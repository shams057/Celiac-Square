/**
 * Escape user input so it is matched literally inside a RegExp
 */
export const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Each base letter also matches its accented forms, so "delice" finds "Délice"
const ACCENTS = {
  a: 'aàâäá',
  c: 'cç',
  e: 'eéèêë',
  i: 'iîïí',
  o: 'oôöó',
  u: 'uùûüú',
  y: 'yÿ',
};

const foldAccents = (escaped) =>
  escaped.replace(/[a-zàâäáçéèêëîïíôöóùûüúÿ]/gi, (ch) => {
    const base = ch
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return ACCENTS[base] ? `[${ACCENTS[base]}]` : ch;
  });

/**
 * Case- and accent-insensitive "contains" RegExp built from untrusted user input
 */
export const containsRegex = (str) => new RegExp(foldAccents(escapeRegExp(str)), 'i');
