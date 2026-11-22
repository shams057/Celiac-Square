import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteStats, change } from '../src/services/stats.js';
import { hashVisitor } from '../src/routes/visitRoutes.js';

// 2026-11-22 12:00 in Tunis: a 7-day period runs from the 16th to the 22nd, the one before from the 9th to the 15th
const NOW = new Date('2026-11-22T11:00:00Z').getTime();
const row = (metric, day, n) => ({ metric, day, n: String(n) }); // PostgREST sends bigint as text

const stats = (daily, sales = []) =>
  siteStats({ daily, sales, totals: { accounts: 9 }, visitsSince: '2026-11-10T08:00:00Z', days: 7, now: NOW });

test('days of the period and of the period before are counted apart', () => {
  const s = stats([row('visits', '2026-11-21', 3), row('visits', '2026-11-16', 2), row('visits', '2026-11-12', 4), row('visits', '2026-11-01', 50)]);
  assert.equal(s.daily.length, 7);
  assert.equal(s.daily[0].day, '2026-11-16');
  assert.equal(s.daily[6].day, '2026-11-22');
  assert.deepEqual(s.kpis.visits, { value: 5, previous: 4, change: 25 });
  assert.equal(s.daily.find((d) => d.day === '2026-11-21').visits, 3);
  // Every day of the period is there, at 0 when nothing happened
  assert.equal(s.daily.find((d) => d.day === '2026-11-22').visits, 0);
});

test('every metric has its own figure', () => {
  const s = stats([
    row('accounts', '2026-11-20', 2),
    row('questions', '2026-11-20', 1),
    row('answers', '2026-11-21', 4),
    row('orders', '2026-11-22', 1),
    row('items', '2026-11-22', 6),
    row('products', '2026-11-18', 3),
  ]);
  assert.equal(s.kpis.accounts.value, 2);
  assert.equal(s.kpis.questions.value, 1);
  assert.equal(s.kpis.answers.value, 4);
  assert.equal(s.kpis.orders.value, 1);
  assert.equal(s.kpis.items.value, 6);
  assert.equal(s.kpis.products.value, 3);
  assert.equal(s.totals.accounts, 9);
  assert.equal(s.visitsSince, '2026-11-10T08:00:00Z');
});

test('visitors of a period come from the database, not from adding up the days', () => {
  // The same person on two days: 2 daily visitors, 1 visitor over the period
  const s = stats([row('visitors', '2026-11-20', 1), row('visitors', '2026-11-21', 1), row('visitors_period', null, 1), row('visitors_before', null, 2)]);
  assert.deepEqual(s.kpis.visitors, { value: 1, previous: 2, change: -50 });
  assert.equal(s.daily.find((d) => d.day === '2026-11-20').visitors, 1);
});

test('no comparison without a period before', () => {
  assert.equal(change(5, 0), null);
  assert.equal(change(0, 4), -100);
  assert.equal(stats([row('accounts', '2026-11-20', 1)]).kpis.accounts.change, null);
});

test('best and least sold products are split and typed', () => {
  const s = stats([], [
    { list: 'top', product_id: 'p1', title: 'Pain', store_name: 'A', units: '6', orders: '2', revenue: '18.000', listed_at: '2026-11-01T00:00:00Z' },
    { list: 'top', product_id: null, title: 'Ancien produit', store_name: 'A', units: '5', orders: '1', revenue: '0', listed_at: null },
    { list: 'bottom', product_id: 'p3', title: 'Biscuits', store_name: 'A', units: '0', orders: '0', revenue: '0', listed_at: '2026-11-20T10:00:00Z' },
  ]);
  assert.deepEqual(s.topProducts.map((p) => [p.name, p.units, p.revenue]), [['Pain', 6, 18], ['Ancien produit', 5, 0]]);
  assert.equal(s.topProducts[1].id, null);
  assert.deepEqual(s.leastProducts.map((p) => [p.name, p.units, p.listedAt]), [['Biscuits', 0, '2026-11-20T10:00:00Z']]);
});

test('visitors are stored hashed', () => {
  const id = '3f1c2a9e-6b7d-4e1f-9a2b-1c3d4e5f6a7b';
  assert.equal(hashVisitor(id), hashVisitor(id));
  assert.notEqual(hashVisitor(id), hashVisitor(`${id}x`));
  assert.equal(hashVisitor(id).length, 32);
  assert.ok(!hashVisitor(id).includes(id.slice(0, 8)));
});
