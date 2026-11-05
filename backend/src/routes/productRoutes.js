import { db, unwrap } from '../config/db.js';
import { toAssociationProduct, toAtmcProduct } from '../models/mappers.js';
import { containsPattern } from '../utils/regex.js';
import { asyncRouter, clean } from '../utils/http.js';
import { limits } from '../middleware/rateLimit.js';
import { associationBadge, atmcToStatus } from '../services/statusBadges.js';
import { cached } from '../services/cache.js';
import { fetchFromOpenFoodFactsByBarcode, searchOpenFoodFacts, isBarcode } from '../services/openFoodFactsService.js';

const router = asyncRouter();

// Every product route may call Open Food Facts, which rate-limits our server's IP
router.use(limits.productSearch);

const ASSOCIATION_SOURCE = 'Association Tunisienne de la Cœliaque';

const fromAssociation = (p) => {
  const [badgeText, badgeTextAr] = associationBadge(p.status);
  return {
    id: p._id,
    source: ASSOCIATION_SOURCE,
    productNameFr: p.productNameFr,
    productNameAr: p.productNameAr,
    brand: p.brand,
    category: p.category,
    isGlutenFree: p.isGlutenFree,
    status: p.status,
    badgeText,
    badgeTextAr,
    barcode: p.barcode,
    notes: p.notes,
    notesAr: p.notesAr,
    officialDocReference: p.officialDocReference,
    imageUrl: null,
  };
};

const fromAtmc = (item) => {
  const status = atmcToStatus(item.status);
  return {
    id: item._id,
    source: 'Guide Officiel ATMC 2023',
    productNameFr: item.nameFr || item.name,
    productNameAr: item.categoryAr,
    brand: item.brand || 'Produit Répertorié ATMC',
    category: item.categoryFr,
    isGlutenFree: status === 'SAFE',
    status,
    badgeText: item.statusLabelFr,
    badgeTextAr: item.statusLabelAr,
    barcode: '',
    notes: item.rawText,
    notesAr: item.categoryAr,
    officialDocReference: item.source,
    imageUrl: null,
  };
};

/**
 * GET /api/products/search?q=&sources=all|local|off
 * Name, brand or barcode. Layer B: the Tunisian guides (association products and ATMC 2023).
 * Layer A: Open Food Facts.
 */
router.get('/search', async (req, res) => {
  const query = clean(req.query.q).slice(0, 100);
  // sources=local answers from the database only (fast); sources=off queries Open Food Facts only
  const sources = clean(req.query.sources).toLowerCase() || 'all';
  const wantLocal = sources !== 'off';
  const wantOff = sources !== 'local';

  if (!query) {
    if (!wantLocal) return res.json({ success: true, layerA: [], layerB: [], combined: [], totalCount: 0 });
    // Featured association staples
    const featured = await cached('products:featured', 5 * 60 * 1000, async () =>
      unwrap(await db().from('association_products').select('*').order('created_at').limit(20)).map(toAssociationProduct)
    );
    const layerB = featured.map(fromAssociation);
    return res.json({ success: true, layerA: [], layerB, combined: layerB, totalCount: layerB.length });
  }

  const barcode = isBarcode(query);
  let layerB = [];
  let layerA = [];
  let offStatus = wantOff ? 'ok' : 'skipped';

  if (wantLocal) {
    // A barcode is digits only (checked above), so it is safe inside the or() filter
    const assocQuery = db().from('association_products').select('*').limit(15);
    const [assoc, atmc] = await Promise.all([
      barcode
        ? assocQuery.or(`barcode.eq.${query},search_text.ilike.${containsPattern(query)}`)
        : assocQuery.ilike('search_text', containsPattern(query)),
      db().from('atmc_products').select('*').ilike('search_text', containsPattern(query)).limit(20),
    ]);
    layerB = [...unwrap(assoc).map(toAssociationProduct).map(fromAssociation), ...unwrap(atmc).map(toAtmcProduct).map(fromAtmc)];
  }

  if (wantOff) {
    if (barcode) {
      const offProduct = await fetchFromOpenFoodFactsByBarcode(query);
      if (offProduct) layerA.push(offProduct);
    } else {
      const off = await searchOpenFoodFacts(query);
      layerA = off.products;
      if (!off.ok) offStatus = 'unavailable';
    }
  }

  return res.json({
    success: true,
    query,
    isBarcode: barcode,
    offStatus,
    totalCount: layerB.length + layerA.length,
    layerB,
    layerA,
    combined: [...layerB, ...layerA],
  });
});

/**
 * GET /api/products/barcode/:barcode
 */
router.get('/barcode/:barcode', async (req, res) => {
  const barcode = clean(req.params.barcode);
  if (!isBarcode(barcode)) {
    return res.status(400).json({ success: false, message: 'Code-barres invalide : 8 à 14 chiffres.' });
  }

  const [localRow] = unwrap(await db().from('association_products').select('*').eq('barcode', barcode).limit(1));
  if (localRow) return res.json({ success: true, source: ASSOCIATION_SOURCE, data: toAssociationProduct(localRow) });

  const offProduct = await fetchFromOpenFoodFactsByBarcode(barcode);
  if (offProduct) return res.json({ success: true, source: 'Open Food Facts', data: offProduct });

  return res.status(404).json({ success: false, message: 'Code-barres non trouvé dans les bases de données locale et mondiale.' });
});

/**
 * GET /api/products/categories
 */
router.get('/categories', async (req, res) => {
  const categories = await cached('products:categories', 10 * 60 * 1000, async () => {
    const rows = unwrap(await db().from('association_products').select('category'));
    return [...new Set(rows.map((r) => r.category))];
  });
  return res.json({ success: true, data: categories });
});

export default router;
