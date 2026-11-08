import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMove, blockReason, orderTotal, normalizePhone, nextStatus } from '../src/services/orderFlow.js';

const item = (unit_price, quantity = 1) => ({ unit_price, quantity });

test('orders move one step at a time, forward or back', () => {
  assert.equal(nextStatus('NEW'), 'CONFIRMED');
  assert.equal(nextStatus('DELIVERED'), null);
  assert.ok(canMove('NEW', 'CONFIRMED'));
  assert.ok(canMove('CONFIRMED', 'PREPARING'));
  assert.ok(canMove('PREPARING', 'CONFIRMED'));
  assert.ok(canMove('SHIPPED', 'DELIVERED'));
  assert.ok(!canMove('NEW', 'PREPARING'), 'the confirmation call cannot be skipped');
  assert.ok(!canMove('CONFIRMED', 'SHIPPED'));
  assert.ok(!canMove('NEW', 'NEW'));
  assert.ok(!canMove('NEW', 'LOST'));
});

test('anything before delivery can be cancelled, and a cancelled order can only restart from NEW', () => {
  for (const s of ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED']) assert.ok(canMove(s, 'CANCELLED'), s);
  assert.ok(!canMove('DELIVERED', 'CANCELLED'));
  assert.ok(canMove('CANCELLED', 'NEW'));
  assert.ok(!canMove('CANCELLED', 'CONFIRMED'));
});

test('confirming needs every price and the delivery fee', () => {
  const order = { status: 'NEW', delivery_fee: null, carrier: '' };
  assert.match(blockReason(order, [], 'CONFIRMED'), /aucun article/);
  assert.match(blockReason(order, [item(10), item(null)], 'CONFIRMED'), /prix/);
  assert.match(blockReason(order, [item(10)], 'CONFIRMED'), /frais de livraison/);
  assert.equal(blockReason({ ...order, delivery_fee: 0 }, [item(10)], 'CONFIRMED'), null);
});

test('shipping needs a carrier and cancelling needs a reason', () => {
  const ready = { status: 'READY', delivery_fee: 7, carrier: '' };
  assert.match(blockReason(ready, [item(10)], 'SHIPPED'), /transporteur/);
  assert.equal(blockReason(ready, [item(10)], 'SHIPPED', { carrier: 'Aramex' }), null);
  assert.equal(blockReason({ ...ready, carrier: 'Rapid-Poste' }, [item(10)], 'SHIPPED'), null);
  assert.match(blockReason(ready, [item(10)], 'CANCELLED'), /raison/);
  assert.equal(blockReason(ready, [item(10)], 'CANCELLED', { cancelReason: 'Client injoignable' }), null);
  assert.match(blockReason({ status: 'NEW' }, [item(1)], 'READY'), /ne peut pas suivre/);
});

test('totals count only priced items and say when a price is missing', () => {
  assert.deepEqual(orderTotal([item(12.5, 2), item(3.2)], 7), { subtotal: 28.2, total: 35.2, complete: true });
  assert.deepEqual(orderTotal([item(10), item(null, 3)], 7), { subtotal: 10, total: 17, complete: false });
  assert.equal(orderTotal([item(10)], null).complete, false);
});

test('Tunisian phone numbers are normalised', () => {
  assert.equal(normalizePhone('53314369'), '53 314 369');
  assert.equal(normalizePhone('+216 53 314 369'), '53 314 369');
  assert.equal(normalizePhone('00216-53.314.369'), '53 314 369');
  assert.equal(normalizePhone('5331436'), null);
  assert.equal(normalizePhone('+33 6 12 34 56 78'), null);
  assert.equal(normalizePhone(undefined), null);
});
