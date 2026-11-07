import { foldText } from '../utils/regex.js';

/**
 * Gluten verdict for a packaged product from its Open Food Facts data
 * (allergen tags, traces, labels and the ingredients text).
 *
 * Rules, in order:
 *   1. A gluten cereal in the allergens or the ingredients      -> UNSAFE
 *   2. A gluten cereal in the traces ("peut contenir…")          -> CROSS_CONTAMINATION_RISK
 *   3. A gluten-free label on Open Food Facts (and nothing above) -> SAFE, worded "labelled", not "certified"
 *   4. An ambiguous ingredient ("farine", "amidon" with no cereal) -> WARNING
 *   5. Ingredients listed, nothing found                         -> WARNING (never SAFE: OFF data can be
 *                                                                   incomplete or out of date)
 *   6. No ingredients at all                                     -> UNKNOWN
 *
 * Text is accent-folded and matched on whole words with Unicode-aware boundaries:
 * JavaScript's \b only knows ASCII, so /\bblé\b/ never matched "farine de blé,".
 */

// Gluten sources, accent-folded (French, English, Arabic). Multi-word terms are allowed.
const GLUTEN_TERMS = [
  // French
  'ble', 'bles', 'froment', 'epeautre', 'kamut', 'orge', 'seigle', 'avoine', 'triticale', 'malt', 'malte',
  'semoule', 'semoules', 'couscous', 'boulgour', 'chapelure', 'gluten', 'seitan', 'frik', 'freekeh',
  'levure de biere', 'son de ble', 'germe de ble',
  // English
  'wheat', 'barley', 'rye', 'oat', 'oats', 'spelt', 'semolina', 'durum', 'bulgur', 'breadcrumbs',
  'brewers yeast', "brewer's yeast", 'farro', 'einkorn', 'emmer',
  // Arabic
  'قمح', 'القمح', 'شعير', 'الشعير', 'شوفان', 'الشوفان', 'سميد', 'السميد', 'غلوتين', 'الغلوتين', 'جلوتين',
  'الجلوتين', 'برغل', 'البرغل', 'كسكسي', 'الكسكسي', 'شيلم', 'الشيلم', 'مالت', 'المالت',
].map(foldText);

// Ingredients that are made from wheat but are gluten-free under EU rules (Regulation 1169/2011, Annex II)
const EXEMPT_PHRASES = [
  /sirops? de glucose(?: de (?:ble|froment))?/g,
  /glucose(?:-fructose)? syrups?(?: \(?(?:from )?wheat\)?)?/g,
  /dextrose(?: de (?:ble|froment))?/g,
  /maltodextrines?(?: de (?:ble|froment))?/g,
  /wheat (?:based )?(?:maltodextrin|dextrose|glucose syrup)/g,
];

// Claims that mention gluten without meaning it is present
const GLUTEN_FREE_PHRASES = [/sans gluten/g, /gluten[- ]free/g, /no gluten/g, /خال(?:ي|ٍ)? من (?:ال)?(?:غلوتين|جلوتين)/g, /بدون (?:ال)?(?:غلوتين|جلوتين)/g];

// Where the traces statement starts; it runs to the end of the sentence
const TRACES_RE =
  /(peut contenir|peuvent contenir|traces? (?:eventuelles? |possibles? )?(?:de |d')|contient des traces|fabrique dans un (?:atelier|site) qui|may contain|traces? of|produced in a factory|قد يحتوي|آثار)/g;

// "farine", "amidon", "flour", "starch" are gluten-free only when the cereal is named and safe
const AMBIGUOUS_RE = /(farines?|amidons?|flours?|starch(?:es)?|دقيق|نشا)/g;
const SAFE_SOURCES = [
  'riz', 'mais', 'sarrasin', 'pois chiche', 'pois chiches', 'manioc', 'pomme de terre', 'pommes de terre', 'tapioca',
  'soja', 'chataigne', 'chataignes', 'quinoa', 'millet', 'sorgho', 'teff', 'amande', 'amandes', 'coco', 'lupin',
  'lentille', 'lentilles', 'fecule', 'banane', 'caroube', 'rice', 'corn', 'maize', 'potato', 'cassava', 'buckwheat',
  'chickpea', 'almond', 'coconut', 'sorghum', 'pea', 'الأرز', 'أرز', 'الذرة', 'ذرة', 'البطاطا',
].map(foldText);

const LETTER = '[\\p{L}\\p{N}]';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Arabic words take attached prefixes (و، ب، ل، ف), so they match as a suffix of the word too
const isArabic = (term) => /[؀-ۿ]/.test(term);
const termRe = (term) =>
  new RegExp(`${isArabic(term) ? '' : `(?<!${LETTER})`}${escapeRe(term).replace(/ /g, '[\\s-]+')}(?!${LETTER})`, 'u');
const GLUTEN_RES = GLUTEN_TERMS.map((term) => [term, termRe(term)]);
const SAFE_RES = SAFE_SOURCES.map(termRe);

/** Gluten terms found in already folded text, as written in GLUTEN_TERMS */
export const findGlutenTerms = (folded) => {
  let text = folded;
  for (const re of [...EXEMPT_PHRASES, ...GLUTEN_FREE_PHRASES]) text = text.replace(re, ' ');
  return [...new Set(GLUTEN_RES.filter(([, re]) => re.test(text)).map(([term]) => term))];
};

/** Splits folded ingredients text into { main, traces } */
export const splitTraces = (folded) => {
  const traces = [];
  const main = folded.replace(new RegExp(`${TRACES_RE.source}[^.;\\n]*`, 'g'), (segment) => {
    traces.push(segment);
    return ' ';
  });
  return { main, traces: traces.join(' ') };
};

/** "farine" / "amidon" (or flour/starch) with no safe cereal named next to it */
export const hasAmbiguousIngredient = (folded) => {
  for (const match of folded.matchAll(AMBIGUOUS_RE)) {
    const around = folded.slice(Math.max(0, match.index - 30), match.index + match[0].length + 40);
    if (!SAFE_RES.some((re) => re.test(around))) return match[0];
  }
  return null;
};

const tagTerms = (tags) =>
  (tags || [])
    .filter((t) => typeof t === 'string')
    .map((t) => foldText(t.includes(':') ? t.slice(t.indexOf(':') + 1) : t).replace(/-/g, ' '));

const CERTIFIED_LABELS = ['gluten free', 'sans gluten', 'no gluten', 'crossed grain symbol', 'certified gluten free'];
const isCertified = (labels) => tagTerms(labels).some((l) => CERTIFIED_LABELS.some((c) => l === c || l.startsWith(`${c} `) || l.includes('crossed grain')));

const RESULTS = {
  UNSAFE: (found) => ({
    status: 'UNSAFE',
    isGlutenFree: false,
    badgeText: 'Contient du gluten',
    badgeTextAr: 'يحتوي على الغلوتين',
    reason: `Gluten ou céréale contenant du gluten dans la composition${found.length ? ` (${found.slice(0, 4).join(', ')})` : ''}.`,
    reasonAr: 'يحتوي على الغلوتين أو على حبوب تحتوي على الغلوتين.',
  }),
  CROSS: () => ({
    status: 'CROSS_CONTAMINATION_RISK',
    isGlutenFree: false,
    badgeText: 'Risque de contamination croisée',
    badgeTextAr: 'خطر التلوث المتبادل',
    reason: 'Traces possibles de gluten mentionnées par le fabricant (lignes de production partagées).',
    reasonAr: 'احتمال وجود آثار غلوتين حسب بيانات المصنع (خطوط إنتاج مشتركة).',
  }),
  CERTIFIED: () => ({
    status: 'SAFE',
    isGlutenFree: true,
    // The label comes from Open Food Facts' volunteer tags, not from a certification body we checked
    badgeText: 'Étiqueté sans gluten',
    badgeTextAr: 'مُعلَّم بدون غلوتين',
    reason: 'Sur Open Food Facts, ce produit est indiqué comme portant la mention « sans gluten » (information saisie par des bénévoles). Vérifiez que la mention ou le logo figure bien sur votre emballage.',
    reasonAr: 'حسب Open Food Facts يحمل هذا المنتج عبارة «بدون غلوتين» (معلومة أدخلها متطوعون). تأكد من وجود العبارة أو الشعار على علبتك.',
  }),
  AMBIGUOUS: (word) => ({
    status: 'WARNING',
    isGlutenFree: false,
    badgeText: 'À vérifier',
    badgeTextAr: 'للتثبت',
    reason: `« ${word} » sans précision de la céréale : il peut s’agir de blé. Vérifiez l’emballage.`,
    reasonAr: 'مكوّن غير محدد المصدر (دقيق أو نشا) قد يكون من القمح. تحقق من العلبة.',
  }),
  NOT_DETECTED: () => ({
    status: 'WARNING',
    isGlutenFree: false,
    badgeText: 'Gluten non détecté — à vérifier',
    badgeTextAr: 'لم يُكتشف الغلوتين — للتثبت',
    reason: 'Aucun ingrédient contenant du gluten n’a été trouvé dans les données Open Food Facts, qui peuvent être incomplètes. Lisez toujours l’étiquette.',
    reasonAr: 'لم يُعثر على مكونات تحتوي على الغلوتين في بيانات Open Food Facts وقد تكون ناقصة. اقرأ الملصق دائما.',
  }),
  UNKNOWN: () => ({
    status: 'UNKNOWN',
    isGlutenFree: false,
    badgeText: 'Inconnu / données incomplètes',
    badgeTextAr: 'بيانات غير متوفرة',
    reason: 'Informations d’ingrédients insuffisantes sur Open Food Facts pour ce produit.',
    reasonAr: 'المعلومات غير كافية لتحديد وجود الغلوتين بدقة.',
  }),
};

/** The ingredients text OFF holds for a product, in the first language available */
export const ingredientsTextOf = (product) =>
  product.ingredients_text_fr || product.ingredients_text || product.ingredients_text_en || product.ingredients_text_ar || '';

export const analyzeGlutenSafety = (product = {}) => {
  const folded = foldText(ingredientsTextOf(product));
  const { main, traces } = splitTraces(folded);

  const allergenTerms = findGlutenTerms(tagTerms([...(product.allergens_hierarchy || []), ...(product.allergens_tags || [])]).join(' , '));
  const ingredientTerms = findGlutenTerms(main);
  const found = [...new Set([...ingredientTerms, ...allergenTerms])];
  if (found.length) return RESULTS.UNSAFE(found);

  const traceTerms = findGlutenTerms(`${traces} , ${tagTerms([...(product.traces_hierarchy || []), ...(product.traces_tags || [])]).join(' , ')}`);
  if (traceTerms.length) return RESULTS.CROSS();

  if (isCertified(product.labels_tags)) return RESULTS.CERTIFIED();

  const ambiguous = hasAmbiguousIngredient(main);
  if (ambiguous) return RESULTS.AMBIGUOUS(ambiguous);

  const hasIngredients = main.trim().length > 5 || (Array.isArray(product.ingredients) && product.ingredients.length > 0);
  return hasIngredients ? RESULTS.NOT_DETECTED() : RESULTS.UNKNOWN();
};
