import { db, unwrap } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { toStore, toMarketProduct } from '../models/mappers.js';
import { exactPattern } from '../utils/regex.js';
import { asyncRouter, clean, UUID_RE, MAX_LEN, badRequest } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { saveImages, saveImage, removeImages } from '../services/marketImages.js';
import { storeFields, invalidStore, productFields, invalidProduct, imageErrors } from './marketRoutes.js';

/**
 * Back-office editing of the marketplace: the team can open a store (with or without a
 * seller account behind it), edit any store and manage its products, exactly as its
 * seller would. Validation is shared with the seller's own routes.
 */
const router = asyncRouter();

router.use(requireAdmin);

const notFound = (res, what = 'Boutique introuvable.') => res.status(404).json({ success: false, message: what });

const findStore = async (id) => {
  if (!UUID_RE.test(id)) return null;
  return unwrap(await db().from('stores').select('*').eq('id', id).maybeSingle());
};

// Logos sit in the owner's folder (as when the seller uploads one), or the store's own when it has no owner
const logoFolder = (store) => `stores/${store.owner_id || store.id}`;

const withOwner = async (store) => {
  if (!store.owner_id) return { ...toStore(store), owner: null };
  const owner = unwrap(await db().from('profiles').select('email, full_name').eq('id', store.owner_id).maybeSingle());
  return { ...toStore(store), owner: owner ? { email: owner.email, fullName: owner.full_name } : null };
};

/**
 * Resolves the `ownerEmail` field: undefined (leave as is), null (no owner) or a profile id.
 * Returns { error } with a message when the account cannot own this store.
 */
const resolveOwner = async (body, storeId) => {
  if (body.ownerEmail === undefined) return { ownerId: undefined };
  const email = clean(body.ownerEmail).toLowerCase();
  if (!email) return { ownerId: null };
  if (email.length > MAX_LEN.email) return { error: 'Adresse e-mail trop longue.' };
  const profile = unwrap(await db().from('profiles').select('id, role').ilike('email', exactPattern(email)).maybeSingle());
  if (!profile) return { error: 'Aucun compte avec cette adresse e-mail : la personne doit d’abord créer son compte.' };
  const other = unwrap(await db().from('stores').select('id').eq('owner_id', profile.id).maybeSingle());
  if (other && other.id !== storeId) return { error: 'Ce compte a déjà une autre boutique.' };
  return { ownerId: profile.id, role: profile.role };
};

// A client given a store becomes a seller, as when their request is accepted; staff and admins keep their role
const promoteOwner = async (ownerId, role) => {
  if (ownerId && role === 'CLIENT') unwrap(await db().from('profiles').update({ role: 'SELLER' }).eq('id', ownerId).eq('role', 'CLIENT'));
};

/**
 * GET /api/admin/market/stores/:id
 * One store with its owner and every product, hidden ones included
 */
router.get('/stores/:id', async (req, res) => {
  const store = await findStore(req.params.id);
  if (!store) return notFound(res);
  const products = unwrap(await db().from('market_products').select('*').eq('store_id', store.id).order('created_at', { ascending: false }));
  return res.json({ success: true, data: { ...(await withOwner(store)), products: products.map(toMarketProduct) } });
});

/**
 * POST /api/admin/market/stores
 * Body: { name, type, city, address, phone, description, logo, isActive, ownerEmail }.
 * Without ownerEmail the store is run by the team until a seller claims it.
 */
router.post(
  '/stores',
  imageErrors(async (req, res) => {
    const row = storeFields(req.body);
    const invalid = invalidStore(row, null);
    if (invalid) return badRequest(res, invalid);
    const owner = await resolveOwner(req.body, null);
    if (owner.error) return badRequest(res, owner.error);

    const [created] = unwrap(
      await db()
        .from('stores')
        .insert({ ...row, owner_id: owner.ownerId ?? null, is_active: req.body.isActive !== false, source: 'Back-office' })
        .select()
    );
    let saved = created;
    try {
      const logo = await saveImage(req.body.logo, logoFolder(created));
      if (logo) [saved] = unwrap(await db().from('stores').update({ logo_url: logo }).eq('id', created.id).select());
    } catch (error) {
      // No half-created store: the logo was the only problem
      await db().from('stores').delete().eq('id', created.id);
      throw error;
    }
    await promoteOwner(owner.ownerId, owner.role);
    await audit(req, 'store.create', saved.id, { name: saved.name, ownerId: saved.owner_id });
    return res.status(201).json({ success: true, message: 'Boutique créée.', data: await withOwner(saved) });
  })
);

/**
 * PUT /api/admin/market/stores/:id
 * Any store field, plus logo, isActive and ownerEmail ('' detaches the owner)
 */
router.put(
  '/stores/:id',
  imageErrors(async (req, res) => {
    const store = await findStore(req.params.id);
    if (!store) return notFound(res);
    const row = storeFields(req.body);
    const invalid = invalidStore(row, store);
    if (invalid) return badRequest(res, invalid);
    if (req.body.isActive !== undefined) row.is_active = Boolean(req.body.isActive);
    const owner = await resolveOwner(req.body, store.id);
    if (owner.error) return badRequest(res, owner.error);
    if (owner.ownerId !== undefined) row.owner_id = owner.ownerId;

    const folder = logoFolder(store);
    const logo = req.body.logo === store.logo_url ? undefined : await saveImage(req.body.logo, folder);
    if (logo !== undefined) row.logo_url = logo;

    const [saved] = unwrap(await db().from('stores').update(row).eq('id', store.id).select());
    if (logo !== undefined && store.logo_url && store.logo_url !== logo) await removeImages([store.logo_url], folder);
    await promoteOwner(owner.ownerId, owner.role);
    await audit(req, 'store.update', store.id, { fields: Object.keys(row) });
    return res.json({ success: true, message: 'Boutique enregistrée.', data: await withOwner(saved) });
  })
);

const findProduct = async (storeId, id) => {
  if (!UUID_RE.test(id)) return null;
  return unwrap(await db().from('market_products').select('*').eq('id', id).eq('store_id', storeId).maybeSingle());
};

/**
 * POST /api/admin/market/stores/:id/products
 * Body: { title, description, price, images: [dataUrl…], isAvailable }
 */
router.post(
  '/stores/:id/products',
  imageErrors(async (req, res) => {
    const store = await findStore(req.params.id);
    if (!store) return notFound(res);
    const row = productFields(req.body);
    const invalid = invalidProduct(row, true);
    if (invalid) return badRequest(res, invalid);
    row.images = (await saveImages(req.body.images, `products/${store.id}`)) || [];
    const [saved] = unwrap(await db().from('market_products').insert({ ...row, store_id: store.id }).select());
    await audit(req, 'product.create', saved.id, { storeId: store.id, title: saved.title });
    return res.status(201).json({ success: true, message: 'Produit publié.', data: toMarketProduct(saved) });
  })
);

/**
 * PUT /api/admin/market/stores/:id/products/:productId
 * Any field; images is the full new list (kept URLs and new data URLs)
 */
router.put(
  '/stores/:id/products/:productId',
  imageErrors(async (req, res) => {
    const product = await findProduct(req.params.id, req.params.productId);
    if (!product) return notFound(res, 'Produit introuvable.');
    const row = productFields(req.body);
    const invalid = invalidProduct(row, false);
    if (invalid) return badRequest(res, invalid);
    const folder = `products/${product.store_id}`;
    const images = await saveImages(req.body.images, folder);
    if (images !== undefined) row.images = images;

    const [saved] = unwrap(await db().from('market_products').update(row).eq('id', product.id).select());
    if (images !== undefined) await removeImages(product.images.filter((url) => !images.includes(url)), folder);
    await audit(req, 'product.update', product.id, { storeId: product.store_id, fields: Object.keys(row) });
    return res.json({ success: true, message: 'Produit enregistré.', data: toMarketProduct(saved) });
  })
);

/**
 * DELETE /api/admin/market/stores/:id/products/:productId
 * Past orders keep their lines (product_id becomes null)
 */
router.delete('/stores/:id/products/:productId', async (req, res) => {
  const product = await findProduct(req.params.id, req.params.productId);
  if (!product) return notFound(res, 'Produit introuvable.');
  unwrap(await db().from('market_products').delete().eq('id', product.id));
  await removeImages(product.images, `products/${product.store_id}`);
  await audit(req, 'product.delete', product.id, { storeId: product.store_id, title: product.title });
  return res.json({ success: true, message: 'Produit supprimé.' });
});

export default router;
