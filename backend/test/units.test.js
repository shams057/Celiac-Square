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

test('the safety net only ever makes an AI ingredients verdict stricter', async () => {
  const { applySafetyNet } = await import('../src/services/visionService.js');
  const ai = (verdict) => ({ verdict, confidence: 0.95, glutenIngredients: [], traces: [], explanationFr: '', explanationAr: '' });
  assert.equal(applySafetyNet(ai('GLUTEN_FREE'), 'farine de blé, sucre').verdict, 'CONTAINS_GLUTEN');
  assert.equal(applySafetyNet(ai('MAY_CONTAIN'), 'semoule de blé dur').verdict, 'CONTAINS_GLUTEN');
  assert.equal(applySafetyNet(ai('GLUTEN_FREE'), 'riz, sucre. Peut contenir des traces de blé.').verdict, 'MAY_CONTAIN');
  assert.equal(applySafetyNet(ai('GLUTEN_FREE'), 'lait, sucre, amidon, cacao').verdict, 'MAY_CONTAIN');
  // Never more lenient than the AI, and nothing to change on a clean list
  assert.equal(applySafetyNet(ai('CONTAINS_GLUTEN'), 'lait, sucre').verdict, 'CONTAINS_GLUTEN');
  assert.equal(applySafetyNet(ai('GLUTEN_FREE'), 'lait, sucre, amidon de maïs').verdict, 'GLUTEN_FREE');
  assert.equal(applySafetyNet(ai('UNREADABLE'), 'farine de blé').verdict, 'UNREADABLE');
});

test('scanner photos are checked before they reach the AI', async () => {
  const { parseImageDataUrl } = await import('../src/utils/images.js');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
  assert.equal(parseImageDataUrl(`data:image/png;base64,${png}`, 1024).mimeType, 'image/png');
  assert.throws(() => parseImageDataUrl(`data:image/jpeg;base64,${png}`, 1024), /pas une image valide/);
  assert.throws(() => parseImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=', 1024), /Format/);
  assert.throws(() => parseImageDataUrl(`data:image/png;base64,${png}`, 4), /dépasse/);
});
