import { db, unwrap } from '../config/db.js';
import { requireUser, requireRole } from '../middleware/auth.js';
import { limits } from '../middleware/rateLimit.js';
import { toStore, toPublicStore, toMarketProduct, toSellerApplication } from '../models/mappers.js';
import { containsPattern } from '../utils/regex.js';
import { asyncRouter, clean, UUID_RE, MAX_LEN, tooLong, badRequest } from '../utils/http.js';
import { saveImages, saveImage, removeImages, ImageError } from '../services/marketImages.js';

const router = asyncRouter();

export const STORE_TYPES = ['RESTAURANT', 'BAKERY', 'CAFE', 'ARTISAN'];
const STORE_EMBED = 'stores!inner(id, name, type, city, logo_url, is_active)';

// Image problems are the seller's to fix (400); anything else goes to the error handler
const imageErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    if (error instanceof ImageError) return badRequest(res, error.message);
    throw error;
  }
};

/** '' or null clears the price; anything else must be a non-negative number */
const parsePrice = (v) => {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 1000) / 1000 : NaN;
};

// ---------------------------------------------------------------------------
// Public: browsing the marketplace needs no account
// ---------------------------------------------------------------------------

/**
 * GET /api/market/stores?type=
 * Active stores with their number of products
 */
router.get('/stores', async (req, res) => {
  let query = db().from('stores').select('*, market_products(count)').eq('is_active', true).order('name');
  const type = clean(req.query.type).toUpperCase();
  if (STORE_TYPES.includes(type)) query = query.eq('type', type);
  const stores = unwrap(await query).map(toPublicStore);
  return res.json({ success: true, count: stores.length, data: stores });
});

/**
 * GET /api/market/stores/:id
 * One store and its available products (its menu)
 */
router.get('/stores/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
  const store = unwrap(await db().from('stores').select('*').eq('id', req.params.id).eq('is_active', true).maybeSingle());
  if (!store) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
  const products = unwrap(
    await db().from('market_products').select('*').eq('store_id', store.id).eq('is_available', true).order('created_at', { ascending: false })
  );
  return res.json({ success: true, data: { ...toPublicStore(store), products: products.map(toMarketProduct) } });
});

/**
 * GET /api/market/products?q=&type=&store=
 * Every available product from active stores, newest first, with its store
 */
router.get('/products', async (req, res) => {
  let query = db()
    .from('market_products')
    .select(`*, ${STORE_EMBED}`)
    .eq('is_available', true)
    .eq('stores.is_active', true)
    .order('created_at', { ascending: false })
    .limit(300);

  const type = clean(req.query.type).toUpperCase();
  if (STORE_TYPES.includes(type)) query = query.eq('stores.type', type);
  const store = clean(req.query.store);
  if (UUID_RE.test(store)) query = query.eq('store_id', store);
  const q = clean(req.query.q).slice(0, 100);
  if (q) query = query.ilike('search_text', containsPattern(q));

  const products = unwrap(await query).map(toMarketProduct);
  return res.json({ success: true, count: products.length, data: products });
});

// ---------------------------------------------------------------------------
// Everything below needs an account
// ---------------------------------------------------------------------------

router.use(requireUser);

const requireSeller = requireRole('SELLER', 'ADMIN');

const ownStore = async (userId) => unwrap(await db().from('stores').select('*').eq('owner_id', userId).maybeSingle());

const noStore = (res) => res.status(404).json({ success: false, code: 'NO_STORE', message: 'Créez d’abord votre boutique.' });
const suspended = (res) =>
  res.status(403).json({
    success: false,
    code: 'STORE_SUSPENDED',
    message: 'Votre boutique est suspendue par l’équipe : vous ne pouvez pas la modifier. Contactez-nous pour en savoir plus.',
  });

/** The seller's store for a write, or a response already sent */
const writableStore = async (req, res) => {
  const store = await ownStore(req.user.id);
  if (!store) {
    noStore(res);
    return null;
  }
  if (!store.is_active) {
    suspended(res);
    return null;
  }
  return store;
};

/**
 * GET /api/market/me/store
 * The seller's store (data: null when not created yet) and all its products, hidden ones included
 */
router.get('/me/store', requireSeller, async (req, res) => {
  const store = await ownStore(req.user.id);
  if (!store) return res.json({ success: true, data: null });
  const products = unwrap(await db().from('market_products').select('*').eq('store_id', store.id).order('created_at', { ascending: false }));
  return res.json({ success: true, data: { ...toStore(store), products: products.map(toMarketProduct) } });
});

/**
 * PUT /api/market/me/store
 * Creates or updates the seller's store. Body: { name, type, city, address, phone, description, logo }
 */
router.put(
  '/me/store',
  requireSeller,
  imageErrors(async (req, res) => {
    const existing = await ownStore(req.user.id);
    if (existing && !existing.is_active) return suspended(res);

    const row = {};
    ['name', 'city', 'address', 'phone', 'description'].forEach((f) => {
      if (req.body[f] !== undefined) row[f] = clean(req.body[f]);
    });
    if (req.body.type !== undefined) row.type = clean(req.body.type).toUpperCase();

    const name = row.name ?? existing?.name;
    const type = row.type ?? existing?.type;
    if (!name) return badRequest(res, 'Indiquez le nom de la boutique.');
    if (!STORE_TYPES.includes(type)) return badRequest(res, 'Type de boutique inconnu.');
    const long = tooLong({
      nom: [row.name, MAX_LEN.name],
      ville: [row.city, MAX_LEN.city],
      adresse: [row.address, MAX_LEN.address],
      téléphone: [row.phone, MAX_LEN.phone],
      présentation: [row.description, MAX_LEN.description],
    });
    if (long) return badRequest(res, long);

    const folder = `stores/${req.user.id}`;
    const logo = await saveImage(req.body.logo, folder);
    if (logo !== undefined) row.logo_url = logo;

    const [saved] = existing
      ? unwrap(await db().from('stores').update(row).eq('id', existing.id).select())
      : unwrap(await db().from('stores').insert({ ...row, owner_id: req.user.id }).select());
    if (existing && logo !== undefined && existing.logo_url && existing.logo_url !== logo) await removeImages([existing.logo_url], folder);

    return res.status(existing ? 200 : 201).json({ success: true, message: 'Boutique enregistrée.', data: toStore(saved) });
  })
);

/** Request body to market_products columns; only fields present are set */
const productFields = (body) => {
  const row = {};
  if (body.title !== undefined) row.title = clean(body.title);
  if (body.description !== undefined) row.description = clean(body.description);
  if (body.isAvailable !== undefined) row.is_available = Boolean(body.isAvailable);
  const price = parsePrice(body.price);
  if (price !== undefined) row.price = price;
  return row;
};

const invalidProduct = (row, creating) => {
  if ((creating || row.title !== undefined) && !row.title) return 'Indiquez le nom du produit.';
  if (Number.isNaN(row.price)) return 'Prix invalide.';
  return tooLong({ titre: [row.title, MAX_LEN.title], description: [row.description, MAX_LEN.description] });
};

/**
 * POST /api/market/me/products
 * Body: { title, description, price, images: [dataUrl…], isAvailable }
 */
router.post(
  '/me/products',
  requireSeller,
  imageErrors(async (req, res) => {
    const store = await writableStore(req, res);
    if (!store) return undefined;
    const row = productFields(req.body);
    const invalid = invalidProduct(row, true);
    if (invalid) return badRequest(res, invalid);

    row.images = (await saveImages(req.body.images, `products/${store.id}`)) || [];
    const [saved] = unwrap(await db().from('market_products').insert({ ...row, store_id: store.id }).select());
    return res.status(201).json({ success: true, message: 'Produit publié.', data: toMarketProduct(saved) });
  })
);

const ownProduct = async (storeId, id) => {
  if (!UUID_RE.test(id)) return null;
  return unwrap(await db().from('market_products').select('*').eq('id', id).eq('store_id', storeId).maybeSingle());
};

/**
 * PUT /api/market/me/products/:id
 * Any field; images is the full new list (kept URLs and new data URLs)
 */
router.put(
  '/me/products/:id',
  requireSeller,
  imageErrors(async (req, res) => {
    const store = await writableStore(req, res);
    if (!store) return undefined;
    const product = await ownProduct(store.id, req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Produit introuvable.' });

    const row = productFields(req.body);
    const invalid = invalidProduct(row, false);
    if (invalid) return badRequest(res, invalid);
    const folder = `products/${store.id}`;
    const images = await saveImages(req.body.images, folder);
    if (images !== undefined) row.images = images;

    const [saved] = unwrap(await db().from('market_products').update(row).eq('id', product.id).select());
    if (images !== undefined) await removeImages(product.images.filter((url) => !images.includes(url)), folder);
    return res.json({ success: true, message: 'Produit enregistré.', data: toMarketProduct(saved) });
  })
);

/**
 * DELETE /api/market/me/products/:id
 */
router.delete('/me/products/:id', requireSeller, async (req, res) => {
  const store = await writableStore(req, res);
  if (!store) return undefined;
  const product = await ownProduct(store.id, req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Produit introuvable.' });
  unwrap(await db().from('market_products').delete().eq('id', product.id));
  await removeImages(product.images, `products/${store.id}`);
  return res.json({ success: true, message: 'Produit supprimé.' });
});

// ---------------------------------------------------------------------------
// Becoming a seller
// ---------------------------------------------------------------------------

/**
 * GET /api/market/applications/mine
 * The account's requests, newest first
 */
router.get('/applications/mine', async (req, res) => {
  const rows = unwrap(await db().from('seller_applications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }));
  return res.json({ success: true, data: rows.map(toSellerApplication) });
});

/**
 * POST /api/market/applications
 * A client asks to sell. Body: { businessName, type, city, address, phone, description }
 */
router.post('/applications', limits.submissions, requireRole('CLIENT'), async (req, res) => {
  const row = {
    user_id: req.user.id,
    business_name: clean(req.body.businessName),
    type: clean(req.body.type).toUpperCase(),
    city: clean(req.body.city),
    address: clean(req.body.address),
    phone: clean(req.body.phone),
    description: clean(req.body.description),
  };
  if (!row.business_name || !row.city || !row.phone) {
    return badRequest(res, 'Indiquez le nom de l’établissement, la ville et un téléphone.');
  }
  if (!STORE_TYPES.includes(row.type)) return badRequest(res, 'Type d’établissement inconnu.');
  const long = tooLong({
    'nom de l’établissement': [row.business_name, MAX_LEN.businessName],
    ville: [row.city, MAX_LEN.city],
    adresse: [row.address, MAX_LEN.address],
    téléphone: [row.phone, MAX_LEN.phone],
    description: [row.description, MAX_LEN.description],
  });
  if (long) return badRequest(res, long);

  const { data, error } = await db().from('seller_applications').insert(row).select();
  if (error) {
    // seller_applications_one_pending
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Vous avez déjà une demande en cours d’examen.' });
    throw new Error(error.message);
  }
  return res.status(201).json({
    success: true,
    message: 'Demande envoyée. Elle sera examinée par l’équipe.',
    data: toSellerApplication(data[0]),
  });
});

export default router;
