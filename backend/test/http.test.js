import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// The database is "configured" but unreachable: routes run and fail, the process must not
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SECRET_KEY = 'test-key';

let server;
let base;

before(async () => {
  const { default: app } = await import('../src/app.js');
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test('repeated query keys do not crash the API', async () => {
  for (const path of ['/api/products/search?q=a&q=b', '/api/map/spots?category=a&category=b&q=x&q=y', '/api/atmc/products?q[a]=1']) {
    const res = await fetch(base + path);
    assert.ok([200, 500].includes(res.status), `${path} -> ${res.status}`);
    const body = await res.json();
    if (res.status === 500) assert.equal(body.message, 'Erreur interne du serveur.');
  }
  // Still alive
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
});

test('health check reveals no configuration', async () => {
  const body = await (await fetch(`${base}/api/health`)).json();
  assert.deepEqual(Object.keys(body), ['status']);
});

test('security headers are set and Express is not advertised', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
});

test('CORS only answers allowed origins', async () => {
  const evil = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const ok = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('admin routes need an admin account', async () => {
  const res = await fetch(`${base}/api/admin/users`, { headers: { Authorization: 'Bearer some-static-token' } });
  assert.equal(res.status, 401);
});

test('invalid barcodes are rejected before calling Open Food Facts', async () => {
  const res = await fetch(`${base}/api/products/barcode/..%2Fetc`);
  assert.equal(res.status, 400);
});

test('oversized vision bodies are refused', async () => {
  const res = await fetch(`${base}/api/vision/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(60 * 1024) }),
  });
  assert.equal(res.status, 413);
});

test('scanner photo routes reject bad images and oversized bodies', async () => {
  process.env.GEMINI_API_KEY ||= 'test-key';
  const post = (path, body) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/api/vision/identify', { image: 'data:text/html;base64,PGI+' })).status, 400);
  assert.equal((await post('/api/vision/ingredients', { image: 'not-an-image' })).status, 400);
  assert.equal((await post('/api/vision/identify', { image: `data:image/jpeg;base64,${'A'.repeat(3.2 * 1024 * 1024)}` })).status, 413);
});
