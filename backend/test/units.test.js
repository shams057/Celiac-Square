import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathIn } from '../src/services/marketImages.js';
import { similarity } from '../src/routes/atmcRoutes.js';
import { rateLimit } from '../src/middleware/rateLimit.js';
import { passwordProblem } from '../src/routes/authRoutes.js';

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
const prefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/marketplace/`;
const storeA = '11111111-1111-4111-8111-111111111111';
const storeB = '22222222-2222-4222-8222-222222222222';
const file = '33333333-3333-4333-8333-333333333333.jpg';

test('stored photos are only accepted inside their own folder', () => {
  assert.equal(pathIn(`${prefix}products/${storeA}/${file}`, `products/${storeA}`), `products/${storeA}/${file}`);
  assert.equal(pathIn(`${prefix}products/${storeB}/${file}`, `products/${storeA}`), null);
  assert.equal(pathIn(`${prefix}products/${storeA}/../${storeB}/${file}`, `products/${storeA}`), null);
  assert.equal(pathIn(`https://evil.example/products/${storeA}/${file}`, `products/${storeA}`), null);
  assert.equal(pathIn(`${prefix}stores/${storeA}/${file}`, `products/${storeA}`), null);
});

test('short search words must match exactly', () => {
  assert.equal(similarity('blé', 'Mayonnaise allégée : Heinz bleu'), 0);
  assert.equal(similarity('blé', 'Thé vert'), 0);
  assert.ok(similarity('blé', 'Farine de blé') > 0.9);
  assert.ok(similarity('chocolat', 'Chocolat de couverture') > 0.9);
  assert.ok(similarity('chocolta', 'Chocolat noir') > 0.6, 'one typo on a long word');
});

test('rate limiter answers 429 past the limit', () => {
  const limiter = rateLimit({ name: 't', windowMs: 60_000, max: 2 });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { statuses.push(code); return this; },
      json() { return this; },
    };
    limiter({ ip: '1.2.3.4' }, res, () => statuses.push(200));
  }
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('password policy', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletters'));
  assert.ok(passwordProblem('1234567890'));
  assert.equal(passwordProblem('celiac2026square'), null);
});
