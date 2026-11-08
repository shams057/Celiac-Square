import crypto from 'crypto';

/**
 * WhatsApp Business (Meta Cloud API): order confirmation requests and replies.
 *
 * Environment (backend/.env and Vercel):
 *   WHATSAPP_TOKEN            permanent access token of the system user
 *   WHATSAPP_PHONE_NUMBER_ID  the sending number's ID (WhatsApp Manager → API setup)
 *   WHATSAPP_APP_SECRET       the Meta app's secret: checks that webhook calls come from Meta
 *   WHATSAPP_VERIFY_TOKEN     any long random string, also typed in the webhook settings
 *   WHATSAPP_TEMPLATE         approved template name (default: confirmation_commande)
 *   WHATSAPP_TEMPLATE_LANG    its language code (default: fr)
 *   ORDER_CONFIRM_WORDS       words that confirm, comma-separated (default: OUI)
 *
 * Without the first three, nothing is sent and every order goes to the team's call list.
 *
 * Messages a business starts must use a template approved by Meta. The template has four
 * body variables: {{1}} customer name, {{2}} order number(s), {{3}} items, {{4}} total.
 * See README.md (WhatsApp) for the suggested wording.
 */
const GRAPH = 'https://graph.facebook.com/v21.0';

export const isWhatsAppConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET);

/** "53 314 369" → "21653314369" (WhatsApp IDs are international numbers without "+") */
export const toWhatsAppId = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^\d{8}$/.test(digits)) return `216${digits}`;
  if (/^216\d{8}$/.test(digits)) return digits;
  return null;
};

/** "21653314369" → "53 314 369", the format orders are stored in; null for a foreign number */
export const fromWhatsAppId = (waId) => {
  const m = /^216(\d{2})(\d{3})(\d{3})$/.exec(String(waId || ''));
  return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
};

/**
 * The reply, reduced to compare with the keyword: accents, punctuation, emoji and case
 * removed. "Oui !", "oui.", " OUI " and "👍 oui" all become "OUI".
 */
export const normalizeReply = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const confirmWords = () =>
  (process.env.ORDER_CONFIRM_WORDS || 'OUI')
    .split(',')
    .map(normalizeReply)
    .filter(Boolean);

/** True when the whole reply is one of the confirmation words, in any case */
export const isConfirmation = (text) => {
  const reply = normalizeReply(text);
  return Boolean(reply) && confirmWords().includes(reply);
};

/** Template parameters cannot hold new lines, tabs or more than 3 spaces in a row */
const param = (text, max = 900) =>
  String(text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max) || '-';

const send = async (payload) => {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `WhatsApp HTTP ${res.status}`);
  return body?.messages?.[0]?.id || '';
};

/**
 * Asks the customer to confirm. Returns the WhatsApp message id; throws when WhatsApp
 * refuses (number not on WhatsApp, template not approved…).
 * vars: { name, references, items, total }
 */
export const sendConfirmationRequest = (phone, { name, references, items, total }) => {
  const to = toWhatsAppId(phone);
  if (!to) throw new Error('Numéro non tunisien');
  return send({
    to,
    type: 'template',
    template: {
      name: process.env.WHATSAPP_TEMPLATE || 'confirmation_commande',
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'fr' },
      components: [
        {
          type: 'body',
          parameters: [param(name, 100), param(references, 200), param(items), param(total, 60)].map((text) => ({ type: 'text', text })),
        },
      ],
    },
  });
};

/** A plain text answer. Only allowed within 24 hours of the customer's last message. */
export const sendText = (waId, text) => send({ to: waId, type: 'text', text: { body: String(text).slice(0, 4000) } });

/** Checks X-Hub-Signature-256: an HMAC of the raw body with the app secret */
export const validSignature = (rawBody, header) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody) || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const given = Buffer.from(header);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

/**
 * The customer messages in a webhook payload: [{ id, from, text }]. Text messages,
 * quick-reply buttons and interactive replies all count; status updates are ignored.
 */
export const incomingMessages = (payload) => {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      for (const m of change?.value?.messages || []) {
        const text = m.text?.body ?? m.button?.text ?? m.button?.payload ?? m.interactive?.button_reply?.title ?? '';
        out.push({ id: String(m.id || ''), from: String(m.from || ''), text: String(text), type: String(m.type || '') });
      }
    }
  }
  return out;
};
