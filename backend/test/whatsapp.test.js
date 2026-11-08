import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { isConfirmation, normalizeReply, toWhatsAppId, fromWhatsAppId, validSignature, incomingMessages } from '../src/services/whatsapp.js';
import { isAwaitingWhatsApp, whatsappDeadline } from '../src/services/orderFlow.js';

process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.WHATSAPP_APP_SECRET = 'app-secret';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';

const DAY = 24 * 3600 * 1000;

test('the keyword confirms in any case, with punctuation or emoji around it', () => {
  delete process.env.ORDER_CONFIRM_WORDS;
  for (const reply of ['OUI', 'oui', 'Oui', 'oUi', ' oui ', 'Oui !', 'oui.', '👍 OUI', '"oui"']) assert.ok(isConfirmation(reply), reply);
  for (const reply of ['non', 'oui mais demain', 'ouii', 'pas oui', '', '   ', 'OK']) assert.ok(!isConfirmation(reply), reply);
});

test('the confirmation words can be changed, accents and case do not matter', () => {
  process.env.ORDER_CONFIRM_WORDS = 'Confirmé, نعم';
  assert.ok(isConfirmation('CONFIRME'));
  assert.ok(isConfirmation('confirmé'));
  assert.ok(isConfirmation('نعم'));
  assert.ok(!isConfirmation('oui'));
  delete process.env.ORDER_CONFIRM_WORDS;
  assert.equal(normalizeReply('  Oui,  merci! '), 'OUI MERCI');
});

test('phone numbers convert between our format and WhatsApp IDs', () => {
  assert.equal(toWhatsAppId('53 314 369'), '21653314369');
  assert.equal(toWhatsAppId('21653314369'), '21653314369');
  assert.equal(toWhatsAppId('+33 6 12 34 56 78'), null);
  assert.equal(fromWhatsAppId('21653314369'), '53 314 369');
  assert.equal(fromWhatsAppId('33612345678'), null);
});

test('the team waits 3 days for the reply, then calls', () => {
  const sent = new Date('2026-11-08T10:00:00Z');
  const order = { status: 'NEW', whatsapp_status: 'SENT', whatsapp_sent_at: sent.toISOString() };
  assert.equal(whatsappDeadline(sent.toISOString()), '2026-11-11T10:00:00.000Z');
  assert.ok(isAwaitingWhatsApp(order, sent.getTime() + 2 * DAY));
  assert.ok(!isAwaitingWhatsApp(order, sent.getTime() + 3 * DAY + 1));
  assert.ok(!isAwaitingWhatsApp({ ...order, whatsapp_status: 'REPLIED' }, sent.getTime() + DAY), 'an unexpected reply goes to the call list');
  assert.ok(!isAwaitingWhatsApp({ ...order, whatsapp_status: 'FAILED' }, sent.getTime()));
  assert.ok(!isAwaitingWhatsApp({ ...order, status: 'CONFIRMED' }, sent.getTime() + DAY));
  process.env.ORDER_WHATSAPP_WAIT_DAYS = '1';
  assert.ok(!isAwaitingWhatsApp(order, sent.getTime() + 2 * DAY));
  delete process.env.ORDER_WHATSAPP_WAIT_DAYS;
});

const sign = (body) => `sha256=${crypto.createHmac('sha256', 'app-secret').update(body).digest('hex')}`;

test('webhook signatures are checked against the app secret', () => {
  const body = Buffer.from('{"a":1}');
  assert.ok(validSignature(body, sign(body)));
  assert.ok(!validSignature(body, sign(Buffer.from('{"a":2}'))));
  assert.ok(!validSignature(body, 'sha256=00'));
  assert.ok(!validSignature(body, undefined));
});

test('text, button and interactive replies are read; status updates are not', () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [{ id: 'x', status: 'delivered' }],
              messages: [
                { id: 'm1', from: '21653314369', type: 'text', text: { body: 'oui' } },
                { id: 'm2', from: '21622123456', type: 'button', button: { text: 'OUI', payload: 'OUI' } },
                { id: 'm3', from: '21622123456', type: 'interactive', interactive: { button_reply: { title: 'Oui' } } },
              ],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    incomingMessages(payload).map((m) => [m.id, m.from, m.text]),
    [
      ['m1', '21653314369', 'oui'],
      ['m2', '21622123456', 'OUI'],
      ['m3', '21622123456', 'Oui'],
    ]
  );
  assert.deepEqual(incomingMessages({}), []);
});

// The webhook route, through the real app (database unreachable: nothing gets that far)
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

test('the webhook answers Meta’s verification only with the right token', async () => {
  const ok = await fetch(`${base}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '12345');
  const bad = await fetch(`${base}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345`);
  assert.equal(bad.status, 403);
});

test('unsigned webhook calls are refused, signed ones without messages are acknowledged', async () => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'x' }] } }] }] });
  const unsigned = await fetch(`${base}/api/whatsapp/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal(unsigned.status, 401);
  const signed = await fetch(`${base}/api/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(Buffer.from(body)) },
    body,
  });
  assert.equal(signed.status, 200);
});

test('sign-up asks for a valid phone number', async () => {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'someone@example.com', password: 'abcdefghij1', fullName: 'Test', phone: '123' }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /téléphone/);
});
