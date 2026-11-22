import { db, unwrap, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { asyncRouter } from '../utils/http.js';
import { rangeStart } from '../services/dashboard.js';
import { siteStats } from '../services/stats.js';

/**
 * GET /api/admin/stats?days=7|30|90 — admins only.
 * Visits, new accounts, forum posts, marketplace sales and new products over the period, day by day, with the
 * period before for comparison, and the products that sold the most and the least.
 * The counting is done by the database (supabase/migrations/20261122100000_site_stats.sql).
 */
const router = asyncRouter();

router.use(requireAdmin);

const PERIODS = [7, 30, 90];
const LIST_SIZE = 10;

const count = async (table, filter = (q) => q) => {
  const { count: n, error } = await filter(db().from(table).select('id', { count: 'exact', head: true }));
  return error ? null : n;
};

router.get('/', async (req, res) => {
  const days = PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const now = Date.now();
  const from = rangeStart(days * 2, now); // the period before, for comparison
  const split = rangeStart(days, now);

  const [daily, sales, firstVisit, accounts, questions, answers, listedProducts, activeStores] = await Promise.all([
    db().rpc('stats_daily', { p_from: from, p_split: split }),
    db().rpc('stats_product_sales', { p_from: split, p_limit: LIST_SIZE }),
    db().from('site_visits').select('created_at').order('created_at').limit(1),
    count('profiles'),
    count('forum_threads'),
    count('forum_replies'),
    count('market_products', (q) => q.eq('is_available', true)),
    count('stores', (q) => q.eq('is_active', true)),
  ]);
  // The migration is not applied yet: the page says so instead of failing
  if (isMissingTable(daily.error) || daily.error?.code === 'PGRST202' || isMissingTable(firstVisit.error)) {
    return res.status(503).json(FEATURE_UNAVAILABLE);
  }

  const data = {
    days,
    from: split,
    generatedAt: new Date(now).toISOString(),
    ...siteStats({
      daily: unwrap(daily),
      sales: unwrap(sales),
      totals: { accounts, questions, answers, listedProducts, activeStores },
      visitsSince: unwrap(firstVisit)[0]?.created_at || null,
      days,
      now,
    }),
  };
  return res.json({ success: true, data });
});

export default router;
