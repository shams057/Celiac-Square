import { db, unwrap } from '../config/db.js';
import { toAssociationProduct, toAtmcProduct } from '../models/mappers.js';
import { foldText } from '../utils/regex.js';
import { atmcToStatus } from './statusBadges.js';

/**
 * Matches text read from a product photo (OCR, done in the browser) against the
 * association products and the ATMC guide. OCR output is noisy, so words are
 * compared after folding accents and with one typo allowed on longer words.
 */

// Words that appear on every package and say nothing about which product it is
const STOPWORDS = new Set(
  (
    'les des une aux avec sans pour sur par dans est son ses que qui the and with for from ' +
    'net poids produit tunisie tunisia fabrique fabriqué conserver consommer avant date lot ' +
    'ingredients ingrédients gluten contient peut traces valeur energetique pour100g'
  )
    .split(' ')
    .map(foldText)
);

const tokenize = (text) =>
  foldText(text)
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

// One substitution, insertion or deletion
const withinOneEdit = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else {
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

// "(Boîte de conserve)", "(400g)": describes the packaging, rarely printed as such
const withoutParentheses = (text) => text.replace(/\([^)]*\)/g, ' ');

// Guide entries such as "Concentré de tomate : SICAM, BNINA, CAP BON" list alternatives after the colon:
// a package shows the head and one of them, so only the best-matching alternative is expected
const splitAlternatives = (name) => {
  const clean = withoutParentheses(name);
  const idx = clean.indexOf(':');
  if (idx < 0) return { nameTokens: tokenize(clean), alternatives: [] };
  return {
    nameTokens: tokenize(clean.slice(0, idx)),
    alternatives: clean
      .slice(idx + 1)
      .split(/[,;]/)
      .map(tokenize)
      .filter((t) => t.length),
  };
};

const tokenMatches = (word, ocrTokens) =>
  ocrTokens.has(word) || (word.length >= 5 && [...ocrTokens].some((t) => t.length >= 4 && withinOneEdit(word, t)));

// The catalogue is small (a few hundred rows): keep it in memory for a few minutes per instance
const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, entries: [] };

export const loadCatalogue = async () => {
  if (Date.now() - cache.at < CACHE_MS && cache.entries.length) return cache.entries;
  const [assoc, atmc] = await Promise.all([
    db().from('association_products').select('*'),
    db().from('atmc_products').select('*'),
  ]);
  const entries = [
    ...unwrap(assoc).map((row) => {
      const p = toAssociationProduct(row);
      return {
        // Short stable code for prompts (uuid prefix), and the guide section the entry belongs to
        code: `L${row.id.replace(/-/g, '').slice(0, 6)}`,
        shelf: p.category,
        name: p.productNameFr,
        brandTokens: tokenize(p.brand.includes('/') ? '' : p.brand),
        ...splitAlternatives(p.productNameFr),
        extraTokens: tokenize(`${p.productNameFr} ${(p.keywords || []).join(' ')}`),
        product: {
          source: 'Association Tunisienne de la Cœliaque',
          productNameFr: p.productNameFr,
          productNameAr: p.productNameAr,
          brand: p.brand,
          status: p.status,
          isGlutenFree: p.isGlutenFree,
          notes: p.notes,
          notesAr: p.notesAr,
          officialDocReference: p.officialDocReference,
        },
      };
    }),
    ...unwrap(atmc).map((row) => {
      const p = toAtmcProduct(row);
      const status = atmcToStatus(p.status);
      return {
        code: `A${row.id.replace(/-/g, '').slice(0, 6)}`,
        shelf: p.categoryFr,
        name: p.nameFr || p.name,
        brandTokens: tokenize(p.brand),
        ...splitAlternatives(p.nameFr || p.name),
        extraTokens: tokenize(`${p.nameFr} ${p.name}`),
        product: {
          source: 'Guide Officiel ATMC 2023',
          productNameFr: p.nameFr || p.name,
          productNameAr: p.name !== p.nameFr ? p.name : '',
          brand: p.brand,
          status,
          isGlutenFree: status === 'SAFE',
          notes: `${p.statusLabelFr}. Rayon : ${p.categoryFr}.`,
          notesAr: `${p.statusLabelAr}. ${p.categoryAr}`,
          officialDocReference: p.source,
        },
      };
    }),
  ];
  cache = { at: Date.now(), entries };
  return entries;
};

/**
 * Returns the best matches for OCR text, best first, each with a 0–1 confidence:
 * how much of the product's name was found on the package, boosted when its brand was found too.
 */
export const matchProductsFromText = async (text, limit = 3) => {
  const ocrTokens = new Set(tokenize(text));
  if (ocrTokens.size === 0) return { tokens: [], matches: [] };

  const scored = [];
  for (const entry of await loadCatalogue()) {
    const weight = (w) => Math.min(w.length, 8);
    const sum = (words) => words.reduce((s, w) => s + weight(w), 0);
    const nameWords = [...new Set(entry.nameTokens)];

    // The alternative listed after ":" that is best represented on the package
    let alt = { words: [], found: [] };
    for (const words of entry.alternatives) {
      const found = words.filter((w) => tokenMatches(w, ocrTokens));
      if (sum(found) > sum(alt.found) || (!alt.words.length && words.length)) alt = { words, found };
    }

    // Something from the name itself must be on the package; keywords and packaging details count half
    const required = [...nameWords.filter((w) => tokenMatches(w, ocrTokens)), ...alt.found];
    if (required.length === 0) continue;
    const counted = new Set([...nameWords, ...alt.words]);
    const extra = [...new Set(entry.extraTokens)].filter((w) => !counted.has(w) && tokenMatches(w, ocrTokens));
    const total = sum(nameWords) + sum(alt.words) || 1;
    const matchedWeight = sum(required) + sum(extra) / 2;
    const coverage = Math.min(1, matchedWeight / total);
    const brandFound = entry.brandTokens.length > 0 && entry.brandTokens.some((w) => tokenMatches(w, ocrTokens));
    let confidence = Math.min(1, coverage * (brandFound ? 1 : 0.75) + (brandFound ? 0.15 : 0));
    // One short word ("Blé", "Thé") also appears in countless ingredient lists: not enough to name the product
    if (matchedWeight < 8 && !brandFound) confidence *= 0.6;
    scored.push({ name: entry.name, product: entry.product, confidence, found: matchedWeight });
  }

  scored.sort((a, b) => b.confidence - a.confidence || b.found - a.found);
  const seen = new Set();
  const matches = scored.filter((m) => !seen.has(m.name) && seen.add(m.name)).slice(0, limit);
  return { tokens: [...ocrTokens], matches };
};
