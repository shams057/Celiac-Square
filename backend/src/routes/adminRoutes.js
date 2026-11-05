import express from 'express';
import { db, unwrap } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { getRequestUser } from '../middleware/auth.js';
import { toProfile, toStore, toSellerApplication } from '../models/mappers.js';
import { containsPattern } from '../utils/regex.js';

const router = express.Router();

const ROLES = ['ADMIN', 'SELLER', 'CLIENT'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(requireAdmin);

const findApplication = async (id) => {
  if (!UUID_RE.test(id)) return null;
  return unwrap(await db().from('seller_applications').select('*').eq('id', id).maybeSingle());
};

/**
 * GET /api/admin/seller-applications?status=PENDING|APPROVED|REJECTED|ALL
 */
router.get('/seller-applications', async (req, res) => {
  try {
    const status = String(req.query.status || 'PENDING').toUpperCase();
    let query = db().from('seller_applications').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
    if (status !== 'ALL') query = query.eq('status', status);
    const [rows, pending] = await Promise.all([
      query,
      db().from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);
    if (pending.error) throw new Error(pending.error.message);
    const data = unwrap(rows).map(toSellerApplication);
    return res.json({ success: true, count: data.length, pendingCount: pending.count ?? 0, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/seller-applications/:id/approve
 * Opens the store from the request and makes the client a seller
 */
router.post('/seller-applications/:id/approve', async (req, res) => {
  try {
    const application = await findApplication(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    if (application.status !== 'PENDING') return res.status(409).json({ success: false, message: 'Cette demande a déjà été traitée.' });

    const existing = unwrap(await db().from('stores').select('id').eq('owner_id', application.user_id).maybeSingle());
    if (existing) return res.status(409).json({ success: false, message: 'Ce compte a déjà une boutique.' });

    const [store] = unwrap(
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
    // An admin who applied stays an admin; a client becomes a seller
    unwrap(await db().from('profiles').update({ role: 'SELLER' }).eq('id', application.user_id).eq('role', 'CLIENT'));
    unwrap(
      await db()
        .from('seller_applications')
        .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), store_id: store.id })
        .eq('id', application.id)
    );
    return res.json({ success: true, message: 'Demande acceptée : la boutique est ouverte.', data: toStore(store) });
  } catch (error) {
    console.error(`[Admin Routes] Approve seller error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/seller-applications/:id/reject
 */
router.post('/seller-applications/:id/reject', async (req, res) => {
  try {
    const application = await findApplication(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    if (application.status !== 'PENDING') return res.status(409).json({ success: false, message: 'Cette demande a déjà été traitée.' });
    const [updated] = unwrap(
      await db()
        .from('seller_applications')
        .update({ status: 'REJECTED', reviewed_at: new Date().toISOString() })
        .eq('id', application.id)
        .select()
    );
    return res.json({ success: true, message: 'Demande refusée.', data: toSellerApplication(updated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/users?q=&role=
 */
router.get('/users', async (req, res) => {
  try {
    let query = db().from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
    const role = String(req.query.role || '').toUpperCase();
    if (ROLES.includes(role)) query = query.eq('role', role);
    // Commas and parentheses would break PostgREST's or() syntax
    const q = typeof req.query.q === 'string' ? req.query.q.replace(/[,()]/g, ' ').trim() : '';
    if (q) query = query.or(`email.ilike.${containsPattern(q)},full_name.ilike.${containsPattern(q)}`);
    const users = unwrap(await query).map(toProfile);
    return res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Body: { role }. Admins cannot change their own role, so there is always one left.
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const role = String(req.body.role || '').toUpperCase();
    if (!ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Rôle inconnu.' });
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Compte introuvable.' });

    const me = await getRequestUser(req);
    if (me?.id === req.params.id) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas changer votre propre rôle.' });

    const [updated] = unwrap(await db().from('profiles').update({ role }).eq('id', req.params.id).select());
    if (!updated) return res.status(404).json({ success: false, message: 'Compte introuvable.' });
    return res.json({ success: true, message: 'Rôle mis à jour.', data: toProfile(updated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/stores
 * Every store, suspended ones included, with its owner
 */
router.get('/stores', async (req, res) => {
  try {
    const rows = unwrap(await db().from('stores').select('*, market_products(count), profiles(email, full_name)').order('created_at', { ascending: false }));
    const data = rows.map((r) => ({ ...toStore(r), owner: r.profiles ? { email: r.profiles.email, fullName: r.profiles.full_name } : null }));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/stores/:id
 * Body: { isActive }. A suspended store disappears from the marketplace.
 */
router.patch('/stores/:id', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
    const [updated] = unwrap(await db().from('stores').update({ is_active: Boolean(req.body.isActive) }).eq('id', req.params.id).select());
    if (!updated) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
    return res.json({ success: true, message: updated.is_active ? 'Boutique réactivée.' : 'Boutique suspendue.', data: toStore(updated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
