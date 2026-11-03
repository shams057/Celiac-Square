import axios from 'axios';

const OFF_BASE_URL = 'https://world.openfoodfacts.org';
// Open Food Facts asks for "AppName/Version (contact)"; set OFF_USER_AGENT in .env to add your contact
const offUserAgent = () => process.env.OFF_USER_AGENT || 'CeliacSquare/1.0 (Tunisia celiac platform)';

/**
 * Analyzes Open Food Facts product data for gluten presence
 */
export const analyzeGlutenSafety = (product) => {
  const allergensHierarchy = product.allergens_hierarchy || [];
  const allergensTags = product.allergens_tags || [];
  const tracesTags = product.traces_tags || [];
  const tracesHierarchy = product.traces_hierarchy || [];
  const labelsTags = product.labels_tags || [];
  const ingredientsText = (product.ingredients_text || product.ingredients_text_fr || product.ingredients_text_en || '').toLowerCase();

  const allAllergens = [...allergensHierarchy, ...allergensTags].map((t) => t.toLowerCase());
  const allTraces = [...tracesHierarchy, ...tracesTags].map((t) => t.toLowerCase());
  const allLabels = labelsTags.map((l) => l.toLowerCase());

  const glutenAllergens = ['en:gluten', 'gluten', 'en:wheat', 'blé', 'orge', 'seigle', 'avoine', 'kamut', 'spelt', 'épeautre'];
  const glutenCertifications = ['en:gluten-free', 'fr:sans-gluten', 'en:crossed-grain-symbol', 'en:no-gluten', 'sans-gluten'];

  const hasGlutenCertification = allLabels.some((l) =>
    glutenCertifications.some((cert) => l.includes(cert))
  );

  const containsGlutenAllergen = allAllergens.some((a) =>
    glutenAllergens.some((g) => a.includes(g))
  );

  const tracesGluten = allTraces.some((t) =>
    glutenAllergens.some((g) => t.includes(g))
  );

  const ingredientsContainGluten = glutenAllergens.some((g) => {
    // Basic word boundary search
    const regex = new RegExp(`\\b${g}\\b`, 'i');
    return regex.test(ingredientsText);
  });

  if (hasGlutenCertification) {
    return {
      status: 'SAFE',
      isGlutenFree: true,
      badgeText: 'Certifié Sans Gluten',
      badgeTextAr: 'معتمد خالٍ من الغلوتين',
      reason: 'Produit portant un label ou certification officielle sans gluten.',
      reasonAr: 'المنتج يحمل علامة أو شهادة رسمية خالية من الغلوتين.',
    };
  }

  if (containsGlutenAllergen || ingredientsContainGluten) {
    return {
      status: 'UNSAFE',
      isGlutenFree: false,
      badgeText: 'Contient du Gluten',
      badgeTextAr: 'يحتوي على الغلوتين',
      reason: 'Présence avérée de gluten ou de céréales contenant du gluten dans la liste des ingrédients.',
      reasonAr: 'يحتوي على الغلوتين أو الحبوب المحتوية على الغلوتين في المكونات.',
    };
  }

  if (tracesGluten || ingredientsText.includes('traces de gluten') || ingredientsText.includes('traces de blé')) {
    return {
      status: 'CROSS_CONTAMINATION_RISK',
      isGlutenFree: false,
      badgeText: 'Risque de Contamination Croisée',
      badgeTextAr: 'خطر التلوث المتبادل',
      reason: "Traces possibles de gluten mentionnées par le fabricant (lignes de production partagées).",
      reasonAr: 'احتمال وجود آثار غلوتين حسب بيانات المصنع (خطوط إنتاج مشتركة).',
    };
  }

  // If no gluten found and ingredients exist
  if (ingredientsText.length > 5 || (product.ingredients && product.ingredients.length > 0)) {
    return {
      status: 'SAFE',
      isGlutenFree: true,
      badgeText: 'Gluten Non Détecté (Vérifier)',
      badgeTextAr: 'غير مذكور غلوتين (يرجى التحقق)',
      reason: "Aucun ingrédient contenant du gluten n'a été répertorié dans les données Open Food Facts. Vérifiez toujours l'emballage physique.",
      reasonAr: 'لم يتم العثور على أي مكونات غلوتين مسجلة. يُنصح دائمًا بالتحقق من الغلاف الأصلي.',
    };
  }

  return {
    status: 'UNKNOWN',
    isGlutenFree: false,
    badgeText: 'Inconnu / Données Incomplètes',
    badgeTextAr: 'بيانات غير متوفرة',
    reason: "Informations d'ingrédients insuffisantes sur Open Food Facts pour ce produit.",
    reasonAr: 'المعلومات غير كافية لتحديد وجود الغلوتين بدقة.',
  };
};

/**
 * Fetch product by barcode from Open Food Facts
 */
export const fetchFromOpenFoodFactsByBarcode = async (barcode) => {
  try {
    const url = `${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const response = await axios.get(url, {
      timeout: 4500,
      headers: {
        'User-Agent': offUserAgent(),
      },
    });

    if (response.data && response.data.status === 1 && response.data.product) {
      const p = response.data.product;
      const safety = analyzeGlutenSafety(p);
      return {
        id: `off_${p.code || barcode}`,
        source: 'Open Food Facts',
        productNameFr: p.product_name_fr || p.product_name || 'Produit sans nom',
        productNameAr: p.product_name_ar || p.product_name || '',
        brand: p.brands || 'Marque non spécifiée',
        category: p.categories || 'PROCESSED',
        barcode: p.code || barcode,
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
    }
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

const mapSearchProducts = (products) =>
  products
    .filter((p) => p.product_name || p.product_name_fr)
    .map((p) => {
      const safety = analyzeGlutenSafety(p);
      return {
        id: `off_${p.code || Math.random()}`,
        source: 'Open Food Facts',
        productNameFr: p.product_name_fr || p.product_name || 'Produit',
        productNameAr: p.product_name_ar || '',
        brand: p.brands || 'Marque inconnue',
        category: 'PROCESSED',
        barcode: p.code || '',
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
    });

/**
 * Search Open Food Facts by text. Returns { ok, products }: ok is false when the
 * service could not be reached or refused the request (rate limit, outage).
 */
export const searchOpenFoodFacts = async (query) => {
  const term = (query || '').trim().toLowerCase();
  if (term.length < 2) return { ok: true, products: [] };

  const cached = searchCache.get(term);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return { ok: true, products: cached.products };

  try {
    const url = `${OFF_BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=8`;
    const response = await axios.get(url, {
      timeout: 4500,
      headers: { 'User-Agent': offUserAgent() },
    });
    const products = Array.isArray(response.data?.products) ? mapSearchProducts(response.data.products) : [];
    searchCache.set(term, { at: Date.now(), products });
    if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value);
    return { ok: true, products };
  } catch (err) {
    console.warn(`[OpenFoodFacts] Search notice: ${err.message}`);
    return { ok: false, products: [] };
  }
};

/**
 * Search products by query term in Open Food Facts (products only)
 */
export const searchOpenFoodFactsByQuery = async (query) => (await searchOpenFoodFacts(query)).products;
