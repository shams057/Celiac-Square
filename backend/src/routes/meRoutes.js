import { db, unwrap, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { asyncRouter, clean, badRequest, UUID_RE } from '../utils/http.js';
import { atmcToStatus } from '../services/statusBadges.js';

const router = asyncRouter();

router.use(requireUser);

const MAX_SAVED = 300;
// "atmc:<uuid>", "assoc:<uuid>" or "off:<barcode or stable id>"
const KEY_RE = /^(atmc|assoc):[0-9a-f-]{36}$|^off:[\w-]{1,60}$/i;
const STATUSES = ['SAFE', 'WARNING', 'UNSAFE', 'CROSS_CONTAMINATION_RISK', 'UNKNOWN'];

const str = (v, max) => clean(v).slice(0, max);

/** The fields of a product kept with a saved entry, cleaned and capped */
const snapshotOf = (p = {}) => ({
  name: str(p.name, 200),
  nameAr: str(p.nameAr, 200),
  brand: str(p.brand, 120),
  status: STATUSES.includes(clean(p.status).toUpperCase()) ? clean(p.status).toUpperCase() : 'UNKNOWN',
  badgeText: str(p.badgeText, 80),
  badgeTextAr: str(p.badgeTextAr, 80),
  source: str(p.source, 120),
  sourceDate: /^\d{4}-\d{2}-\d{2}/.test(clean(p.sourceDate)) ? clean(p.sourceDate).slice(0, 25) : '',
  barcode: /^\d{8,14}$/.test(clean(p.barcode)) ? clean(p.barcode) : '',
});

const toSaved = (r, current) => ({
  _id: r.id,
  key: r.product_key,
  ...r.snapshot,
  // The guide's status today, when it differs from the one saved
  currentStatus: current && current !== r.snapshot?.status ? current : null,
  savedAt: r.created_at,
});

/** Today's status of the guide products in the list: { key: status } */
const currentStatuses = async (rows) => {
  const ids = (prefix) => rows.map((r) => r.product_key).filter((k) => k.startsWith(`${prefix}:`)).map((k) => k.slice(prefix.length + 1)).filter((id) => UUID_RE.test(id));
  const atmcIds = ids('atmc');
  const assocIds = ids('assoc');
  const [atmc, assoc] = await Promise.all([
    atmcIds.length ? db().from('atmc_products').select('id, status').in('id', atmcIds) : { data: [] },
    assocIds.length ? db().from('association_products').select('id, status').in('id', assocIds) : { data: [] },
  ]);
  const out = {};
  (atmc.data || []).forEach((r) => {
    out[`atmc:${r.id}`] = atmcToStatus(r.status);
  });
  (assoc.data || []).forEach((r) => {
    out[`assoc:${r.id}`] = r.status;
  });
  return out;
};

/**
 * GET /api/me/saved
 * The user's saved products, newest first, with today's guide status when it changed.
 */
router.get('/saved', async (req, res) => {
  const { data, error } = await db()
    .from('saved_products')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_SAVED);
  if (isMissingTable(error)) return res.status(503).json(FEATURE_UNAVAILABLE);
  if (error) throw new Error(error.message);
  const current = await currentStatuses(data);
  return res.json({ success: true, count: data.length, data: data.map((r) => toSaved(r, current[r.product_key])) });
});

/**
 * PUT /api/me/saved/:key
 * Body: { name, nameAr?, brand?, status, badgeText?, badgeTextAr?, source?, sourceDate?, barcode? }
 * Saving the same product again refreshes what was kept.
 */
router.put('/saved/:key', async (req, res) => {
  const key = clean(req.params.key);
  if (!KEY_RE.test(key)) return badRequest(res, 'Produit invalide.');
  const snapshot = snapshotOf(req.body);
  if (!snapshot.name) return badRequest(res, 'Le nom du produit manque.');

  const { count, error: countError } = await db()
    .from('saved_products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id);
  if (isMissingTable(countError)) return res.status(503).json(FEATURE_UNAVAILABLE);
  if (countError) throw new Error(countError.message);
  if (count >= MAX_SAVED) return badRequest(res, `Vous avez déjà enregistré ${MAX_SAVED} produits. Retirez-en avant d’en ajouter.`);

  const [row] = unwrap(
    await db()
      .from('saved_products')
      .upsert({ user_id: req.user.id, product_key: key, snapshot }, { onConflict: 'user_id,product_key' })
      .select()
  );
  return res.json({ success: true, message: 'Produit enregistré.', data: toSaved(row) });
});

/**
 * DELETE /api/me/saved/:key
 */
router.delete('/saved/:key', async (req, res) => {
  const key = clean(req.params.key);
  if (!KEY_RE.test(key)) return badRequest(res, 'Produit invalide.');
  const { error } = await db().from('saved_products').delete().eq('user_id', req.user.id).eq('product_key', key);
  if (isMissingTable(error)) return res.status(503).json(FEATURE_UNAVAILABLE);
  if (error) throw new Error(error.message);
  return res.json({ success: true, message: 'Produit retiré.' });
});

export default router;
