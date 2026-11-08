import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderStats, platformStats, dayRange, tnDay, rangeStart, hoursLate, median } from '../src/services/dashboard.js';

const NOW = new Date('2026-11-08T12:00:00Z').getTime();
const H = 3600 * 1000;
const ago = (hours) => new Date(NOW - hours * H).toISOString();
const item = (unit_price, quantity = 1, title = 'Pain') => ({ product_id: title, title, unit_price, quantity });
let n = 1000;
const order = (fields) => ({
  id: `o${++n}`,
  number: n,
  status: 'NEW',
  store_id: 's1',
  store_name: 'Tout Sans Gluten',
  customer_name: 'Client',
  city: 'Tunis',
  carrier: '',
  delivery_fee: 7,
  cancel_reason: '',
  confirm_channel: 'WHATSAPP',
  whatsapp_status: 'NONE',
  whatsapp_sent_at: null,
  created_at: ago(2),
  order_items: [item(10, 2)],
  ...fields,
});

test('days are Tunisian days', () => {
  assert.equal(tnDay('2026-11-08T23:30:00Z'), '2026-11-09'); // 00:30 in Tunis
  assert.deepEqual(dayRange(3, NOW), ['2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(rangeStart(3, NOW), '2026-11-05T23:00:00.000Z');
});

test('median ignores missing values', () => {
  assert.equal(median([3, null, 1, 2]), 2);
  assert.equal(median([1, 4]), 2.5);
  assert.equal(median([null]), null);
});

test('late orders: each step has its own limit, WhatsApp waiting is never late', () => {
  assert.ok(hoursLate(order({ created_at: ago(30) }), NOW) > 5);
  assert.equal(hoursLate(order({ created_at: ago(10) }), NOW), 0);
  assert.equal(hoursLate(order({ created_at: ago(40), whatsapp_status: 'SENT', whatsapp_sent_at: ago(40) }), NOW), 0, 'still within 3 days');
  assert.ok(hoursLate(order({ created_at: ago(100), whatsapp_status: 'SENT', whatsapp_sent_at: ago(100) }), NOW) > 0, '4 days, no reply, not called for a day');
  assert.equal(hoursLate(order({ status: 'PREPARING', preparing_at: ago(40) }), NOW), 0);
  assert.equal(hoursLate(order({ status: 'PREPARING', preparing_at: ago(50) }), NOW), 2);
});

test('order figures: revenue from deliveries, rates from the period’s orders', () => {
  const delivered = order({ status: 'DELIVERED', created_at: ago(60), confirmed_at: ago(58), preparing_at: ago(50), ready_at: ago(30), shipped_at: ago(28), delivered_at: ago(4), whatsapp_status: 'CONFIRMED', carrier: 'Aramex' });
  const cancelled = order({ status: 'CANCELLED', created_at: ago(20), cancel_reason: 'Client injoignable', city: 'Sfax' });
  const waiting = order({ whatsapp_status: 'SENT', whatsapp_sent_at: ago(1), created_at: ago(1) });
  const toCall = order({ created_at: ago(30), confirm_channel: 'PHONE' });
  const preparing = order({ status: 'PREPARING', created_at: ago(70), confirmed_at: ago(66), preparing_at: ago(60), store_id: 's2', store_name: 'Makelti', order_items: [item(5, 3, 'Brik')] });
  const cohort = [delivered, cancelled, waiting, toCall, preparing];
  const s = orderStats({
    cohort,
    delivered: [delivered],
    active: [waiting, toCall, preparing],
    events: [
      { actor_email: 'equipe@cs.tn', kind: 'STATUS' },
      { actor_email: 'equipe@cs.tn', kind: 'CALL' },
      { actor_email: 'admin@cs.tn', kind: 'NOTE' },
    ],
    days: 7,
    now: NOW,
  });

  assert.equal(s.kpis.placed, 5);
  assert.equal(s.kpis.delivered, 1);
  assert.equal(s.kpis.revenue, 27); // 2 × 10 + 7 delivery
  assert.equal(s.kpis.averageBasket, 27);
  assert.equal(s.kpis.confirmed, 2);
  assert.equal(s.kpis.confirmationRate, 66.7); // 2 confirmed of the 3 orders acted on (2 still NEW)
  assert.equal(s.kpis.cancellationRate, 20);
  assert.equal(s.kpis.whatsappConfirmShare, 50);
  assert.equal(s.kpis.medianConfirmHours, 3); // 2 h and 4 h
  assert.equal(s.kpis.medianLeadHours, 56);
  assert.equal(s.kpis.lateCount, 2); // to call for 30 h; with the artisan for 60 h

  assert.equal(s.pipeline.WAITING.count, 1);
  assert.equal(s.pipeline.NEW.count, 1);
  assert.equal(s.pipeline.NEW.late, 1);
  assert.equal(s.pipeline.PREPARING.late, 1);
  assert.equal(s.late[0].reference, `CS-${preparing.number}`, 'latest first');

  assert.equal(s.daily.length, 7);
  assert.equal(s.daily.at(-1).delivered, 1);
  assert.equal(s.daily.reduce((t, d) => t + d.placed, 0), 5);

  assert.deepEqual(s.byStore.map((x) => [x.name, x.count]), [['Tout Sans Gluten', 4], ['Makelti', 1]]);
  assert.equal(s.byStore[0].revenue, 27);
  assert.equal(s.byCity[0].name, 'Tunis');
  assert.deepEqual(s.cancelReasons, [{ name: 'Client injoignable', count: 1 }]);
  assert.equal(s.byCarrier[0].name, 'Aramex');
  assert.equal(s.byCarrier[0].medianHours, 24);
  assert.equal(s.topProducts[0].name, 'Pain', 'cancelled orders do not count');
  assert.equal(s.topProducts[0].count, 6);
  assert.equal(s.whatsapp.askedPhone, 1);
  assert.equal(s.whatsapp.waiting, 1);
  assert.equal(s.whatsapp.confirmed, 1);
  assert.deepEqual(s.team[0], { name: 'equipe@cs.tn', count: 2, steps: 1, calls: 1, notes: 0, edits: 0 });
});

test('an empty period gives zeros and no rates, not errors', () => {
  const s = orderStats({ cohort: [], delivered: [], active: [], events: [], days: 30, now: NOW });
  assert.equal(s.kpis.placed, 0);
  assert.equal(s.kpis.confirmationRate, null);
  assert.equal(s.kpis.averageBasket, null);
  assert.equal(s.daily.length, 30);
  assert.deepEqual(s.late, []);
});

test('platform figures', () => {
  const p = platformStats({
    stores: [
      { is_active: true, owner_id: 'u1', market_products: [{ price: 5 }, { price: null }] },
      { is_active: false, owner_id: null, import_key: 'k', market_products: [{ price: null }] },
      { is_active: false, owner_id: null, market_products: [] },
    ],
    profiles: [
      { role: 'ADMIN', phone: '22 123 456', created_at: '2026-10-01T00:00:00Z' },
      { role: 'CLIENT', phone: '', created_at: '2026-11-07T00:00:00Z' },
    ],
    openReports: 2,
    pendingProposals: 0,
    pendingApplications: 1,
    from: '2026-11-01T00:00:00Z',
  });
  assert.deepEqual(p.stores, { total: 3, active: 1, hidden: 2, unclaimed: 2, withoutProducts: 1 });
  assert.deepEqual(p.products, { total: 3, withoutPrice: 2, onActiveStores: 2 });
  assert.equal(p.accounts.newInPeriod, 1);
  assert.equal(p.accounts.withPhone, 1);
  assert.equal(p.accounts.roles.ADMIN, 1);
});
