import { db, unwrap, isDbConfigured, pingDb } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { toProfile, toStore, toSellerApplication } from '../models/mappers.js';
import { containsPattern } from '../utils/regex.js';
import { asyncRouter, clean, UUID_RE, badRequest } from '../utils/http.js';
import { audit } from '../services/audit.js';

const router = asyncRouter();

const ROLES = ['ADMIN', 'SELLER', 'CLIENT'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

router.use(requireAdmin);

const findApplication = async (id) => {
  if (!UUID_RE.test(id)) return null;
  return unwrap(await db().from('seller_applications').select('*').eq('id', id).maybeSingle());
};

/**
 * GET /api/admin/health
 * What is configured (never the values) and whether the database answers
 */
router.get('/health', async (req, res) => {
  let database = 'not_configured';
  if (isDbConfigured()) {
    try {
      await pingDb();
      database = 'connected';
    } catch {
      database = 'unreachable';
    }
  }
  return res.json({
    success: true,
    database,
    config: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
      geminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      siteUrl: Boolean(process.env.SITE_URL),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/admin/seller-applications?status=PENDING|APPROVED|REJECTED|ALL
 */
router.get('/seller-applications', async (req, res) => {
  const status = clean(req.query.status).toUpperCase() || 'PENDING';
  let query = db().from('seller_applications').select('*, profiles(email, full_name)').order('created_at', { ascending: false }).limit(500);
  if (STATUSES.includes(status)) query = query.eq('status', status);
  const [rows, pending] = await Promise.all([
    query,
    db().from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
  ]);
  if (pending.error) throw new Error(pending.error.message);
  const data = unwrap(rows).map(toSellerApplication);
  return res.json({ success: true, count: data.length, pendingCount: pending.count ?? 0, data });
});

/**
 * POST /api/admin/seller-applications/:id/approve
 * Opens the store from the request and makes the client a seller.
 * The request is claimed first (PENDING -> APPROVED), so it is processed once; if opening
 * the store fails, the claim is undone and the request goes back to the inbox.
 */
router.post('/seller-applications/:id/approve', async (req, res) => {
  const application = await findApplication(req.params.id);
  if (!application) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
  if (application.status !== 'PENDING') return res.status(409).json({ success: false, message: 'Cette demande a déjà été traitée.' });

  const existing = unwrap(await db().from('stores').select('id').eq('owner_id', application.user_id).maybeSingle());
  if (existing) return res.status(409).json({ success: false, message: 'Ce compte a déjà une boutique.' });

  const [claimed] = unwrap(
    await db()
      .from('seller_applications')
      .update({ status: 'APPROVED', reviewed_at: new Date().toISOString() })
      .eq('id', application.id)
      .eq('status', 'PENDING')
      .select('id')
  );
  if (!claimed) return res.status(409).json({ success: false, message: 'Cette demande a déjà été traitée.' });

  let store;
  try {
    [store] = unwrap(
      await db()
        .from('stores')
        .insert({
          owner_id: application.user_id,
          name: application.business_name,
          type: application.type,
          city: application.city,
          address: application.address,
          phone: application.phone,
          description: application.description,
        })
        .select()
    );
  } catch (error) {
    await db().from('seller_applications').update({ status: 'PENDING', reviewed_at: null }).eq('id', application.id);
    if (/duplicate|unique/i.test(error.message)) return res.status(409).json({ success: false, message: 'Ce compte a déjà une boutique.' });
    throw error;
  }

  // An admin who applied stays an admin; a client becomes a seller
  unwrap(await db().from('profiles').update({ role: 'SELLER' }).eq('id', application.user_id).eq('role', 'CLIENT'));
  unwrap(await db().from('seller_applications').update({ store_id: store.id }).eq('id', application.id));
  await audit(req, 'seller_application.approve', application.id, { storeId: store.id, userId: application.user_id });
  return res.json({ success: true, message: 'Demande acceptée : la boutique est ouverte.', data: toStore(store) });
});

/**
 * POST /api/admin/seller-applications/:id/reject
 */
router.post('/seller-applications/:id/reject', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
  const [updated] = unwrap(
    await db()
      .from('seller_applications')
      .update({ status: 'REJECTED', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('status', 'PENDING')
      .select()
  );
  if (!updated) {
    return (await findApplication(req.params.id))
      ? res.status(409).json({ success: false, message: 'Cette demande a déjà été traitée.' })
      : res.status(404).json({ success: false, message: 'Demande introuvable.' });
  }
  await audit(req, 'seller_application.reject', updated.id, { userId: updated.user_id });
  return res.json({ success: true, message: 'Demande refusée.', data: toSellerApplication(updated) });
});

/**
 * GET /api/admin/users?q=&role=
 */
router.get('/users', async (req, res) => {
  let query = db().from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
  const role = clean(req.query.role).toUpperCase();
  if (ROLES.includes(role)) query = query.eq('role', role);
  // Commas, parentheses and quotes would break PostgREST's or() syntax
  const q = clean(req.query.q).replace(/[,()"]/g, ' ').trim().slice(0, 100);
  if (q) query = query.or(`email.ilike.${containsPattern(q)},full_name.ilike.${containsPattern(q)}`);
  const users = unwrap(await query).map(toProfile);
  return res.json({ success: true, count: users.length, data: users });
});

/**
 * PATCH /api/admin/users/:id/role
 * Body: { role }. Admins cannot change their own role, so there is always one left.
 * A seller moved back to client has their store suspended; it can be reactivated later.
 */
router.patch('/users/:id/role', async (req, res) => {
  const role = clean(req.body.role).toUpperCase();
  if (!ROLES.includes(role)) return badRequest(res, 'Rôle inconnu.');
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Compte introuvable.' });
  if (req.user.id === req.params.id) return badRequest(res, 'Vous ne pouvez pas changer votre propre rôle.');

  const before = unwrap(await db().from('profiles').select('role').eq('id', req.params.id).maybeSingle());
  if (!before) return res.status(404).json({ success: false, message: 'Compte introuvable.' });

  const [updated] = unwrap(await db().from('profiles').update({ role }).eq('id', req.params.id).select());
  let storeSuspended = false;
  if (role === 'CLIENT' && before.role !== 'CLIENT') {
    const suspended = unwrap(await db().from('stores').update({ is_active: false }).eq('owner_id', req.params.id).eq('is_active', true).select('id'));
    storeSuspended = suspended.length > 0;
  }
  await audit(req, 'user.role', req.params.id, { from: before.role, to: role, email: updated.email, storeSuspended });
  return res.json({
    success: true,
    message: storeSuspended ? 'Rôle mis à jour. Sa boutique a été suspendue.' : 'Rôle mis à jour.',
    data: toProfile(updated),
  });
});

/**
 * GET /api/admin/stores
 * Every store, suspended ones included, with its owner
 */
router.get('/stores', async (req, res) => {
  const rows = unwrap(
    await db().from('stores').select('*, market_products(count), profiles(email, full_name)').order('created_at', { ascending: false }).limit(500)
  );
  const data = rows.map((r) => ({ ...toStore(r), owner: r.profiles ? { email: r.profiles.email, fullName: r.profiles.full_name } : null }));
  return res.json({ success: true, count: data.length, data });
});

/**
 * PATCH /api/admin/stores/:id
 * Body: { isActive }. A suspended store disappears from the marketplace.
 */
router.patch('/stores/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
  if (typeof req.body.isActive !== 'boolean') return badRequest(res, 'isActive doit valoir true ou false.');
  const [updated] = unwrap(await db().from('stores').update({ is_active: req.body.isActive }).eq('id', req.params.id).select());
  if (!updated) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
  await audit(req, updated.is_active ? 'store.reactivate' : 'store.suspend', updated.id, { name: updated.name });
  return res.json({ success: true, message: updated.is_active ? 'Boutique réactivée.' : 'Boutique suspendue.', data: toStore(updated) });
});

/**
 * GET /api/admin/audit-log
 * The latest admin actions
 */
router.get('/audit-log', async (req, res) => {
  const rows = unwrap(await db().from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200));
  return res.json({
    success: true,
    data: rows.map((r) => ({
      _id: r.id,
      actorEmail: r.actor_email,
      action: r.action,
      targetId: r.target_id,
      details: r.details,
      createdAt: r.created_at,
    })),
  });
});

export default router;
