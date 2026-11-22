import { dayRange } from './dashboard.js';

/**
 * Back-office statistics (Statistiques), computed from what the database counted (no database here: see
 * routes/statsRoutes.js for the queries, supabase/migrations/20261122100000_site_stats.sql for the counting,
 * test/stats.test.js for the rules). Days are Tunisian days.
 */

// What stats_daily() counts per day
export const DAILY_METRICS = ['visits', 'visitors', 'accounts', 'questions', 'answers', 'orders', 'items', 'products'];

const round = (n, digits = 1) => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

/** Change from the period before, in %; null when there is nothing to compare with */
export const change = (value, previous) => (previous ? round(((value - previous) / previous) * 100) : null);

/**
 * daily     rows of stats_daily(): { metric, day: 'YYYY-MM-DD' | null, n }, from the start of the period before
 * sales     rows of stats_product_sales(): { list: 'top' | 'bottom', product_id, title, store_name, units, orders, revenue, listed_at }
 * totals    counts over all time: { accounts, questions, answers, listedProducts, activeStores }
 * visitsSince  when visits started to be counted (the first visit recorded), or null
 */
export const siteStats = ({ daily, sales, totals, visitsSince, days, now = Date.now() }) => {
  const range = dayRange(days, now);
  const before = dayRange(days * 2, now).slice(0, days);
  const empty = () => Object.fromEntries(DAILY_METRICS.map((m) => [m, 0]));
  const current = new Map(range.map((d) => [d, { day: d, ...empty() }]));
  const previous = new Map(before.map((d) => [d, empty()]));
  const visitors = { period: 0, before: 0 };

  for (const row of daily) {
    const n = Number(row.n) || 0;
    if (row.metric === 'visitors_period') visitors.period = n;
    else if (row.metric === 'visitors_before') visitors.before = n;
    else if (DAILY_METRICS.includes(row.metric) && row.day) {
      const day = String(row.day).slice(0, 10);
      const bucket = current.get(day) || previous.get(day);
      if (bucket) bucket[row.metric] += n;
    }
  }

  const sum = (map, metric) => [...map.values()].reduce((s, d) => s + d[metric], 0);
  const kpi = (metric) => {
    const value = sum(current, metric);
    const prior = sum(previous, metric);
    return { value, previous: prior, change: change(value, prior) };
  };

  const product = (r) => ({
    id: r.product_id || null,
    name: r.title,
    storeName: r.store_name || '',
    units: Number(r.units) || 0,
    orders: Number(r.orders) || 0,
    revenue: Number(r.revenue) || 0,
    listedAt: r.listed_at || null,
  });

  return {
    kpis: {
      visits: kpi('visits'),
      visitors: { value: visitors.period, previous: visitors.before, change: change(visitors.period, visitors.before) },
      accounts: kpi('accounts'),
      questions: kpi('questions'),
      answers: kpi('answers'),
      orders: kpi('orders'),
      items: kpi('items'),
      products: kpi('products'),
    },
    daily: [...current.values()],
    topProducts: sales.filter((r) => r.list === 'top').map(product),
    leastProducts: sales.filter((r) => r.list === 'bottom').map(product),
    totals,
    visitsSince,
  };
};
