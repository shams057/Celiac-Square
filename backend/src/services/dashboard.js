import { orderTotal, isAwaitingWhatsApp, whatsappDeadline } from './orderFlow.js';

/**
 * Back-office dashboard figures, computed from plain rows (no database here: see
 * routes/dashboardRoutes.js for the queries, test/dashboard.test.js for the rules).
 *
 * Days are Tunisian days (UTC+1, no daylight saving time).
 */
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const TN_OFFSET = HOUR;

/** "2026-11-08" for a timestamp, in Tunisian time */
export const tnDay = (iso) => new Date(new Date(iso).getTime() + TN_OFFSET).toISOString().slice(0, 10);

/** The last `days` Tunisian days, oldest first, ending today */
export const dayRange = (days, now = Date.now()) => {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(tnDay(new Date(now - i * DAY).toISOString()));
  return out;
};

/** Start of the first day of the range, as an ISO timestamp */
export const rangeStart = (days, now = Date.now()) => new Date(new Date(`${dayRange(days, now)[0]}T00:00:00Z`).getTime() - TN_OFFSET).toISOString();

const hoursBetween = (a, b) => (a && b ? (new Date(b) - new Date(a)) / HOUR : null);

export const median = (values) => {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

const round = (n, digits = 1) => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits);
const money = (n) => Math.round(n * 1000) / 1000;
const totalOf = (o) => orderTotal(o.order_items || [], o.delivery_fee).total;
const top = (map, n, key = 'count') =>
  [...map.values()].sort((a, b) => b[key] - a[key] || String(a.name).localeCompare(String(b.name))).slice(0, n);

/**
 * How long an order may wait at each step before it is late, in hours, and the
 * timestamp the wait counts from. NEW counts from the WhatsApp deadline when one was sent.
 */
export const LATE_AFTER = {
  NEW: { hours: 24, since: (o) => (o.whatsapp_status === 'SENT' ? whatsappDeadline(o.whatsapp_sent_at) : o.created_at) },
  CONFIRMED: { hours: 24, since: (o) => o.confirmed_at },
  PREPARING: { hours: 48, since: (o) => o.preparing_at },
  READY: { hours: 24, since: (o) => o.ready_at },
  SHIPPED: { hours: 120, since: (o) => o.shipped_at },
};

/** Hours an active order is past its step's limit, or 0 when on time (or waiting for WhatsApp) */
export const hoursLate = (o, now = Date.now()) => {
  const rule = LATE_AFTER[o.status];
  if (!rule || isAwaitingWhatsApp(o, now)) return 0;
  const since = rule.since(o);
  if (!since) return 0;
  const waited = (now - new Date(since).getTime()) / HOUR;
  return waited > rule.hours ? waited - rule.hours : 0;
};

/**
 * Orders section.
 *  cohort    orders placed in the period (with order_items)
 *  delivered orders delivered in the period, whenever placed (with order_items): revenue
 *  active    every order still in progress: pipeline and late orders
 *  events    order_events in the period by team members (actor_email, kind)
 */
export const orderStats = ({ cohort, delivered, active, events, days, now = Date.now() }) => {
  const range = dayRange(days, now);
  const daily = new Map(range.map((d) => [d, { day: d, placed: 0, delivered: 0, revenue: 0 }]));
  for (const o of cohort) daily.get(tnDay(o.created_at)) && (daily.get(tnDay(o.created_at)).placed += 1);
  let revenue = 0;
  for (const o of delivered) {
    const total = totalOf(o);
    revenue += total;
    const d = daily.get(tnDay(o.delivered_at));
    if (d) {
      d.delivered += 1;
      d.revenue = money(d.revenue + total);
    }
  }

  const confirmed = cohort.filter((o) => o.confirmed_at);
  const cancelled = cohort.filter((o) => o.status === 'CANCELLED');
  const decided = cohort.filter((o) => o.status !== 'NEW'); // the team or the customer has acted on these
  const byWhatsApp = confirmed.filter((o) => o.whatsapp_status === 'CONFIRMED');

  // Pipeline now
  const stages = ['NEW', 'WAITING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'];
  const pipeline = Object.fromEntries(stages.map((s) => [s, { count: 0, late: 0, value: 0 }]));
  const late = [];
  for (const o of active) {
    const stage = isAwaitingWhatsApp(o, now) ? 'WAITING' : o.status;
    if (!pipeline[stage]) continue;
    pipeline[stage].count += 1;
    pipeline[stage].value = money(pipeline[stage].value + totalOf(o));
    const over = hoursLate(o, now);
    if (over > 0) {
      pipeline[stage].late += 1;
      late.push({ id: o.id, reference: `CS-${o.number}`, status: o.status, storeName: o.store_name, customerName: o.customer_name, hoursLate: round(over, 0) });
    }
  }
  late.sort((a, b) => b.hoursLate - a.hoursLate);

  // By artisan: orders placed in the period and what became of them
  const stores = new Map();
  for (const o of cohort) {
    const key = o.store_id || o.store_name;
    if (!stores.has(key)) stores.set(key, { storeId: o.store_id, name: o.store_name, count: 0, delivered: 0, cancelled: 0, revenue: 0, prepHours: [] });
    const s = stores.get(key);
    s.count += 1;
    if (o.status === 'DELIVERED') {
      s.delivered += 1;
      s.revenue = money(s.revenue + totalOf(o));
    }
    if (o.status === 'CANCELLED') s.cancelled += 1;
    s.prepHours.push(hoursBetween(o.preparing_at, o.ready_at));
  }
  const byStore = top(stores, 50).map(({ prepHours, ...s }) => ({ ...s, medianPrepHours: round(median(prepHours)) }));

  const cities = new Map();
  for (const o of cohort) {
    const name = (o.city || '').trim() || '—';
    const key = name.toLowerCase();
    if (!cities.has(key)) cities.set(key, { name, count: 0 });
    cities.get(key).count += 1;
  }

  const carriers = new Map();
  for (const o of delivered) {
    const name = o.carrier || '—';
    if (!carriers.has(name)) carriers.set(name, { name, count: 0, hours: [] });
    carriers.get(name).count += 1;
    carriers.get(name).hours.push(hoursBetween(o.shipped_at, o.delivered_at));
  }

  const reasons = new Map();
  for (const o of cancelled) {
    const name = (o.cancel_reason || '').trim() || 'Sans raison';
    if (!reasons.has(name)) reasons.set(name, { name, count: 0 });
    reasons.get(name).count += 1;
  }

  const products = new Map();
  for (const o of cohort) {
    if (o.status === 'CANCELLED') continue;
    for (const i of o.order_items || []) {
      const key = i.product_id || `${o.store_name}:${i.title}`;
      if (!products.has(key)) products.set(key, { name: i.title, storeName: o.store_name, count: 0, orders: 0 });
      products.get(key).count += i.quantity;
      products.get(key).orders += 1;
    }
  }

  const sent = cohort.filter((o) => o.whatsapp_sent_at || ['SENT', 'REPLIED', 'CONFIRMED'].includes(o.whatsapp_status));
  const whatsapp = {
    asked: cohort.filter((o) => o.confirm_channel === 'WHATSAPP').length,
    askedPhone: cohort.filter((o) => o.confirm_channel === 'PHONE').length,
    sent: sent.length,
    confirmed: byWhatsApp.length,
    replied: cohort.filter((o) => o.whatsapp_status === 'REPLIED').length,
    failed: cohort.filter((o) => o.whatsapp_status === 'FAILED').length,
    waiting: cohort.filter((o) => isAwaitingWhatsApp(o, now)).length,
    // Sent, the waiting time is over and nobody confirmed on WhatsApp
    expired: sent.filter((o) => o.whatsapp_status === 'SENT' && whatsappDeadline(o.whatsapp_sent_at) <= new Date(now).toISOString()).length,
  };

  const team = new Map();
  for (const e of events) {
    const name = e.actor_email || '—';
    if (!team.has(name)) team.set(name, { name, count: 0, steps: 0, calls: 0, notes: 0, edits: 0 });
    const t = team.get(name);
    t.count += 1;
    if (e.kind === 'STATUS') t.steps += 1;
    else if (e.kind === 'CALL') t.calls += 1;
    else if (e.kind === 'NOTE') t.notes += 1;
    else if (e.kind === 'EDIT') t.edits += 1;
  }

  return {
    kpis: {
      placed: cohort.length,
      confirmed: confirmed.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      revenue: money(revenue),
      averageBasket: delivered.length ? money(revenue / delivered.length) : null,
      // Of the orders someone has acted on, the share that got confirmed
      confirmationRate: decided.length ? round((confirmed.length / decided.length) * 100) : null,
      cancellationRate: cohort.length ? round((cancelled.length / cohort.length) * 100) : null,
      whatsappConfirmShare: confirmed.length ? round((byWhatsApp.length / confirmed.length) * 100) : null,
      medianConfirmHours: round(median(confirmed.map((o) => hoursBetween(o.created_at, o.confirmed_at)))),
      medianPrepHours: round(median(cohort.map((o) => hoursBetween(o.preparing_at, o.ready_at)))),
      medianShippingHours: round(median(delivered.map((o) => hoursBetween(o.shipped_at, o.delivered_at)))),
      medianLeadHours: round(median(delivered.map((o) => hoursBetween(o.created_at, o.delivered_at)))),
      activeValue: money(Object.values(pipeline).reduce((s, p) => s + p.value, 0)),
      lateCount: late.length,
    },
    daily: [...daily.values()],
    pipeline,
    late: late.slice(0, 15),
    byStore,
    byCity: top(cities, 10),
    byCarrier: top(carriers, 10).map(({ hours, ...c }) => ({ ...c, medianHours: round(median(hours)) })),
    cancelReasons: top(reasons, 6),
    topProducts: top(products, 10),
    whatsapp,
    team: top(team, 20),
  };
};

/**
 * Admin-only section: marketplace, community inbox and accounts.
 *  stores    rows with is_active, owner_id, import_key, market_products(price) (prices only)
 *  profiles  rows with role, phone, created_at
 */
export const platformStats = ({ stores, profiles, openReports, pendingProposals, pendingApplications, from }) => {
  const products = stores.flatMap((s) => s.market_products || []);
  const roles = { CLIENT: 0, SELLER: 0, STAFF: 0, ADMIN: 0 };
  for (const p of profiles) roles[p.role] = (roles[p.role] || 0) + 1;
  return {
    stores: {
      total: stores.length,
      active: stores.filter((s) => s.is_active).length,
      hidden: stores.filter((s) => !s.is_active).length,
      unclaimed: stores.filter((s) => !s.owner_id).length,
      withoutProducts: stores.filter((s) => !(s.market_products || []).length).length,
    },
    products: {
      total: products.length,
      withoutPrice: products.filter((p) => p.price == null).length,
      onActiveStores: stores.filter((s) => s.is_active).reduce((n, s) => n + (s.market_products || []).length, 0),
    },
    inbox: { openReports, pendingProposals, pendingApplications },
    accounts: {
      total: profiles.length,
      newInPeriod: profiles.filter((p) => p.created_at >= from).length,
      withPhone: profiles.filter((p) => p.phone).length,
      roles,
    },
  };
};
