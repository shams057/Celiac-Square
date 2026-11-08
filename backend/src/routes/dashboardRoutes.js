import { db, unwrap, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { requireStaff } from '../middleware/adminAuth.js';
import { asyncRouter } from '../utils/http.js';
import { orderStats, platformStats, rangeStart } from '../services/dashboard.js';

/**
 * GET /api/admin/dashboard?days=7|30|90
 * The team (STAFF) gets the orders section; admins also get marketplace, inbox and accounts.
 */
const router = asyncRouter();

router.use(requireStaff);

const PERIODS = [7, 30, 90];
const MAX_ROWS = 5000;
const ORDER_FIELDS =
  'id, number, status, store_id, store_name, customer_name, city, carrier, delivery_fee, cancel_reason, confirm_channel, whatsapp_status, whatsapp_sent_at, ' +
  'created_at, confirmed_at, preparing_at, ready_at, shipped_at, delivered_at, cancelled_at, order_items(product_id, title, unit_price, quantity)';

const count = async (table, filter) => {
  const { count: n, error } = await filter(db().from(table).select('id', { count: 'exact', head: true }));
  return error ? null : n; // a table missing on an older database just shows "—"
};

router.get('/', async (req, res) => {
  const days = PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const now = Date.now();
  const from = rangeStart(days, now);

  const [cohort, delivered, active, team] = await Promise.all([
    db().from('orders').select(ORDER_FIELDS).gte('created_at', from).order('created_at').limit(MAX_ROWS),
    db().from('orders').select(ORDER_FIELDS).eq('status', 'DELIVERED').gte('delivered_at', from).limit(MAX_ROWS),
    db().from('orders').select(ORDER_FIELDS).not('status', 'in', '(DELIVERED,CANCELLED)').limit(MAX_ROWS),
    db().from('profiles').select('id').in('role', ['ADMIN', 'STAFF']),
  ]);
  if (isMissingTable(cohort.error)) return res.status(503).json(FEATURE_UNAVAILABLE);

  // Team activity: what staff and admins did on orders (not the customers, not WhatsApp)
  const teamIds = unwrap(team).map((p) => p.id);
  const events = teamIds.length
    ? unwrap(
        await db()
          .from('order_events')
          .select('actor_email, kind')
          .in('actor_id', teamIds)
          .gte('created_at', from)
          .limit(MAX_ROWS * 4)
      )
    : [];

  const data = {
    days,
    from,
    generatedAt: new Date(now).toISOString(),
    orders: orderStats({ cohort: unwrap(cohort), delivered: unwrap(delivered), active: unwrap(active), events, days, now }),
    truncated: [cohort, delivered, active].some((r) => (r.data || []).length >= MAX_ROWS),
  };

  if (req.user.role === 'ADMIN') {
    const [stores, profiles, openReports, pendingProposals, pendingApplications] = await Promise.all([
      db().from('stores').select('is_active, owner_id, import_key, market_products(price)').limit(MAX_ROWS),
      db().from('profiles').select('role, phone, created_at').limit(50000),
      count('reports', (q) => q.eq('status', 'OPEN')),
      count('spot_proposals', (q) => q.eq('status', 'PENDING')),
      count('seller_applications', (q) => q.eq('status', 'PENDING')),
    ]);
    data.platform = platformStats({ stores: unwrap(stores), profiles: unwrap(profiles), openReports, pendingProposals, pendingApplications, from });
  }

  return res.json({ success: true, data });
});

export default router;
