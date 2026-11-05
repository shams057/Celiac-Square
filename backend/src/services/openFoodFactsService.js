import crypto from 'crypto';
import axios from 'axios';
import { analyzeGlutenSafety } from './glutenAnalysis.js';

export { analyzeGlutenSafety };

const OFF_BASE_URL = 'https://world.openfoodfacts.org';
// Open Food Facts asks for "AppName/Version (contact)"; set OFF_USER_AGENT in .env to add your contact
const offUserAgent = () => process.env.OFF_USER_AGENT || 'CeliacSquare/1.0 (Tunisia celiac platform)';

/** EAN-8, UPC-A, EAN-13 and GTIN-14 barcodes, digits only */
export const isBarcode = (value) => /^\d{8,14}$/.test(String(value));

// Products without a barcode still need an id that stays the same between searches (React keys)
const stableId = (p) =>
  p.code ? `off_${p.code}` : `off_${crypto.createHash('sha1').update(`${p.product_name || ''}|${p.brands || ''}`).digest('hex').slice(0, 16)}`;

const toProduct = (p, fallbackBarcode = '') => {
  const safety = analyzeGlutenSafety(p);
  return {
    id: stableId(p),
    source: 'Open Food Facts',
    productNameFr: p.product_name_fr || p.product_name || 'Produit sans nom',
    productNameAr: p.product_name_ar || '',
    brand: p.brands || 'Marque non spécifiée',
    category: 'PROCESSED',
    barcode: p.code || fallbackBarcode,
    isGlutenFree: safety.isGlutenFree,
    status: safety.status,
    badgeText: safety.badgeText,
    badgeTextAr: safety.badgeTextAr,
    notes: safety.reason,
    notesAr: safety.reasonAr,
    imageUrl: p.image_url || p.image_front_small_url || '',
    ingredientsText: p.ingredients_text_fr || p.ingredients_text || '',
    officialDocReference: 'Base internationale Open Food Facts',
  };
};

/**
 * Fetch product by barcode from Open Food Facts
 */
export const fetchFromOpenFoodFactsByBarcode = async (barcode) => {
  if (!isBarcode(barcode)) return null;
  try {
    const response = await axios.get(`${OFF_BASE_URL}/api/v2/product/${barcode}.json`, {
      timeout: 4500,
      headers: { 'User-Agent': offUserAgent() },
    });
    if (response.data?.status === 1 && response.data.product) return toProduct(response.data.product, barcode);
    return null;
  } catch (err) {
    console.warn(`[OpenFoodFacts] Barcode fetch notice: ${err.message}`);
    return null;
  }
};

// Open Food Facts rate-limits its search API (a few requests per minute) and answers 503
// when exceeded, so answers are cached and failures are reported instead of looking like "no result".
const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map();

/**
 * Search Open Food Facts by text. Returns { ok, products }: ok is false when the
 * service could not be reached or refused the request (rate limit, outage).
 */
export const searchOpenFoodFacts = async (query) => {
  const term = (query || '').trim().toLowerCase().slice(0, 100);
  if (term.length < 2) return { ok: true, products: [] };

  const cached = searchCache.get(term);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return { ok: true, products: cached.products };

  try {
    const url = `${OFF_BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=8`;
    const response = await axios.get(url, { timeout: 4500, headers: { 'User-Agent': offUserAgent() } });
    const products = Array.isArray(response.data?.products)
      ? response.data.products.filter((p) => p.product_name || p.product_name_fr).map((p) => toProduct(p))
      : [];
    searchCache.set(term, { at: Date.now(), products });
    if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value);
    return { ok: true, products };
  } catch (err) {
    console.warn(`[OpenFoodFacts] Search notice: ${err.message}`);
    return { ok: false, products: [] };
  }
};
